//
// api/get-game-state.js - CORRECTED with proper ABI function names
//
const { ethers } = require("ethers");
// Import Neynar SDK
const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");

// --- CONFIGURATION - UPDATED ADDRESSES ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const MULTICALL_ADDRESS = '0xe03a89eb8b75d73Caf762a81dA260106fD42F18A'; // <- NEW ADDRESS
const MINER_ADDRESS = '0x9Bea9c75063095ba8C6bF60F6B50858B140bF869';

// Multicall ABI - CORRECTED from actual contract ABI
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
  // CORRECTED: Function is called getAuction
  // CORRECTED: Field name is wethAccumulated
  `function getAuction(address account) external view returns (
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

// ERC20 ABI for LP token balance and allowance
const erc20Abi = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
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
    
    // Initialize Neynar client (must be done inside handler for env vars to be available)
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
    
    // Fetch BOTH miner state and auction state
    // CORRECTED: Using getAuction instead of getBlazer
    const [minerState, auctionState] = await Promise.all([
      multicallContract.getMiner(address),
      multicallContract.getAuction(address)
    ]);
    
    console.log("[get-game-state] Miner and Auction states fetched successfully");
    
    const currentMinerAddress = minerState.miner;
    
    // --- NEYNAR LOOKUP LOGIC ---
    let currentMinerUsername = null;
    
    if (neynarClient && currentMinerAddress !== ethers.constants.AddressZero) {
        try {
            console.log(`[get-game-state] Looking up Farcaster profile for: ${currentMinerAddress}`);
            
            const response = await neynarClient.fetchBulkUsersByEthOrSolAddress({
                addresses: [currentMinerAddress.toLowerCase()],
            });

            console.log(`[get-game-state] Neynar response:`, JSON.stringify(response, null, 2));

            // According to Neynar docs, response structure is response.result.user or response[address]
            if (response) {
                // Try response.result.user (newer SDK versions)
                if (response.result && response.result.user) {
                    currentMinerUsername = response.result.user.username;
                }
                // Try direct address key (older SDK versions)
                else if (response[currentMinerAddress.toLowerCase()]) {
                    const userData = response[currentMinerAddress.toLowerCase()];
                    if (Array.isArray(userData) && userData.length > 0) {
                        currentMinerUsername = userData[0].username;
                    } else if (userData.username) {
                        currentMinerUsername = userData.username;
                    }
                }
                
                if (currentMinerUsername) {
                    console.log(`[get-game-state] ✓ Resolved username: @${currentMinerUsername}`);
                } else {
                    console.log(`[get-game-state] ✗ No Farcaster account found for ${currentMinerAddress}`);
                }
            }
        } catch (e) {
            console.error("[get-game-state] Neynar lookup failed:", e.message);
            console.error("[get-game-state] Error details:", e);
        }
    } else {
        if (!neynarClient) {
            console.log("[get-game-state] Neynar client not initialized - check NEYNAR_API_KEY");
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

    // Get user's LP token balance and approval status if address is provided
    let userLpBalance = "0";
    let userLpBalanceFormatted = "0.0";
    let userNeedsApproval = true; // Default to true
    
    if (address !== ethers.constants.AddressZero && auctionState.paymentToken !== ethers.constants.AddressZero) {
        try {
            const lpTokenContract = new ethers.Contract(auctionState.paymentToken, erc20Abi, readOnlyProvider);
            
            // Get user's LP token balance
            const balance = await lpTokenContract.balanceOf(address);
            userLpBalance = balance.toString();
            userLpBalanceFormatted = ethers.utils.formatEther(balance);
            console.log("[get-game-state] User LP balance:", userLpBalanceFormatted);
            
            // Check if user has approved the Multicall contract
            const allowance = await lpTokenContract.allowance(address, MULTICALL_ADDRESS);
            const priceNeeded = ethers.BigNumber.from(auctionState.price);
            
            // User needs approval if allowance is less than price needed
            userNeedsApproval = allowance.lt(priceNeeded);
            
            console.log("[get-game-state] LP Allowance:", ethers.utils.formatEther(allowance));
            console.log("[get-game-state] Price needed:", ethers.utils.formatEther(priceNeeded));
            console.log("[get-game-state] User needs approval:", userNeedsApproval);
            
        } catch (e) {
            console.error("[get-game-state] Failed to fetch LP balance/allowance:", e.message);
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

      // ========== BLAZE/AUCTION STATE ==========
      blaze: {
        epochId: auctionState.epochId,
        initPrice: auctionState.initPrice.toString(),
        startTime: auctionState.startTime,
        paymentToken: auctionState.paymentToken,
        
        // Current auction price (in LP tokens)
        price: auctionState.price.toString(),
        priceFormatted: ethers.utils.formatEther(auctionState.price),
        
        // LP token price
        paymentTokenPrice: auctionState.paymentTokenPrice.toString(),
        paymentTokenPriceFormatted: ethers.utils.formatEther(auctionState.paymentTokenPrice),
        
        // WETH metrics (note the typo in contract: wethAcummulated)
        wethAccumulated: auctionState.wethAccumulated.toString(),
        wethAccumulatedFormatted: ethers.utils.formatEther(auctionState.wethAccumulated),
        wethBalance: auctionState.wethBalance.toString(),
        wethBalanceFormatted: ethers.utils.formatEther(auctionState.wethBalance),
        
        // LP token balance in contract
        paymentTokenBalance: auctionState.paymentTokenBalance.toString(),
        paymentTokenBalanceFormatted: ethers.utils.formatEther(auctionState.paymentTokenBalance),
        
        // User's LP token balance
        userLpBalance: userLpBalance,
        userLpBalanceFormatted: userLpBalanceFormatted,
        
        // *** CRITICAL: Approval status ***
        userNeedsApproval: userNeedsApproval
      },
      
      // Contract addresses
      minerContract: MINER_ADDRESS,
      multicallContract: MULTICALL_ADDRESS,
      donutContract: donutAddress
    };

    console.log("[get-game-state] State fetched successfully with Blaze data");
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
