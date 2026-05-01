import { EIP6963ProviderDetail } from '../hooks/useEIP6963';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: EIP6963ProviderDetail[];
  onConnect: (provider: any) => void;
}

export default function WalletModal({ isOpen, onClose, providers, onConnect }: WalletModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
      <div className="bg-dark border border-panel-border p-7 w-[380px] rounded animate-in fade-in zoom-in-95 duration-200">
        <button className="float-right bg-transparent border-none text-text-dim cursor-pointer text-lg -mt-1.5 hover:text-text-primary" onClick={onClose}>✕</button>
        <div className="font-sans font-bold text-base tracking-[0.15em] mb-5 text-text-primary">CONNECT WALLET</div>
        
        {providers.length > 0 ? (
          providers.map((p) => (
            <div key={p.info.uuid} className="flex items-center gap-3.5 p-3.5 border border-panel-border rounded-sm cursor-pointer mb-2 transition-all bg-card hover:border-accent-cyan" onClick={() => onConnect(p.provider)}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                <img src={p.info.icon} alt={p.info.name} className="w-6 h-6 rounded" />
              </div>
              <div>
                <div className="font-sans font-bold text-sm tracking-[0.08em]">{p.info.name}</div>
                <div className="text-[11px] text-text-dim">Injected Wallet</div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-3.5 p-3.5 border border-panel-border rounded-sm cursor-pointer mb-2 transition-all bg-card hover:border-accent-cyan" onClick={() => onConnect((window as any).ethereum)}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg bg-[#f6851b20] shrink-0">🦊</div>
            <div>
              <div className="font-sans font-bold text-sm tracking-[0.08em]">Browser Wallet</div>
              <div className="text-[11px] text-text-dim">Fallback (window.ethereum)</div>
            </div>
          </div>
        )}

        <div className="mt-3 text-[10px] text-text-muted leading-[1.6]">
          Transactions happen on Base Mainnet (chainId: 8453). Agent NFT registration costs ~$1.10 in ETH.
        </div>
      </div>
    </div>
  );
}
