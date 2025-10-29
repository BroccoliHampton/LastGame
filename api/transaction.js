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
    const { player } = req.query;

    if (!player) {
      return res.status(400).json({ error: 'Player address required' });
    }

    // --- CONFIGURATION ---
    const MINER_ADDRESS = '0x3EE441030984ACfeCf17FDa6953bea00a8c53Fa7';
    const RPC_URL = 'https://mainnet.base.org';
    const REFERRAL_PROVIDER_ADDRESS = process.env.YOUR_WALLET_ADDRESS; // Your Vercel ENV var

    if (!REFERRAL_PROVIDER_ADDRESS || !ethers.utils.isAddress(REFERRAL_PROVIDER_ADDRESS)) {
        console.error('Missing or invalid YOUR_WALLET_ADDRESS environment variable.');
        // Fallback to AddressZero if ENV is missing (if the contract allows it)
        const providerAddress = ethers.constants.AddressZero;
        console.log('Falling back to AddressZero for provider.');
    }
    const providerAddress = REFERRAL_PROVIDER_ADDRESS;
    // --- END CONFIGURATION ---

    // --- 1. CORRECTED MINER ABI ---
    const MINER_ABI = [
      'function mine(address miner, address provider, uint256 epochId, uint256 deadline, uint256 maxPrice, string memory uri) external payable'
    ];
    
    const slot0Abi = ['function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, uint256 dps, address miner, string uri))'];
    
    // Setup Ethers
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    const minerContract = new ethers.Contract(MINER_ADDRESS, MINER_ABI.concat(['function getPrice() external view returns (uint256)']).concat(slot0Abi), providerRpc);

    // --- 2. FETCH PRICE & SLOT0 ---
    const [price, slot0] = await Promise.all([
        minerContract.getPrice(),
        minerContract.getSlot0(),
    ]);
    
    console.log('Current price from contract:', price.toString());

    // --- 3. CALCULATE TRANSACTION PARAMETERS ---
    const currentTime = Math.floor(Date.now() / 1000);

    const params = [
        player,                             // 1. miner: The user's address (new miner)
        providerAddress,                    // 2. provider: Your referral address
        slot0.epochId,                      // 3. epochId: Current epoch ID
        currentTime + 300,                  // 4. deadline: 5 minutes from now
        price,                              // 5. maxPrice: Current price (no slippage allowed)
        "Donut Miner on Farcaster"          // 6. uri: The URI string
    ];

    // --- 4. ENCODE FUNCTION DATA ---
    const iface = new ethers.utils.Interface(MINER_ABI);
    const data = iface.encodeFunctionData('mine', params);

    // Convert price to hex format properly
    const valueInHex = '0x' + price.toBigInt().toString(16);
    
    console.log('Price in wei:', price.toString());
    console.log('Price in hex:', valueInHex);

    // Return transaction params
    const txData = {
      chainId: 'eip155:8453', // Base chain ID
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
