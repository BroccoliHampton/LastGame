//
// api/get-game-state.js - Updated with Blaze/AuctionState support
//
const { ethers } = require("ethers");
// Import Neynar SDK
const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");

// --- CONFIGURATION - UPDATED ADDRESSES ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const MULTICALL_ADDRESS = '0x3eE553912ba4262Ddd955DD5F910bA0844B16278'; // NEW!
const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869';

// Multicall ABI - Updated to include Blaze auction state
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
  )`,
  // NEW: Add auction state function
  `function getBlazer(address account) external view returns (
    tuple(
      uint16 epochId,
      uint192 initPrice,
      uint40 startTime,
      address paymentToken,
      uint256 price,
      uint256 paymentTokenPrice,
      uint256 wethAccumulated,
      uint256 wethBalance,
      uint256 paymentTokenBalance
    ) state
  )`
];

const minerAbi = [
  "function startTime() external view returns (uint256)",
  "function HALVING_PERIOD() external view returns (uint256)",
  "function donut() external view returns (address)"
];

const donutAbi = [
  "function totalSupply() external view returns (uint256)"
];

// NEW: ERC20 ABI for LP token balance
const erc20Abi = [
  "function balanceOf(address account) external view returns (uint256)"
];

let readOnlyProvider;
let multicallContract;
let minerContract;
let neynarClient; // Declare neynarClient globally

// Initialize providers and contracts outside handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, readOnlyProvider);
    minerContract = new ethers.Contract(MINER_ADDRESS, minerAbi, readOnlyProvider);
    
    // Initialize Neynar Client
    if (process.env.NEYNAR_API_KEY) {
        neynarClient = new NeynarAPIClient(new Configuration({ apiKey: process.env.NEYNAR_API_KEY }));
    }
    
    console.log("[get-game-state] Providers initialized successfully");
  } catch (e) {
    console.error("[get-game-state] FAILED to create providers:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[get-game-state] API called");
  
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

  if (!readOnlyProvider || !multicallContract || !minerContract) {
    console.error("[get-game-state] Contracts not initialized");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { userAddress } = req.query;
    const address = userAddress || ethers.constants.AddressZero;
    
    // Fetch BOTH miner state and blazer state
    const [minerState, blazerState] = await Promise.all([
      multicallContract.getMiner(address),
      multicallContract.getBlazer(address)
    ]);
    
    const currentMinerAddress = minerState.miner;
    
    // --- NEYNAR LOOKUP LOGIC ---
    let currentMinerUsername = null;
    
    // Only attempt lookup if the address is not the zero address
    if (neynarClient && currentMinerAddress !== ethers.constants.AddressZero) {
        try {
            // Fetch user profile by Ethereum address
            const usersData = await neynarClient.fetchBulkUsersByEthOrSolAddress({
                addresses: [currentMinerAddress],
                addressTypes: ['verified_address', 'custody_address']
            });

            if (usersData && usersData.users && usersData.users.length > 0) {
                // Use the first resolved user's username
                currentMinerUsername = usersData.users[0].username; 
                console.log(`[get-game-state] Resolved username: @${currentMinerUsername}`);
            }
        } catch (e) {
            console.error("[get-game-state] Neynar lookup failed:", e.message);
        }
    }
    // --- END NEYNAR LOOKUP ---

    // Get additional data from Miner contract
    const [contractStartTime, halvingPeriod, donutAddress, totalSupply] = await Promise.all([
        minerContract.startTime(),
        minerContract.HALVING_PERIOD(),
        minerContract.donut(),
        (async () => {
            const donutAddr = await minerContract.donut();
            const donutContract = new ethers.Contract(donutAddr, donutAbi, readOnlyProvider);
            return await donutContract.totalSupply();
        })()
    ]);

    // NEW: Get user's LP token balance if address is provided
    let userLpBalance = "0";
    let userLpBalanceFormatted = "0.0";
    if (address !== ethers.constants.AddressZero && blazerState.paymentToken !== ethers.constants.AddressZero) {
        try {
            const lpTokenContract = new ethers.Contract(blazerState.paymentToken, erc20Abi, readOnlyProvider);
            const balance = await lpTokenContract.balanceOf(address);
            userLpBalance = balance.toString();
            userLpBalanceFormatted = ethers.utils.formatEther(balance);
        } catch (e) {
            console.error("[get-game-state] Failed to fetch LP balance:", e.message);
        }
    }

    // Calculate time until next halving
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceStart = currentTime - contractStartTime.toNumber();
    const currentHalvingPeriod = Math.floor(timeSinceStart / halvingPeriod.toNumber());
    const nextHalvingTime = contractStartTime.toNumber() + ((currentHalvingPeriod + 1) * halvingPeriod.toNumber());
    const secondsUntilHalving = Math.max(0, nextHalvingTime - currentTime);

    // Time as miner
    const timeAsMiner = Math.max(0, currentTime - minerState.startTime);

    // Format response
    const response = {
      // ========== GLAZERY STATE ==========
      // Basic game state
      epochId: minerState.epochId,
      currentMiner: currentMinerAddress,
      currentMinerUsername: currentMinerUsername, 
      
      price: minerState.price.toString(),
      priceInEth: ethers.utils.formatEther(minerState.price),
      
      // DPS (Donuts Per Second)
      currentDps: minerState.dps.toString(),
      currentDpsFormatted: ethers.utils.formatEther(minerState.dps),
      nextDps: minerState.nextDps.toString(),
      nextDpsFormatted: ethers.utils.formatEther(minerState.nextDps),
      
      // Timing
      startTime: minerState.startTime,
      currentTime: currentTime,
      timeAsMiner: timeAsMiner,
      secondsUntilHalving: secondsUntilHalving,
      
      // User data
      userAddress: address === ethers.constants.AddressZero ? null : address,
      userEthBalance: minerState.ethBalance.toString(),
      userEthBalanceFormatted: ethers.utils.formatEther(minerState.ethBalance),
      userDonutBalance: minerState.donutBalance.toString(),
      userDonutBalanceFormatted: ethers.utils.formatEther(minerState.donutBalance),
      
      userWethBalance: minerState.wethBalance.toString(),
      userWethBalanceFormatted: ethers.utils.formatEther(minerState.wethBalance),
      
      // Claimable (already calculated by contract as "glazed")
      claimableDonuts: minerState.glazed.toString(),
      claimableDonutsFormatted: ethers.utils.formatEther(minerState.glazed),
      
      // Supply info
      totalDonutSupply: totalSupply.toString(),
      totalDonutSupplyFormatted: ethers.utils.formatEther(totalSupply),
      
      // URI
      uri: minerState.uri,

      // ========== BLAZERY STATE (NEW) ==========
      blaze: {
        epochId: blazerState.epochId,
        initPrice: blazerState.initPrice.toString(),
        startTime: blazerState.startTime,
        paymentToken: blazerState.paymentToken,
        
        // Current auction price (in LP tokens)
        price: blazerState.price.toString(),
        priceFormatted: ethers.utils.formatEther(blazerState.price),
        
        // LP token price (probably in WETH/USD)
        paymentTokenPrice: blazerState.paymentTokenPrice.toString(),
        paymentTokenPriceFormatted: ethers.utils.formatEther(blazerState.paymentTokenPrice),
        
        // WETH metrics
        wethAccumulated: blazerState.wethAccumulated.toString(),
        wethAccumulatedFormatted: ethers.utils.formatEther(blazerState.wethAccumulated),
        wethBalance: blazerState.wethBalance.toString(),
        wethBalanceFormatted: ethers.utils.formatEther(blazerState.wethBalance),
        
        // LP token balance in contract
        paymentTokenBalance: blazerState.paymentTokenBalance.toString(),
        paymentTokenBalanceFormatted: ethers.utils.formatEther(blazerState.paymentTokenBalance),
        
        // User's LP token balance
        userLpBalance: userLpBalance,
        userLpBalanceFormatted: userLpBalanceFormatted
      },
      
      // Contract addresses
      minerContract: MINER_ADDRESS,
      multicallContract: MULTICALL_ADDRESS,
      donutContract: donutAddress
    };

    console.log("[get-game-state] State fetched successfully");
    res.status(200).json(response);

  } catch (error) {
    console.error("[get-game-state] ERROR:", error);
    res.status(500).json({ 
      error: `Failed to fetch game state: ${error.message}`
    });
  }
};
