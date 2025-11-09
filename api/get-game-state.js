//
// api/get-game-state.js - MODIFIED to skip Auction until deployed
//
const { ethers } = require("ethers");
// Import Neynar SDK
const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");

// --- CONFIGURATION - UPDATED ADDRESSES ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const MULTICALL_ADDRESS = '0x7a85CA4b4E15df2a7b927Fa56edb050d2399B34c';
const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869';

// Multicall ABI - ONLY getMiner for now
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
  // Auction function commented out until Auction contract is deployed
  // `function getAuction(address account) external view returns (...)`
];

const minerAbi = [
  "function startTime() external view returns (uint256)",
  "function HALVING_PERIOD() external view returns (uint256)",
  "function donut() external view returns (address)"
];

const donutAbi = [
  "function totalSupply() external view returns (uint256)"
];

let readOnlyProvider;
let multicallContract;
let minerContract;

// Initialize providers and contracts outside handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, readOnlyProvider);
    minerContract = new ethers.Contract(MINER_ADDRESS, minerAbi, readOnlyProvider);
    
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
    
    // Initialize Neynar client
    let neynarClient = null;
    if (process.env.NEYNAR_API_KEY) {
        try {
            neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
            console.log("[get-game-state] Neynar client initialized successfully");
        } catch (e) {
            console.error("[get-game-state] Failed to initialize Neynar client:", e.message);
        }
    } else {
        console.log("[get-game-state] NEYNAR_API_KEY not found in environment variables");
    }
    
    // Fetch ONLY miner state (skip auction for now)
    console.log("[get-game-state] Fetching miner state only...");
    const minerState = await multicallContract.getMiner(address);
    
    console.log("[get-game-state] Miner state fetched successfully");
    
    const currentMinerAddress = minerState.miner;
    
    // --- NEYNAR LOOKUP LOGIC ---
    let currentMinerUsername = null;
    
    if (process.env.NEYNAR_API_KEY && currentMinerAddress !== ethers.constants.AddressZero) {
        try {
            console.log(`[get-game-state] Looking up Farcaster profile for: ${currentMinerAddress}`);
            
            const neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${currentMinerAddress.toLowerCase()}&address_types=verified_address,custody_address`;
            
            const neynarResponse = await fetch(neynarUrl, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'api_key': process.env.NEYNAR_API_KEY
                }
            });

            if (!neynarResponse.ok) {
                const errorText = await neynarResponse.text();
                throw new Error(`Neynar API returned ${neynarResponse.status}: ${errorText}`);
            }

            const neynarData = await neynarResponse.json();

            const lowerAddress = currentMinerAddress.toLowerCase();
            if (neynarData && neynarData[lowerAddress]) {
                const users = neynarData[lowerAddress];
                if (Array.isArray(users) && users.length > 0) {
                    currentMinerUsername = users[0].username;
                    console.log(`[get-game-state] ✓ Resolved username: @${currentMinerUsername}`);
                }
            }
        } catch (e) {
            console.error("[get-game-state] Neynar lookup failed:", e.message);
        }
    }

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

    // Calculate time until next halving
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceStart = currentTime - contractStartTime.toNumber();
    const currentHalvingPeriod = Math.floor(timeSinceStart / halvingPeriod.toNumber());
    const nextHalvingTime = contractStartTime.toNumber() + ((currentHalvingPeriod + 1) * halvingPeriod.toNumber());
    const secondsUntilHalving = Math.max(0, nextHalvingTime - currentTime);

    // Time as miner
    const timeAsMiner = Math.max(0, currentTime - minerState.startTime);

    // Format response - WITHOUT blaze data
    const response = {
      // ========== GLAZERY STATE ==========
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
      
      // Claimable
      claimableDonuts: minerState.glazed.toString(),
      claimableDonutsFormatted: ethers.utils.formatEther(minerState.glazed),
      
      // Supply info
      totalDonutSupply: totalSupply.toString(),
      totalDonutSupplyFormatted: ethers.utils.formatEther(totalSupply),
      
      // URI
      uri: minerState.uri,

      // ========== BLAZE/AUCTION STATE - PLACEHOLDER ==========
      // Return empty/default blaze data until Auction contract is deployed
      blaze: {
        epochId: 0,
        initPrice: "0",
        startTime: 0,
        paymentToken: ethers.constants.AddressZero,
        
        price: "0",
        priceFormatted: "0.0",
        
        paymentTokenPrice: "0",
        paymentTokenPriceFormatted: "0.0",
        
        wethAccumulated: "0",
        wethAccumulatedFormatted: "0.0",
        wethBalance: "0",
        wethBalanceFormatted: "0.0",
        
        paymentTokenBalance: "0",
        paymentTokenBalanceFormatted: "0.0",
        
        userLpBalance: "0",
        userLpBalanceFormatted: "0.0",
        
        // Keep approval as true so button shows "Approve LP" (disabled state)
        userNeedsApproval: true
      },
      
      // Contract addresses
      minerContract: MINER_ADDRESS,
      multicallContract: MULTICALL_ADDRESS,
      donutContract: donutAddress
    };

    console.log("[get-game-state] State fetched successfully (Blaze disabled temporarily)");
    res.status(200).json(response);

  } catch (error) {
    console.error("[get-game-state] ERROR:", error);
    console.error("[get-game-state] Error stack:", error.stack);
    res.status(500).json({ 
      error: `Failed to fetch game state: ${error.message}`,
      details: error.stack
    });
  }
};
