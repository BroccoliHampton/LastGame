import { ethers } from 'ethers';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { player } = req.query; // 'player' is the user's address, 'provider' (referral) is now an ENV var

    if (!player) {
      return res.status(400).json({ error: 'Player address required' });
    }

    // --- FIX START: Use Environment Variable for the provider address ---
    const REFERRAL_PROVIDER_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
    
    if (!REFERRAL_PROVIDER_ADDRESS || !ethers.utils.isAddress(REFERRAL_PROVIDER_ADDRESS)) {
        console.error('Missing or invalid YOUR_WALLET_ADDRESS environment variable.');
        return res.status(500).json({ error: 'Server configuration error: Missing provider address.' });
    }
    
    const providerAddress = REFERRAL_PROVIDER_ADDRESS;
    console.log('Using referral provider address:', providerAddress);
    // --- FIX END ---
    
    // Contract addresses
    const MINER_ADDRESS = '0x3EE441030984ACfeCf17FDa6953bea00a8c53Fa7';
    
    // Miner ABI - just the mine function
    const MINER_ABI = [
      'function mine(address provider) external payable'
    ];

    // Get current price from blockchain - using ethers v5 syntax
    const RPC_URL = 'https://mainnet.base.org';
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    const minerContract = new ethers.Contract(MINER_ADDRESS, [
      'function getPrice() external view returns (uint256)'
    ], providerRpc);

    const price = await minerContract.getPrice();
    
    console.log('Current price from contract:', price.toString());

    // Encode the transaction data - using ethers v5 syntax
    const iface = new ethers.utils.Interface(MINER_ABI);
    // The providerAddress variable now holds the value of YOUR_WALLET_ADDRESS
    const data = iface.encodeFunctionData('mine', [providerAddress]); 

    // Convert price to hex format properly
    const valueInHex = '0x' + price.toBigInt().toString(16);
    
    console.log('Price in wei:', price.toString());
    console.log('Price in hex:', valueInHex);

    // Return transaction params in the format Farcaster expects
    const txData = {
      chainId: 'eip155:8453', // Base chain ID in CAIP-2 format
      method: 'eth_sendTransaction',
      params: {
        abi: MINER_ABI,
        to: MINER_ADDRESS,
        data: data,
        value: valueInHex,
      }
    };

    console.log('Returning transaction data:', JSON.stringify(txData, null, 2));

    return res.status(200).json(txData);

  } catch (error) {
    console.error('Transaction API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to create transaction',
      details: error.message 
    });
  }
}
