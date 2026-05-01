import { ethers } from 'ethers';
async function run() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const code = await provider.getCode('0x434B04634C542Be57fe21C1E1C46d3Cad492e496');
  console.log('Code length:', code.length);
}
run();
