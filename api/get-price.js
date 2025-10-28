//
// This is the full content for api/get-price.js (v4 - with CORS)
//
const { ethers } = require("ethers");

// --- START CONFIGURATION ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL; 
const CONTRACT_ADDRESS = '0x9c751e6825edaa55007160b99933846f6eceec9b';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const contractAbi = [
  "function getPrice() external view returns (uint256)",
  "function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, address owner, string uri))"
];
const usdcAbi = [
  "function allowance(address owner, address spender) external view returns (uint256)"
];
// --- END CONFIGURATION ---

let readOnlyProvider;
let readOnlyGameContract;
let readOnlyUsdcContract;

// Initialize providers and contracts outside the handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    readOnlyGameContract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, readOnlyProvider);
    readOnlyUsdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, readOnlyProvider);
  } catch (e) {
    console.error("[get-price] FAILED to create read-only provider:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[v4] /api/get-price called");
  
  // Add CORS headers to allow requests from your game domain
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins, or specify your game domain
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- NEW: userAddress is now optional ---
  const { userAddress } = req.query;

  if (!readOnlyGameContract || !readOnlyUsdcContract) {
    console.error("[get-price] Provider or contract not initialized. Check BASE_PROVIDER_URL env var.");
    return res.status(500).json({ error: "Server configuration error: Failed to connect to network." });
  }

  try {
    // 1. Always fetch price and slot0
    const [price, slot0] = await Promise.all([
      readOnlyGameContract.getPrice(),
      readOnlyGameContract.getSlot0(),
    ]);
    
    const epochId = slot0.epochId;
    const priceInUsdc = ethers.utils.formatUnits(price, 6);

    // 2. If a userAddress is provided, ALSO fetch allowance
    if (userAddress) {
      const checksummedAddress = ethers.utils.getAddress(userAddress);
      const allowance = await readOnlyUsdcContract.allowance(checksummedAddress, CONTRACT_ADDRESS);
      
      console.log(`[get-price] Fetched data for user: ${price.toString()}, epoch: ${epochId}, allowance: ${allowance.toString()}`);
      
      res.status(200).json({
        price: price.toString(),
        epochId: Number(epochId),
        priceInUsdc: priceInUsdc,
        allowance: allowance.toString()
      });

    } else {
      // 3. If no userAddress, just return public price info
      console.log(`[get-price] Fetched public price: ${price.toString()}, epoch: ${epochId}`);
      
      res.status(200).json({
        price: price.toString(),
        epochId: Number(epochId),
        priceInUsdc: priceInUsdc,
        allowance: null // No allowance to fetch
      });
    }

  } catch (error) {
    console.error("[get-price] Error fetching data from contract:", error.message);
    res.status(500).json({ error: `Contract read error: ${error.message}` });
  }
};
