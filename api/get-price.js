//
// api/get-price.js - Updated to use new Multicall contract
//
const { ethers } = require("ethers");

// --- CONFIGURATION - UPDATED ADDRESSES ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL; 
const MULTICALL_ADDRESS = '0xe03a89eb8b75d73Caf762a81dA260106fD42F18A'; // NEW!
const DONUT_ADDRESS = '0x9E6702D8DEad349062945093f1c8a945CA111E73';     // NEW!

const multicallAbi = [
  `function getMiner(address account) external view returns (
    tuple(
      uint16 epochId,
      uint192 initPrice,
      uint40 startTime,
      uint256 glazed,
      uint256 price,
      uint256 dps,
      uint256 nextDps,
      address miner,
      string uri,
      uint256 ethBalance,
      uint256 wethBalance,
      uint256 donutBalance
    ) state
  )`
];

const donutAbi = [
  "function allowance(address owner, address spender) external view returns (uint256)"
];
// --- END CONFIGURATION ---

let readOnlyProvider;
let multicallContract;
let donutContract;

// Initialize providers and contracts outside the handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, readOnlyProvider);
    donutContract = new ethers.Contract(DONUT_ADDRESS, donutAbi, readOnlyProvider);
  } catch (e) {
    console.error("[get-price] FAILED to create read-only provider:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[get-price] API called");
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // userAddress is optional
  const { userAddress } = req.query;

  if (!multicallContract || !donutContract) {
    console.error("[get-price] Provider or contract not initialized. Check BASE_PROVIDER_URL env var.");
    return res.status(500).json({ error: "Server configuration error: Failed to connect to network." });
  }

  try {
    // Fetch price and epoch from Multicall using zero address for public data
    const minerState = await multicallContract.getMiner(ethers.constants.AddressZero);
    
    const price = minerState.price;
    const epochId = minerState.epochId;
    const priceInEth = ethers.utils.formatEther(price);

    // If a userAddress is provided, also fetch DONUT allowance for the Multicall contract
    if (userAddress) {
      const checksummedAddress = ethers.utils.getAddress(userAddress);
      const allowance = await donutContract.allowance(checksummedAddress, MULTICALL_ADDRESS);
      
      console.log(`[get-price] Fetched data for user: ${price.toString()}, epoch: ${epochId}, allowance: ${allowance.toString()}`);
      
      res.status(200).json({
        price: price.toString(),
        epochId: Number(epochId),
        priceInEth: priceInEth,
        allowance: allowance.toString()
      });

    } else {
      // If no userAddress, just return public price info
      console.log(`[get-price] Fetched public price: ${price.toString()}, epoch: ${epochId}`);
      
      res.status(200).json({
        price: price.toString(),
        epochId: Number(epochId),
        priceInEth: priceInEth,
        allowance: null // No allowance to fetch
      });
    }

  } catch (error) {
    console.error("[get-price] Error fetching data from contract:", error.message);
    res.status(500).json({ error: `Contract read error: ${error.message}` });
  }
};
