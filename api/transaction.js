//
// api/transaction.js - Generates transaction data for mine() function
//
const { ethers } = require("ethers");

// --- CONFIGURATION ---
const MINER_ADDRESS = '0x3EE441030984ACfeCf17FDa6953bea00a8c53Fa7';
const PROVIDER_ADDRESS = '0x96f71F5ef424D560C9df490B453802C24D2Cd705';

const minerAbi = [
  `function mine(
    address miner,
    address provider,
    uint256 epochId,
    uint256 deadline,
    uint256 maxPrice,
    string memory uri
  ) external payable returns (uint256 price)`
];

const minerInterface = new ethers.utils.Interface(minerAbi);

module.exports = async function handler(req, res) {
  console.log("[transaction] /api/transaction called");
  console.log("[transaction] Request method:", req.method);

  if (req.method !== "POST") {
    console.log("[transaction] ERROR: Method not allowed:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate frame message
    if (!req.body?.untrustedData?.fid) {
      console.log("[transaction] ERROR: Missing frame data");
      return res.status(400).json({ error: "Invalid frame request" });
    }

    const fid = req.body.untrustedData.fid;
    const userAddress = req.body.untrustedData.address;

    console.log("[transaction] FID:", fid);
    console.log("[transaction] User address:", userAddress);

    if (!userAddress) {
      console.log("[transaction] ERROR: Missing user address");
      return res.status(400).json({ error: "User address required" });
    }

    // Get current game state to fetch epochId and price
    const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
    if (!BASE_PROVIDER_URL) {
      console.log("[transaction] ERROR: Missing BASE_PROVIDER_URL");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    const minerContract = new ethers.Contract(
      MINER_ADDRESS,
      ["function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, uint256 dps, address miner, string uri))", "function getPrice() external view returns (uint256)"],
      provider
    );

    const [slot0, currentPrice] = await Promise.all([
      minerContract.getSlot0(),
      minerContract.getPrice()
    ]);

    const epochId = slot0.epochId;
    const price = currentPrice;

    console.log("[transaction] Current epochId:", epochId);
    console.log("[transaction] Current price:", ethers.utils.formatEther(price), "ETH");

    // Add 10% buffer to maxPrice to account for small price changes
    const maxPrice = price.mul(110).div(100);
    
    // Set deadline to 5 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 300;
    
    // URI can be empty or contain metadata
    const uri = "";

    // Encode the mine() function call
    const calldata = minerInterface.encodeFunctionData("mine", [
      userAddress,      // miner - the user becomes the new miner
      PROVIDER_ADDRESS, // provider - your address to receive 10% fee
      epochId,          // epochId - current epoch
      deadline,         // deadline - 5 minutes
      maxPrice,         // maxPrice - with 10% buffer
      uri               // uri - empty for now
    ]);

    console.log("[transaction] Generated calldata for mine()");
    console.log("[transaction] Price (ETH):", ethers.utils.formatEther(price));
    console.log("[transaction] Max Price (ETH):", ethers.utils.formatEther(maxPrice));

    // Build transaction response for Farcaster frame
    const response = {
      chainId: "eip155:8453", // Base mainnet
      method: "eth_sendTransaction",
      params: {
        abi: minerAbi,
        to: MINER_ADDRESS,
        data: calldata,
        value: price.toString() // Send ETH equal to current price
      }
    };

    console.log("[transaction] Sending transaction response");
    res.status(200).json(response);

  } catch (error) {
    console.error("[transaction] Error:", error);
    res.status(500).json({ error: `Server Error: ${error.message}` });
  }
};
