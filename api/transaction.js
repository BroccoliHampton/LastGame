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

    // --- CONFIGURATION: NEW CONTRACT ADDRESSES ---
    // New Miner Address
    const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869'; 
    // New Multicall Address
    const MULTICALL_ADDRESS = '0x0d6fC0Cf23F0B78B1280c4037cA9B47F13Ca19e4'; 
    
    const RPC_URL = 'https://mainnet.base.org';
    const REFERRAL_PROVIDER_ADDRESS = process.env.YOUR_WALLET_ADDRESS;

    if (!REFERRAL_PROVIDER_ADDRESS || !ethers.utils.isAddress(REFERRAL_PROVIDER_ADDRESS)) {
        console.error('Missing or invalid YOUR_WALLET_ADDRESS environment variable. Falling back to AddressZero.');
        const providerAddress = ethers.constants.AddressZero;
    }
    const providerAddress = REFERRAL_PROVIDER_ADDRESS || ethers.constants.AddressZero;
    // --- END CONFIGURATION ---

    // --- ABIs ---
    // Miner ABI (to encode the inner call)
    const MINER_ABI = [
      'function mine(address provider, uint256 epochId, uint256 deadline, uint256 maxPrice, string memory uri) external payable'
    ];
    // Multicall ABI (to encode the wrapper call)
    const MULTICALL_ABI = [
      'function multicall(tuple(address target, uint256 value, bytes callData)[] calls) external payable returns (bytes[] memory results)'
    ];
    
    // Read-only ABIs for fetching parameters
    const slot0Abi = ['function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, uint256 dps, address miner, string uri))'];
    const priceAbi = ['function getPrice() external view returns (uint256)'];
    
    // Setup Ethers for read-only calls
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    // Use the read-only contract for fetching price/slot0
    const readOnlyMinerContract = new ethers.Contract(MINER_ADDRESS, MINER_ABI.concat(priceAbi).concat(slot0Abi), providerRpc);

    // --- 2. FETCH PRICE & SLOT0 ---
    const [price, slot0] = await Promise.all([
        readOnlyMinerContract.getPrice(),
        readOnlyMinerContract.getSlot0(),
    ]);
    
    console.log('Current price from contract:', price.toString());

    // --- 3. CALCULATE TRANSACTION PARAMETERS (5 parameters for mine) ---
    const currentTime = Math.floor(Date.now() / 1000);

    const mineParams = [
        providerAddress,                    // 1. provider: Your referral address
        slot0.epochId,                      // 2. epochId: Current epoch ID
        currentTime + 300,                  // 3. deadline: 5 minutes from now
        price,                              // 4. maxPrice: Current price (no slippage allowed)
        "Donut Miner on Farcaster"          // 5. uri: The URI string
    ];

    // --- 4. ENCODE MINER.mine() CALL DATA ---
    const mineIface = new ethers.utils.Interface(MINER_ABI);
    const mineCallData = mineIface.encodeFunctionData('mine', mineParams);

    // --- 5. ENCODE MULTICALL.multicall() WRAPPER DATA ---
    
    // The call to mine()
    const calls = [{
      target: MINER_ADDRESS,
      value: price, // The ETH value to be forwarded to the Miner contract
      callData: mineCallData,
    }];

    // Create the interface for the Multicall contract
    const multicallIface = new ethers.utils.Interface(MULTICALL_ABI);
    const multicallData = multicallIface.encodeFunctionData('multicall', [calls]);

    // The total value sent to Multicall is the sum of all 'value' fields in the calls array (just 'price' here)
    const totalValueInHex = '0x' + price.toBigInt().toString(16);
    
    console.log('Total Price in wei:', price.toString());
    console.log('Total Price in hex:', totalValueInHex);

    // Return final transaction parameters
    const txData = {
      chainId: 'eip155:8453', // Base chain ID
      method: 'eth_sendTransaction',
      params: {
        abi: MULTICALL_ABI, // IMPORTANT: Use Multicall ABI
        to: MULTICALL_ADDRESS, // IMPORTANT: Target Multicall contract
        data: multicallData, // Send the multicall-encoded data
        value: totalValueInHex, // Send the total ETH value
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
