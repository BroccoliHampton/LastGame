import { ethers } from 'ethers';

// Full ABI for the Wrapper/Multicall contract (0x0d6fC0Cf23F0B78B1280c4037cA9B47F13Ca19e4)
const WRAPPER_ABI = [{"inputs":[{"internalType":"address","name":"_miner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"donut","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"getMiner","outputs":[{"components":[{"internalType":"uint16","name":"epochId","type":"uint16"},{"internalType":"uint192","name":"initPrice","type":"uint192"},{"internalType":"uint40","name":"startTime","type":"uint40"},{"internalType":"uint256","name":"glazed","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"dps","type":"uint256"},{"internalType":"uint256","name":"nextDps","type":"uint256"},{"internalType":"address","name":"miner","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"uint256","name":"ethBalance","type":"uint256"},{"internalType":"uint256","name":"wethBalance","type":"uint256"},{"internalType":"uint256","name":"donutBalance","type":"uint256"}],"internalType":"struct Multicall.MinerState","name":"state","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"provider","type":"address"},{"internalType":"uint256","name":"epochId","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"maxPrice","uint256":"type"},{"internalType":"string","name":"uri","type":"string"}],"name":"mine","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"miner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"quote","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];

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
    // Target the new Wrapper/Multicall address for ALL interactions
    const WRAPPER_ADDRESS = '0x0d6fC0Cf23F0B78B1280c4037cA9B47F13Ca19e4'; 
    const RPC_URL = 'https://mainnet.base.org';
    const REFERRAL_PROVIDER_ADDRESS = process.env.YOUR_WALLET_ADDRESS; 

    if (!REFERRAL_PROVIDER_ADDRESS || !ethers.utils.isAddress(REFERRAL_PROVIDER_ADDRESS)) {
        console.error('Missing or invalid YOUR_WALLET_ADDRESS environment variable. Falling back to AddressZero.');
    }
    const providerAddress = REFERRAL_PROVIDER_ADDRESS || ethers.constants.AddressZero;
    // --- END CONFIGURATION ---

    // --- ABIs ---
    // Human-readable ABI for the function we are encoding for the transaction
    const MINE_FUNCTION_ABI = ['function mine(address provider, uint256 epochId, uint256 deadline, uint256 maxPrice, string memory uri) external payable'];
    // Human-readable ABI for the function we are reading price from
    const GET_PRICE_ABI = ['function getMiner(address account) external view returns (tuple(uint16 epochId, uint192 initPrice, uint40 startTime, uint256 glazed, uint256 price, uint256 dps, uint256 nextDps, address miner, string uri, uint256 ethBalance, uint256 wethBalance, uint256 donutBalance) state)'];
    
    // Setup Ethers for read-only calls
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    // Use the contract instance to call read-only functions
    const wrapperContract = new ethers.Contract(WRAPPER_ADDRESS, GET_PRICE_ABI, providerRpc);
    
    // --- 2. FETCH PRICE & SLOT0 (Using the `getMiner` function for all state) ---
    // Fetch state for address zero to get the current global state (price, epochId)
    const slot0 = await wrapperContract.getMiner(ethers.constants.AddressZero);
    const price = slot0.price; // Assuming the 'price' field holds the current mine price
    
    console.log('Current price from contract:', price.toString());

    // --- 3. CALCULATE TRANSACTION PARAMETERS (5 parameters) ---
    const currentTime = Math.floor(Date.now() / 1000);

    const params = [
        providerAddress,                    // 1. provider: Your referral address
        slot0.epochId,                      // 2. epochId: Current epoch ID
        currentTime + 300,                  // 3. deadline: 5 minutes from now
        price,                              // 4. maxPrice: Current price (no slippage allowed)
        "Donut Miner on Farcaster"          // 5. uri: The URI string
    ];

    // --- 4. ENCODE FUNCTION DATA ---
    // We encode the standard mine() call 
    const iface = new ethers.utils.Interface(MINE_FUNCTION_ABI);
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
        abi: MINE_FUNCTION_ABI, // Use the mine ABI for wallet decoding
        to: WRAPPER_ADDRESS,    // Target the Wrapper/Multicall address
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
