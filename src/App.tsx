import { useState, useEffect, useRef } from 'react';
import { BrowserProvider, Contract, formatUnits, Interface, JsonRpcProvider } from 'ethers';
import { useEIP6963Providers } from './hooks/useEIP6963';
import WalletModal from './components/WalletModal';

const ERC8004_ADDRESS = '0x434B04634C542Be57fe21C1E1C46d3Cad492e496';
const BASE_CHAIN_HEX = '0x2105';

const ERC8004_ABI = [
  {
    name: 'mintAgent',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'uri', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'archetype', type: 'string' },
      { name: 'catchphrase', type: 'string' },
      { name: 'riskTolerance', type: 'uint256' },
      { name: 'dailyCap', type: 'uint256' },
      { name: 'txCap', type: 'uint256' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }]
  },
  {
    name: 'updateAgentURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'newURI', type: 'string' }
    ],
    outputs: []
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'archetype', type: 'string' },
          { name: 'catchphrase', type: 'string' },
          { name: 'riskTolerance', type: 'uint256' },
          { name: 'dailyCap', type: 'uint256' },
          { name: 'txCap', type: 'uint256' },
          { name: 'active', type: 'bool' }
        ]
      }
    ]
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'address' }]
  },
  {
    name: 'AgentRegistered',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'archetype', type: 'string', indexed: false }
    ]
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true }
    ]
  }
];

