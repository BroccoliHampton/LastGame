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

    // --- CONFIGURATION - UPDATED FOR NEW CONTRACTS ---
    const MULTICALL_ADDRESS = '0x0d6fC0Cf23F0B78B1280c4037cA9B47F13Ca19e4'; // NEW!
    const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869';     // NEW!
    const RPC_URL = 'https://mainnet.base.org';
    const REFERRAL_PROVIDER_ADDRESS = process.env.YOUR_WALLET_ADDRESS; // Your Vercel ENV var

    if (!REFERRAL_PROVIDER_ADDRESS || !ethers.utils.isAddress(REFERRAL_PROVIDER_ADDRESS)) {
        console.error('Missing or invalid YOUR_WALLET_ADDRESS environment variable.');
        // Fallback to AddressZero if ENV is missing (if the contract allows it)
        // NOTE: Ensure your contract allows address(0) if the ENV is not set.
        const providerAddress = ethers.constants.AddressZero;
        console.log('Falling back to AddressZero for provider.');
    }
    const providerAddress = REFERRAL_PROVIDER_ADDRESS;
    // --- END CONFIGURATION ---

    // --- MULTICALL ABI - mine() function + read functions ---
    const MULTICALL_ABI = [
      'function mine(address provider, uint256 epochId, uint256 deadline, uint256 maxPrice, string memory uri) external payable',
      'function getMiner(address account) external view returns (tuple(uint16 epochId, uint192 initPrice, uint40 startTime, uint256 glazed, uint256 price, uint256 dps, uint256 nextDps, address miner, string uri, uint256 ethBalance, uint256 wethBalance, uint256 donutBalance))'
    ];
    
    // Setup Ethers
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, providerRpc);

    // --- FETCH PRICE & EPOCH FROM MULTICALL ---
    // Use getMiner with zero address to get current game state
    const minerState = await multicallContract.getMiner(ethers.constants.AddressZero);
    const price = minerState.price;
    const epochId = minerState.epochId;
    
    console.log('Current price from contract:', price.toString());
    console.log('Current epoch ID:', epochId);

    // --- CALCULATE TRANSACTION PARAMETERS ---
    const currentTime = Math.floor(Date.now() / 1000);

    const params = [
        providerAddress,                    // 1. provider: Your referral address
        epochId,                            // 2. epochId: Current epoch ID
        currentTime + 300,                  // 3. deadline: 5 minutes from now
        price,                              // 4. maxPrice: Current price (no slippage allowed)
        "Donut Miner on Farcaster"          // 5. uri: The URI string
    ];

    // --- ENCODE FUNCTION DATA ---
    const iface = new ethers.utils.Interface(MULTICALL_ABI);
    const data = iface.encodeFunctionData('mine', params);

    // Convert price to hex format properly
    const valueInHex = '0x' + price.toBigInt().toString(16);
    
    console.log('Price in wei:', price.toString());
    console.log('Price in hex:', valueInHex);

    // Return transaction params - NOW POINTING TO MULTICALL
    const txData = {
      chainId: 'eip155:8453', // Base chain ID
      method: 'eth_sendTransaction',
      params: {
        abi: MULTICALL_ABI,
        to: MULTICALL_ADDRESS,  // Changed from MINER_ADDRESS to MULTICALL_ADDRESS
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
