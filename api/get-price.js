//
// This is the full content for the NEW file: api/get-price.js
//
const { ethers } = require("ethers");

// --- START CONFIGURATION ---
// We'll re-use the BASE_PROVIDER_URL you set for the verify.js file.
// Make sure this is set in Vercel (e.g., your Alchemy URL)
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL; 
const CONTRACT_ADDRESS = '0x9C751E6825EDAa55007160b99933846f6ECeEc9B';
const contractAbi = [
  "function getPrice() external view returns (uint256)",
  "function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, address owner, string uri))"
];
// --- END CONFIGURATION ---

let readOnlyProvider;
let readOnlyGameContract;

// Initialize provider and contract outside the handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    readOnlyGameContract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, readOnlyProvider);
  } catch (e) {
    console.error("[get-price] FAILED to create read-only provider:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[v1] /api/get-price called");
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!readOnlyGameContract) {
    console.error("[get-price] Provider or contract not initialized. Check BASE_PROVIDER_URL env var.");
    return res.status(500).json({ error: "Server configuration error: Failed to connect to network." });
  }

  try {
    const price = await readOnlyGameContract.getPrice();
    const slot0 = await readOnlyGameContract.getSlot0();
    const epochId = slot0.epochId;
    const priceInUsdc = ethers.utils.formatUnits(price, 6); // 6 decimals for USDC

    console.log(`[get-price] Fetched price: ${price.toString()}, epoch: ${epochId}`);

    // Send data back to the client-side script
    res.status(200).json({
      price: price.toString(), // Send as string to avoid JSON issues
      epochId: Number(epochId), // Send as number
      priceInUsdc: priceInUsdc
    });

  } catch (error) {
    console.error("[get-price] Error fetching price from contract:", error.message);
    res.status(500).json({ error: `Contract read error: ${error.message}` });
  }
};
