//
// api/approve-lp.js - Approve LP tokens for spending by MULTICALL contract
//
const { ethers } = require("ethers");

// CRITICAL: Must match the addresses in get-game-state.js
const MULTICALL_ADDRESS = '0x3eE553912ba4262Ddd955DD5F910bA0844B16278';
const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869';

// Multicall ABI to get the payment token
const multicallAbi = [
  `function getAuction(address account) external view returns (
    tuple(
      uint16 epochId,
      uint192 initPrice,
      uint40 startTime,
      address paymentToken,
      uint256 price,
      uint256 paymentTokenPrice,
      uint256 wethAcummulated,
      uint256 wethBalance,
      uint256 paymentTokenBalance
    ) state
  )`
];

// ERC20 ABI for approval
const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

let readOnlyProvider;
let multicallContract;

// Initialize provider
if (process.env.BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(process.env.BASE_PROVIDER_URL);
    multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, readOnlyProvider);
    console.log("[approve-lp] Provider initialized");
  } catch (e) {
    console.error("[approve-lp] FAILED to create provider:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[approve-lp] API called");
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!readOnlyProvider || !multicallContract) {
    console.error("[approve-lp] Provider not initialized");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { player } = req.query;
    
    if (!player) {
      return res.status(400).json({ error: "Missing player address" });
    }

    // Validate address
    if (!ethers.utils.isAddress(player)) {
      return res.status(400).json({ error: "Invalid player address" });
    }

    console.log("[approve-lp] Getting auction state for player:", player);

    // Get auction state to find payment token
    const auctionState = await multicallContract.getAuction(player);
    const lpTokenAddress = auctionState.paymentToken;

    console.log("[approve-lp] LP Token address:", lpTokenAddress);
    console.log("[approve-lp] Will approve MULTICALL:", MULTICALL_ADDRESS);

    // Create LP token contract interface
    const lpTokenInterface = new ethers.utils.Interface(erc20Abi);

    // Encode approval for MAX_UINT256 (unlimited approval)
    // CRITICAL: We're approving MULTICALL_ADDRESS, not MINER_ADDRESS!
    const approvalData = lpTokenInterface.encodeFunctionData('approve', [
      MULTICALL_ADDRESS,  // ✅ MULTICALL contract (the spender)
      ethers.constants.MaxUint256  // Unlimited approval
    ]);

    console.log("[approve-lp] Approval data encoded");

    // Return transaction parameters
    const response = {
      params: {
        to: lpTokenAddress,  // LP token contract
        data: approvalData,   // approve(MULTICALL_ADDRESS, MAX_UINT256)
        value: '0x0'
      },
      details: {
        action: 'Approve LP tokens',
        spender: MULTICALL_ADDRESS,
        token: lpTokenAddress,
        amount: 'unlimited'
      }
    };

    console.log("[approve-lp] ✅ Transaction prepared successfully");
    console.log("[approve-lp] Approving spender:", MULTICALL_ADDRESS);
    
    res.status(200).json(response);

  } catch (error) {
    console.error("[approve-lp] ERROR:", error);
    console.error("[approve-lp] Error stack:", error.stack);
    res.status(500).json({ 
      error: `Failed to prepare approval transaction: ${error.message}`,
      details: error.stack
    });
  }
};