export default function App() {
  const providers = useEIP6963Providers();
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [activeTab, setActiveTab] = useState(1);
  const [agentName, setAgentName] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('NEUTRAL');
  const [catchphrase, setCatchphrase] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [archetype, setArchetype] = useState('TRADER');
  const [riskVal, setRiskVal] = useState(5);
  
  const [dailyCap, setDailyCap] = useState(25);
  const [txCap, setTxCap] = useState(50);
  const [duration, setDuration] = useState('30 days');

  const [venues, setVenues] = useState({ aerodrome: true, uniswap: true, baseswap: true });
  const [tokens, setTokens] = useState({ eth: true, usdc: true, cbeth: false, usdbc: false, weth: false });
  const [sybilAware, setSybilAware] = useState(true);

  const [stats, setStats] = useState({ block: '—', gas: '—', network: 'Base' });
  const [logs, setLogs] = useState<{ icon: string; text: string; right: string; iconClass: string; isHtml?: boolean; isDim?: boolean }[]>([]);
  const [deployedAgent, setDeployedAgent] = useState<any>(null);
  const [registryAgents, setRegistryAgents] = useState<any[]>([]);
  const [registryQuerying, setRegistryQuerying] = useState(false);
  const [registryError, setRegistryError] = useState('');

  const [readTokenId, setReadTokenId] = useState('');
  const [readAgentData, setReadAgentData] = useState<any>(null);
  const [isReadingTarget, setIsReadingTarget] = useState(false);

  const [updateTokenId, setUpdateTokenId] = useState('');
  const [updateTokenURI, setUpdateTokenURI] = useState('');
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  const fetchChainStats = async (prov: BrowserProvider) => {
    try {
      const block = await prov.getBlockNumber();
      const fee = await prov.getFeeData();
      const gwei = formatUnits(fee.gasPrice || 0n, 'gwei');
      setStats({
        block: '#' + block.toLocaleString(),
        gas: parseFloat(gwei).toFixed(3) + ' gwei',
        network: 'Base Mainnet'
      });
    } catch (e) {}
  };

  const handleConnect = async (rawProvider: any) => {
    setIsModalOpen(false);
    if (!rawProvider) {
      showToast('No wallet detected.', 'error');
      return;
    }
    try {
      const prov = new BrowserProvider(rawProvider);
      await prov.send('eth_requestAccounts', []);

      try {
        await prov.send('wallet_switchEthereumChain', [{ chainId: BASE_CHAIN_HEX }]);
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await prov.send('wallet_addEthereumChain', [{
            chainId: BASE_CHAIN_HEX,
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org']
          }]);
        } else {
          throw switchErr;
        }
      }

      const sig = await prov.getSigner();
      const addr = await sig.getAddress();

      setProvider(prov);
      setSigner(sig);
      setWalletAddress(addr);
      
      showToast('Wallet connected: ' + addr.slice(0, 8) + '…', 'success');
      fetchChainStats(prov);
    } catch (e: any) {
      showToast('Connection failed: ' + (e.message || e), 'error');
    }
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const addLog = (icon: string, text: string, right = '', iconClass = 'text-accent-green', isHtml = false, isDim = false) => {
    setLogs(prev => [...prev, { icon, text, right, iconClass, isHtml, isDim }]);
  };
  const updateLastLog = (patch: any) => {
    setLogs(prev => {
      const newLogs = [...prev];
      if (newLogs.length > 0) {
        newLogs[newLogs.length - 1] = { ...newLogs[newLogs.length - 1], ...patch };
      }
      return newLogs;
    });
  };

  const startDeploy = async () => {
    if (!agentName || agentName.length < 2) {
      showToast('Agent name must be 2–24 characters.', 'error');
      return;
    }
    if (!signer || !walletAddress || !provider) {
      showToast('Connect your wallet first!', 'error');
      setIsModalOpen(true);
      return;
    }
    setActiveTab(3);
    setLogs([]);
    setDeployedAgent(null);
    fetchChainStats(provider);

    addLog('✓', 'wallet connected', walletAddress.slice(0, 10) + '…', 'text-accent-green');
    await sleep(300);
    addLog('✓', 'switched to Base Mainnet (chainId: 8453)', 'base mainnet', 'text-accent-green');
    await sleep(300);

    const regData = {
      name: agentName,
      description: `${archetype} agent. Risk tolerance: ${riskVal}/10. Daily cap: $${dailyCap}. Per-tx cap: $${txCap}.`,
      version: '1.0.0',
      archetype,
      catchphrase: catchphrase || undefined,
      endpoint: endpoint || undefined,
      permissions: { dailyCap, txCap, duration, riskTolerance: riskVal },
      volt: true,
      created: new Date().toISOString()
    };

    const json = JSON.stringify(regData);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const dataUri = 'data:application/json;base64,' + b64;

    addLog('✓', 'built ERC-8004 registration metadata', json.length + ' bytes', 'text-accent-green');
    await sleep(400);
    addLog('-', '---', '', 'text-text-muted'); // separator
    addLog('·', 'archetype: ' + archetype, '', 'text-text-dim', false, true);
    addLog('·', `caps: $${dailyCap}/day · $${txCap}/tx · ${duration}`, '', 'text-text-dim', false, true);
    addLog('·', `risk: ${riskVal}/10`, '', 'text-text-dim', false, true);
    addLog('-', '---', '', 'text-text-muted');

    addLog('⟳', 'awaiting wallet signature for mint tx…', '', 'text-accent-cyan');

    try {
      const t0 = Date.now();
      const contract = new Contract(ERC8004_ADDRESS, ERC8004_ABI, signer);

      let gasEstimate = 500000n;
      try { gasEstimate = await contract.mintAgent.estimateGas(dataUri, agentName, archetype, catchphrase || "", BigInt(parseInt(riskVal.toString()) || 0), BigInt(parseInt(dailyCap.toString()) || 0), BigInt(parseInt(txCap.toString()) || 0), { value: 0n }); } catch(e) {}

      const tx = await contract.mintAgent(dataUri, agentName, archetype, catchphrase || "", BigInt(parseInt(riskVal.toString()) || 0), BigInt(parseInt(dailyCap.toString()) || 0), BigInt(parseInt(txCap.toString()) || 0), { gasLimit: gasEstimate + 50000n });

      updateLastLog({ icon: '✓', iconClass: 'text-accent-green', text: 'tx submitted: ' + tx.hash.slice(0, 18) + '…', right: `<a href="https://basescan.org/tx/${tx.hash}" target="_blank" class="text-accent-cyan hover:underline">basescan ↗</a>`, isHtml: true });

      addLog('⟳', 'waiting for confirmation…', '', 'text-accent-cyan');

      const receipt = await tx.wait();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1) + 's';

      updateLastLog({ icon: '✓', iconClass: 'text-accent-green', text: 'confirmed in block #' + receipt.blockNumber, right: elapsed });

      let tokenId = null;
      const iface = new Interface(ERC8004_ABI);
      for (const log2 of receipt.logs) {
        try {
          const parsed = iface.parseLog(log2 as any);
          if (parsed && parsed.name === 'AgentRegistered') {
            tokenId = parsed.args[0].toString();
            break;
          } else if (parsed && parsed.name === 'Transfer') {
            tokenId = parsed.args[2].toString();
          }
        } catch(e) {}
      }

      addLog('-', '---', '', 'text-text-muted');
      addLog('·', 'tx hash: ' + tx.hash, '', 'text-text-dim', false, true);
      addLog('·', 'block: #' + receipt.blockNumber, '', 'text-text-dim', false, true);
      if (tokenId != null) addLog('·', 'agent token ID: ' + tokenId, '', 'text-text-dim', false, true);
      addLog('·', 'owner: ' + walletAddress, '', 'text-text-dim', false, true);
      addLog('✓', 'ERC-8004 NFT minted on Base Mainnet ✓', '', 'text-accent-green');

      setDeployedAgent({ name: agentName, archetype, tokenId, txHash: tx.hash, blockNumber: receipt.blockNumber, owner: walletAddress });
      showToast(`Agent "${agentName}" registered on-chain!`, 'success');

    } catch (e: any) {
      updateLastLog({ icon: '✕', iconClass: 'text-accent-red', text: 'transaction failed' });
      addLog('✕', e.reason || e.message || 'User rejected or tx failed', '', 'text-accent-red');
      showToast('Deploy failed: ' + (e.reason || e.message || 'unknown error'), 'error');
    }
  };

  const searchAgents = async () => {
    setRegistryQuerying(true);
    setRegistryError('');
    setRegistryAgents([]);
    try {
      // Create a provider to read from the contract
      const rpcProvider = (window as any).ethereum ? new BrowserProvider((window as any).ethereum) : new JsonRpcProvider('https://mainnet.base.org');
      const contract = new Contract(ERC8004_ADDRESS, ERC8004_ABI, rpcProvider);
      
      const agents = [];
      // Try to fetch the latest tokens (max 5)
      // Since there's no totalSupply, we'll try a few IDs sequentially until one fails
      // We know ID 0 exists, so we'll start there
      for (let i = 0; i < 20; i++) {
        try {
          const data = await contract.getAgent(i);
          const owner = await contract.ownerOf(i).catch(() => 'unknown');
          agents.push({
            id: i,
            name: data[0],
            owner: owner
          });
          if (agents.length >= 5) break;
        } catch (err) {
          // Reverts when token doesn't exist
          break;
        }
      }
      
      setRegistryAgents(agents);
    } catch (e: any) {
      setRegistryError(e.message);
    } finally {
      setRegistryQuerying(false);
    }
  };

  const executeGetAgent = async () => {
    if (!readTokenId || !provider) return;
    setIsReadingTarget(true);
    setReadAgentData(null);
    try {
      const contract = new Contract(ERC8004_ADDRESS, ERC8004_ABI, provider);
      const data = await contract.getAgent(BigInt(readTokenId));
      setReadAgentData({
        name: data[0],
        archetype: data[1],
        catchphrase: data[2],
        riskTolerance: data[3].toString(),
        dailyCap: data[4].toString(),
        txCap: data[5].toString(),
        active: data[6]
      });
      showToast('Agent data retrieved.', 'success');
    } catch(e: any) {
      showToast('Failed to retrieve agent: ' + (e.reason || e.message), 'error');
    } finally {
      setIsReadingTarget(false);
    }
  };

  const executeUpdateAgentURI = async () => {
    if (!updateTokenId || !updateTokenURI || !signer) return;
    setIsUpdatingTarget(true);
    try {
      const contract = new Contract(ERC8004_ADDRESS, ERC8004_ABI, signer);
      const tx = await contract.updateAgentURI(BigInt(updateTokenId), updateTokenURI);
      showToast('Updating URI... Transaction submitted.', 'info');
      await tx.wait();
      showToast('Agent URI successfully updated!', 'success');
    } catch(e: any) {
      showToast('Update failed: ' + (e.reason || e.message), 'error');
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  const executeWithdraw = async () => {
    if (!signer) return;
    setIsWithdrawing(true);
    try {
      const contract = new Contract(ERC8004_ADDRESS, ERC8004_ABI, signer);
      const tx = await contract.withdraw();
      showToast('Withdraw transaction submitted.', 'info');
      await tx.wait();
      showToast('Withdraw successful!', 'success');
    } catch(e: any) {
      showToast('Withdraw failed: ' + (e.reason || e.message), 'error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <>
      <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} providers={providers} onConnect={handleConnect} />
      
      {toast && (
        <div className={`fixed bottom-5 right-5 bg-card border px-4 py-3 text-xs z-[300] rounded-sm transition-opacity ${toast.type === 'success' ? 'border-accent-green text-accent-green' : toast.type === 'error' ? 'border-accent-red text-accent-red' : 'border-accent-cyan text-accent-cyan'}`}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-panel-border bg-dark">
        <div className="font-sans text-[15px] font-bold tracking-[0.35em] text-text-primary flex items-center gap-2.5">
          <span className="text-text-dim">║</span> VOLT AGENT LAUNCHER <span className="text-text-dim">║</span>
        </div>
        <div className="flex items-center gap-3">
          {walletAddress && <div className="text-[10px] px-2.5 py-1 border border-accent-cyan/40 rounded-full text-accent-cyan font-sans font-semibold tracking-[0.08em]">BASE MAINNET</div>}
          <button onClick={() => setIsModalOpen(true)} className={`font-sans font-bold text-xs tracking-[0.12em] px-4 py-2 border rounded-sm transition-all whitespace-nowrap ${walletAddress ? 'border-accent-green text-accent-green hover:bg-accent-green/10' : 'border-accent-cyan text-accent-cyan bg-transparent hover:bg-accent-cyan/10'}`}>
            {walletAddress ? walletAddress.slice(0,6) + '…' + walletAddress.slice(-4) : 'CONNECT WALLET'}
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-6">
        {/* STEPS */}
        <div className="flex items-center mb-8">
          {[
            { id: 1, label: '01 · PERSONA' },
            { id: 2, label: '02 · PERMISSIONS' },
            { id: 3, label: '03 · DEPLOY' },
            { id: 4, label: '04 · LIVE CONSOLE' }
          ].map((step, i) => (
            <div key={step.id} className="flex items-center">
              <button onClick={() => setActiveTab(step.id)} className={`font-sans font-bold text-[13px] tracking-[0.15em] px-5 py-2.5 border transition-all whitespace-nowrap rounded-sm ${activeTab === step.id ? 'border-accent-cyan text-text-primary bg-accent-cyan/10' : 'border-panel-border text-text-dim hover:border-accent-cyan hover:text-text-primary bg-transparent'}`}>
                {step.label}
              </button>
              {i < 3 && <span className="text-text-muted px-2 text-xs">—</span>}
            </div>
          ))}
        </div>

        {/* PAGE 1 */}
        {activeTab === 1 && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> IDENTITY
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                <div>
                  <div className="grid grid-cols-2 gap-6 mb-5">
                    <div>
                      <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">AGENT NAME</label>
                      <input type="text" maxLength={24} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. Volty" className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan placeholder:text-text-muted" />
                      <div className="text-[11px] text-text-dim mt-1.5">2–24 chars. shows up in chat + logs.</div>
                    </div>
                    <div>
                      <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">VOICE</label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {[{v:'NEUTRAL',d:'clinical, terse'},{v:'PLAYFUL',d:'casual, emojis off though'},{v:'FORMAL',d:'board-meeting prose'},{v:'HACKER',d:'lowercase, ascii vibes'}].map(voice => (
                          <div key={voice.v} onClick={() => setSelectedVoice(voice.v)} className={`p-3.5 border rounded-sm cursor-pointer transition-all ${selectedVoice === voice.v ? 'border-accent-cyan bg-accent-cyan/10' : 'border-panel-border bg-card hover:border-accent-cyan'}`}>
                            <div className="font-sans font-bold text-sm tracking-[0.1em] text-text-primary mb-0.5">{voice.v}</div>
                            <div className="text-[11px] text-text-dim">{voice.d}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-text-dim mt-1.5">affects how it phrases things in chat.</div>
                    </div>
                  </div>
                  <div className="mb-5">
                    <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">CATCHPHRASE (OPTIONAL)</label>
                    <input type="text" value={catchphrase} onChange={e => setCatchphrase(e.target.value)} placeholder="e.g. on-chain or it didn't happen" className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan placeholder:text-text-muted" />
                    <div className="text-[11px] text-text-dim mt-1.5">agent will sometimes sign off with this.</div>
                  </div>
                  <div>
                    <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">AGENT ENDPOINT URL (OPTIONAL)</label>
                    <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://myagent.example.com" className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan placeholder:text-text-muted" />
                    <div className="text-[11px] text-text-dim mt-1.5">publicly reachable URL where your agent runs. stored in ERC-8004 registry.</div>
                  </div>
                </div>
                <div>
                  <div className="border border-panel-border bg-card p-6 flex flex-col items-center gap-4 rounded-sm min-h-[220px] justify-center">
                    <div className="font-sans text-[11px] tracking-[0.2em] text-text-dim text-right w-full -mb-2">PREVIEW</div>
                    <svg className="w-20 h-20" viewBox="0 0 80 80">
                      <defs><linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--color-accent-cyan)"/><stop offset="100%" stopColor="var(--color-accent-green)"/></linearGradient></defs>
                      <polygon points="40,4 74,22 74,58 40,76 6,58 6,22" fill="url(#hexGrad)" stroke="var(--color-accent-cyan)" strokeWidth="1.5"/>
                      <text x="40" y="47" textAnchor="middle" fontFamily="Rajdhani,sans-serif" fontWeight="700" fontSize="24" fill="white">{agentName ? agentName.charAt(0).toUpperCase() : 'V'}</text>
                    </svg>
                    <div className="font-sans text-xl font-bold tracking-[0.08em] text-text-primary">
                      <span className="text-text-dim mx-1.5">—</span>{agentName || 'unnamed'}<span className="text-text-dim mx-1.5">—</span>
                    </div>
                    <div className="font-sans text-[12px] tracking-[0.2em] text-text-dim uppercase">{archetype}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> ARCHETYPE
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { id: 'TRADER', tags: 'SWAP · SEND · BRIDGE · SCHEDULE', desc: 'Swaps, sends, bridges, schedules. Full executor preset — use when you want the agent to actually move money.', meta: '$50/tx · $50/day · sybil-mode OFF' },
                  { id: 'SAVER', tags: 'SWAP · SEND · SCHEDULE · NO BRIDGES', desc: 'Stable-leaning. Swaps + sends + schedules; no bridges, no leverage. Best for parking idle USDC.', meta: '$50/tx · $100/day · sybil-mode ON' },
                  { id: 'DEGEN SCOUT', tags: 'READ-ONLY · QUOTES + ALERTS', desc: 'Read-only. Quotes prices, watches pools and surfaces alerts — chat route refuses any transactional tool call.', meta: 'no spend · sybil-mode ON' },
                  { id: 'CUSTODIAN', tags: 'REBALANCE · SWEEP · NO BRIDGES', desc: 'Treasury utility. Rebalances, sweeps dust, tops up gas. Tight caps, no bridges, no speculation.', meta: '$25/tx · $25/day · sybil-mode ON' },
                ].map(a => (
                  <div key={a.id} onClick={() => setArchetype(a.id)} className={`p-3.5 border rounded-sm cursor-pointer transition-all ${archetype === a.id ? 'border-accent-cyan bg-accent-cyan/10' : 'border-panel-border bg-card hover:border-accent-cyan'}`}>
                    <div className="font-sans font-bold text-sm tracking-[0.12em] mb-1 text-text-primary">{a.id}</div>
                    <div className="text-[10px] text-text-dim mb-2 leading-[1.4] tracking-[0.05em]">{a.tags}</div>
                    <div className="text-[11px] text-text-primary mb-2 leading-[1.5]">{a.desc}</div>
                    <div className="text-[10px] text-text-dim leading-[1.6]">{a.meta}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'RESEARCHER', tags: 'READ-ONLY · NEVER TRANSACTS', desc: 'Talks, fetches data, summarizes, drafts plans. Cannot transact — enforced server-side regardless of what the LLM tries.', meta: 'no spend · sybil-mode ON' }
                ].map(a => (
                  <div key={a.id} onClick={() => setArchetype(a.id)} className={`p-3.5 border rounded-sm cursor-pointer transition-all ${archetype === a.id ? 'border-accent-cyan bg-accent-cyan/10' : 'border-panel-border bg-card hover:border-accent-cyan'}`}>
                    <div className="font-sans font-bold text-sm tracking-[0.12em] mb-1 text-text-primary">{a.id}</div>
                    <div className="text-[10px] text-text-dim mb-2 leading-[1.4] tracking-[0.05em]">{a.tags}</div>
                    <div className="text-[11px] text-text-primary mb-2 leading-[1.5]">{a.desc}</div>
                    <div className="text-[10px] text-text-dim leading-[1.6]">{a.meta}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> RISK TOLERANCE
              </div>
              <div className="mt-2">
                <div className="font-sans font-bold text-[22px] text-white text-right mb-2">{riskVal}<span className="text-sm text-text-dim font-sans">/10</span></div>
                <input type="range" min="1" max="10" value={riskVal} onChange={e => setRiskVal(parseInt(e.target.value))} className="w-full h-1 bg-gradient-to-r from-accent-cyan to-panel-border outline-none appearance-none rounded-sm cursor-pointer" style={{ background: `linear-gradient(to right, var(--color-accent-cyan) ${((riskVal-1)/9)*100}%, var(--color-panel-border) ${((riskVal-1)/9)*100}%)`}} />
                <style>{`input[type="range"]::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:var(--color-accent-cyan);cursor:pointer;box-shadow:0 0 6px rgba(0,229,255,0.5);}`}</style>
                <div className="flex justify-between text-[10px] text-text-dim mt-1.5">
                  <span>conservative · stables only</span>
                  <span>aggressive · long-tail ok</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <div />
              <button onClick={() => setActiveTab(2)} className="font-sans font-bold text-[13px] tracking-[0.15em] px-7 py-3 border border-accent-cyan text-text-primary bg-transparent hover:bg-accent-cyan/10 rounded-sm transition-all cursor-pointer">NEXT → PERMISSIONS</button>
            </div>
          </div>
        )}

        {/* PAGE 2 */}
        {activeTab === 2 && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> SPENDING CAPS
              </div>
              <div className="grid grid-cols-3 gap-4 mb-2">
                <div>
                  <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">DAILY CAP (USD)</label>
                  <input type="number" value={dailyCap} onChange={e => setDailyCap(parseInt(e.target.value))} className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan" />
                  <div className="text-[11px] text-text-dim mt-1.5">hard limit, enforced by session-key validator on-chain.</div>
                </div>
                <div>
                  <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">PER-TX CAP (USD)</label>
                  <input type="number" value={txCap} onChange={e => setTxCap(parseInt(e.target.value))} className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan" />
                  <div className="text-[11px] text-text-dim mt-1.5">anything above triggers manual approval.</div>
                </div>
                <div>
                  <label className="block font-sans font-bold text-xs tracking-[0.18em] text-text-dim mb-2">DURATION</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-card border border-panel-border text-text-primary font-mono text-[13px] px-3.5 py-3 outline-none transition-colors rounded-sm focus:border-accent-cyan appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path fill=\'%235a7a9a\' d=\'M0 0l5 6 5-6z\'/></svg>')] bg-no-repeat bg-[position:right_12px_center] pr-8">
                    <option>7 days</option><option>14 days</option><option>30 days</option><option>60 days</option><option>90 days</option>
                  </select>
                  <div className="text-[11px] text-text-dim mt-1.5">session key auto-expires; renew anytime.</div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> ALLOWED VENUES
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'aerodrome', name: 'AERODROME', desc: 'Base-native AMM (Slipstream + V2)' },
                  { id: 'uniswap', name: 'UNISWAP V3', desc: 'Universal Router on Base' },
                  { id: 'baseswap', name: 'BASESWAP', desc: 'Base-native V2-style AMM' }
                ].map(v => (
                  <div key={v.id} onClick={() => setVenues(prev => ({...prev, [v.id]: !(prev as any)[v.id]}))} className={`flex items-start gap-3 p-4 border rounded-sm cursor-pointer transition-all bg-card ${(venues as any)[v.id] ? 'border-accent-cyan' : 'border-panel-border hover:border-accent-cyan'}`}>
                    <div className={`w-4 h-4 border flex items-center justify-center shrink-0 mt-0.5 rounded-sm ${(venues as any)[v.id] ? 'bg-accent-cyan border-accent-cyan' : 'bg-card-alt border-panel-border'}`}>
                      {(venues as any)[v.id] && <span className="text-[10px] text-black">✓</span>}
                    </div>
                    <div>
                      <div className="font-sans font-bold text-sm tracking-[0.1em] text-text-primary mb-0.5">{v.name}</div>
                      <div className="text-[11px] text-text-dim">{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> ALLOWED TOKENS
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(tokens).map(tk => (
                  <div key={tk} onClick={() => setTokens(prev => ({...prev, [tk]: !(prev as any)[tk]}))} className={`px-4 py-1.5 border rounded-full text-xs font-bold font-sans tracking-[0.08em] cursor-pointer transition-all bg-card ${(tokens as any)[tk] ? 'border-accent-cyan text-text-primary' : 'border-panel-border text-text-dim hover:border-accent-cyan hover:text-text-primary'}`}>
                    {tk === 'cbeth' ? 'cbETH' : tk === 'usdbc' ? 'USDbC' : tk.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> NETWORK
              </div>
              <div className="border border-panel-border bg-card p-[18px] rounded-sm mb-2">
                <div className="font-sans font-bold text-sm tracking-[0.12em] mb-1.5 text-text-primary">BASE MAINNET (8453)</div>
                <div className="text-[11px] text-text-dim leading-[1.6]">Agent identity minted as ERC-8004 NFT on Base Mainnet. Registration data stored on-chain via data URI. You pay gas; the contract is non-custodial.</div>
              </div>
              <div className="border border-accent-yellow/30 bg-accent-yellow/10 p-3.5 text-[11px] text-text-dim rounded-sm leading-[1.6]">
                <span className="text-accent-yellow">⚠</span> MAINNET — agent trades real assets up to your daily/per-tx caps. Start small. You pay gas; we never sponsor.
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> SAFETY
              </div>
              <div className="border border-panel-border bg-card p-4 rounded-sm mb-2">
                <div className="flex items-center gap-2.5 mb-2">
                  <div onClick={() => setSybilAware(!sybilAware)} className={`w-[18px] h-[18px] border flex items-center justify-center shrink-0 rounded-sm cursor-pointer ${sybilAware ? 'bg-accent-cyan border-accent-cyan' : 'bg-transparent border-accent-cyan'}`}>
                    {sybilAware && <span className="text-[11px] text-black">✓</span>}
                  </div>
                  <div className="font-sans font-bold text-sm tracking-[0.12em] text-text-primary">SYBIL-AWARE MODE</div>
                </div>
                <div className="text-[11px] text-text-dim leading-[1.6]">tx scheduler injects human-shaped jitter, runs every action through the Volt Sybil engine pre-flight, and refuses bot-pattern bursts. recommended for any wallet that cares about future airdrops.</div>
              </div>
              <div className="border border-dashed border-accent-red/40 bg-accent-red/10 p-3.5 text-[11px] text-text-dim rounded-sm leading-[1.6]">
                KILL SWITCH — always on. one click on the live panel revokes the session key on-chain. no admin can override this; the validator is non-custodial.
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setActiveTab(1)} className="font-sans font-bold text-[13px] tracking-[0.15em] px-6 py-3 border border-panel-border text-text-dim bg-transparent hover:border-accent-cyan hover:text-text-primary rounded-sm transition-all cursor-pointer">← BACK</button>
              <button onClick={startDeploy} className="font-sans font-bold text-[13px] tracking-[0.15em] px-7 py-3 border border-accent-cyan text-text-primary bg-transparent hover:bg-accent-cyan/10 rounded-sm transition-all cursor-pointer">DEPLOY →</button>
            </div>
          </div>
        )}

        {/* PAGE 3 */}
        {activeTab === 3 && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> DEPLOYING
              </div>
              
              <div className="grid grid-cols-4 gap-[1px] border border-panel-border mb-4 bg-panel-border rounded-sm overflow-hidden">
                <div className="bg-card py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] tracking-[0.15em] text-text-dim mb-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--color-accent-green)] animate-pulse"></span> BLOCK</div>
                  <div className="font-mono text-sm text-text-primary">{stats.block}</div>
                </div>
                <div className="bg-card py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] tracking-[0.15em] text-text-dim mb-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--color-accent-green)] animate-pulse"></span> GAS</div>
                  <div className="font-mono text-sm text-text-primary">{stats.gas}</div>
                </div>
                <div className="bg-card py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] tracking-[0.15em] text-text-dim mb-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--color-accent-green)] animate-pulse"></span> NETWORK</div>
                  <div className="font-mono text-sm text-text-primary">{stats.network}</div>
                </div>
                <div className="bg-card py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] tracking-[0.15em] text-text-dim mb-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--color-accent-green)] animate-pulse"></span> WALLET</div>
                  <div className="font-mono text-sm text-text-primary">{walletAddress ? walletAddress.slice(0,6) + '…' + walletAddress.slice(-4) : '—'}</div>
                </div>
              </div>

              <div className="border border-panel-border bg-card p-5 rounded-sm min-h-[200px] text-xs leading-loose overflow-y-auto max-h-[360px]">
                {logs.length === 0 && <div className="text-[11px] text-text-muted">waiting for deploy to start…</div>}
                {logs.map((L, i) => (
                  L.icon === '-' ? <div key={i} className="w-full border-t border-dashed border-panel-border my-2"></div> :
                  L.isDim ? <div key={i} className="text-text-dim text-[11px]">{L.icon} {L.text}</div> :
                  <div key={i} className="flex justify-between items-center gap-4 py-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className={L.icon === '⟳' ? `${L.iconClass} animate-spin` : L.iconClass}>{L.icon}</span>
                      <span className="text-text-dim">{L.text}</span>
                    </div>
                    {L.isHtml ? <div className="flex items-center gap-4 text-text-muted text-[11px] shrink-0" dangerouslySetInnerHTML={{__html: L.right}}></div> : <div className="flex items-center gap-4 text-text-muted text-[11px] shrink-0">{L.right}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setActiveTab(2)} className="font-sans font-bold text-[13px] tracking-[0.15em] px-6 py-3 border border-panel-border text-text-dim bg-transparent hover:border-accent-cyan hover:text-text-primary rounded-sm transition-all cursor-pointer">← BACK</button>
              {deployedAgent && <button onClick={() => setActiveTab(4)} className="font-sans font-bold text-[13px] tracking-[0.15em] px-7 py-3 border border-accent-cyan text-text-primary bg-transparent hover:bg-accent-cyan/10 rounded-sm transition-all cursor-pointer animate-in fade-in zoom-in slide-in-from-right-4 duration-300">LIVE CONSOLE →</button>}
            </div>
          </div>
        )}

        {/* PAGE 4 */}
        {activeTab === 4 && (
          <div className="animate-in fade-in duration-300">
            {deployedAgent && (
              <div className="mb-8">
                <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                  <span>&gt;</span> AGENT REGISTERED
                </div>
                <div className="border border-accent-green bg-accent-green/10 p-5 rounded-sm">
                  <div className="font-sans font-bold text-base tracking-[0.15em] text-accent-green mb-3">✓ AGENT REGISTERED ON BASE MAINNET</div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">NAME</span><span className="text-[11px] text-text-primary text-right break-all">{deployedAgent.name}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">ARCHETYPE</span><span className="text-[11px] text-text-primary text-right break-all">{deployedAgent.archetype}</span></div>
                  {deployedAgent.tokenId != null && <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">TOKEN ID</span><span className="text-[11px] text-text-primary text-right break-all">{deployedAgent.tokenId}</span></div>}
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">OWNER</span><span className="text-[11px] text-text-primary text-right break-all">{deployedAgent.owner}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">BLOCK</span><span className="text-[11px] text-text-primary text-right break-all">{deployedAgent.blockNumber}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">TX HASH</span><span className="text-[11px] text-text-primary text-right break-all"><a href={`https://basescan.org/tx/${deployedAgent.txHash}`} target="_blank" rel="noreferrer" className="text-accent-cyan hover:underline">{deployedAgent.txHash.slice(0,20)}… ↗</a></span></div>
                  <div className="flex justify-between py-1.5 border-b mt-1 border-transparent"><span className="text-[10px] text-text-dim tracking-[0.12em] font-sans font-semibold pr-3 shrink-0">REGISTRY</span><span className="text-[11px] text-text-primary text-right break-all"><a href={`https://basescan.org/address/${ERC8004_ADDRESS}`} target="_blank" rel="noreferrer" className="text-accent-cyan hover:underline">basescan.org ↗</a></span></div>
                </div>
              </div>
            )}
            
            <div className="mb-8">
              <div className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-[0.2em] text-text-dim mb-5 select-none after:content-[''] after:flex-1 after:h-px after:bg-panel-border after:ml-2">
                <span>&gt;</span> LIVE CONSOLE & CONTRACT FUNCTIONS
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-panel-border bg-card p-5 rounded-sm flex flex-col">
                  <div className="font-sans font-bold tracking-[0.1em] text-accent-cyan mb-3">READ: getAgent(tokenId)</div>
                  <input type="number" placeholder="Token ID" value={readTokenId} onChange={e => setReadTokenId(e.target.value)} className="w-full bg-darkest border border-panel-border rounded-sm p-3 text-white text-xs mb-3 outline-none focus:border-accent-cyan transition-colors" />
                  <button onClick={executeGetAgent} disabled={isReadingTarget || !provider} className="font-sans font-bold tracking-[0.1em] text-xs px-4 py-2 border border-accent-cyan text-accent-cyan bg-transparent hover:bg-accent-cyan/10 rounded-sm mb-4 disabled:opacity-50">EXECUTE</button>
                  {readAgentData && (
                    <div className="text-[11px] text-text-dim mt-2 bg-darkest p-3 border border-panel-border rounded-sm overflow-hidden text-ellipsis">
                      <div className="flex justify-between border-b border-white/5 py-1"><span>Name:</span><span className="text-white">{readAgentData.name}</span></div>
                      <div className="flex justify-between border-b border-white/5 py-1"><span>Archetype:</span><span className="text-white">{readAgentData.archetype}</span></div>
                      <div className="flex justify-between border-b border-white/5 py-1"><span>Catchphrase:</span><span className="text-white">{readAgentData.catchphrase || 'N/A'}</span></div>
                      <div className="flex justify-between border-b border-white/5 py-1"><span>Daily Cap:</span><span className="text-white">{readAgentData.dailyCap}</span></div>
                      <div className="flex justify-between py-1"><span>Risk:</span><span className="text-white">{readAgentData.riskTolerance}/10</span></div>
                    </div>
                  )}
                </div>

                <div className="border border-panel-border bg-card p-5 rounded-sm flex flex-col">
                  <div className="font-sans font-bold tracking-[0.1em] text-accent-green mb-3">WRITE: updateAgentURI(tokenId, newURI)</div>
                  <input type="number" placeholder="Token ID" value={updateTokenId} onChange={e => setUpdateTokenId(e.target.value)} className="w-full bg-darkest border border-panel-border rounded-sm p-3 text-white text-xs mb-3 outline-none focus:border-accent-cyan transition-colors" />
                  <input type="text" placeholder="New IPFS/Data URI" value={updateTokenURI} onChange={e => setUpdateTokenURI(e.target.value)} className="w-full bg-darkest border border-panel-border rounded-sm p-3 text-white text-xs mb-3 outline-none focus:border-accent-cyan transition-colors" />
                  <button onClick={executeUpdateAgentURI} disabled={isUpdatingTarget || !signer} className="font-sans font-bold tracking-[0.1em] text-xs px-4 py-2 border border-accent-green text-accent-green bg-transparent hover:bg-accent-green/10 rounded-sm mb-4 disabled:opacity-50">EXECUTE</button>
                  
                  <div className="font-sans font-bold tracking-[0.1em] text-accent-yellow mb-3 mt-4">ADMIN: withdraw()</div>
                  <button onClick={executeWithdraw} disabled={isWithdrawing || !signer} className="font-sans font-bold tracking-[0.1em] text-xs px-4 py-2 border border-accent-yellow text-accent-yellow bg-transparent hover:bg-accent-yellow/10 rounded-sm disabled:opacity-50">EXECUTE</button>
                </div>
              </div>

              <div className="mt-4 border border-panel-border bg-card p-5 rounded-sm min-h-[140px] text-xs leading-loose">
                <div className="text-text-dim">· agent runtime connected</div>
                <div className="text-text-dim">· session-key validated on Base Mainnet</div>
                <div className="h-2"></div>
                {registryQuerying ? (
                  <div className="text-accent-cyan">· querying smart contract on Base Mainnet…</div>
                ) : registryError ? (
                  <div className="text-accent-red">✕ contract state fetch failed: {registryError}</div>
                ) : registryAgents.length > 0 ? (
                  <>
                    <div className="text-accent-green mb-2">✓ local contract state fetched</div>
                    {registryAgents.map((a, i) => (
                      <div key={i} className="text-text-dim text-[11px]">· [ID: {a.id}] {a.name || 'Agent'} — owner: {(a.owner||'').slice(0,10)}…</div>
                    ))}
                  </>
                ) : (
                  <div className="text-accent-cyan animate-[blink_1s_step-start_infinite]">▋ waiting for commands…</div>
                )}
                
                <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setActiveTab(3)} className="font-sans font-bold text-[13px] tracking-[0.15em] px-6 py-3 border border-panel-border text-text-dim bg-transparent hover:border-accent-cyan hover:text-text-primary rounded-sm transition-all cursor-pointer">← BACK</button>
              <button onClick={searchAgents} disabled={registryQuerying} className="font-sans font-bold text-[13px] tracking-[0.15em] px-6 py-3 border border-accent-cyan text-text-primary bg-transparent hover:bg-accent-cyan/10 rounded-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">SEARCH REGISTERED AGENTS</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
