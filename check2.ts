import { ethers, Contract } from 'ethers';
async function run() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const ERC8004_ABI = [
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
    }
  ];
  const contract = new Contract('0x434B04634C542Be57fe21C1E1C46d3Cad492e496', ERC8004_ABI, provider);
  for (let i = 0; i < 5; i++) {
    try {
      const data = await contract.getAgent(i);
      console.log('Token', i, data);
    } catch (e) {
      console.log('Token', i, 'failed');
    }
  }
}
run();
