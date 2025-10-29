//
// api/get-game-state.js - Final version with Neynar Lookup
//
const { ethers } = require("ethers");
// Import Neynar SDK
const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");

// --- CONFIGURATION ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
// !!! NEW MULTICALL ADDRESS !!!
const MULTICALL_ADDRESS = '0xDbC6028935b3b5b96451C48bD66Eff0918eA59A9';
// !!! NEW MINER ADDRESS !!!
const MINER_ADDRESS = '0x9E5eA3b8AdDA08dFb918370811c1496b114DF97e';

// CORRECT ABI - From actual verified contract on BaseScan
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
      uint256 donutBalance
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
    
    const minerState = await multicallContract.getMiner(address);
    const currentMinerAddress = minerState.miner;
    
    // --- NEW NEYNAR LOOKUP LOGIC ---
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

    // Get additional data from Miner contract (remains the same)
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

    // Calculate time until next halving (remains the same)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceStart = currentTime - contractStartTime.toNumber();
    const currentHalvingPeriod = Math.floor(timeSinceStart / halvingPeriod.toNumber());
    const nextHalvingTime = contractStartTime.toNumber() + ((currentHalvingPeriod + 1) * halvingPeriod.toNumber());
    const secondsUntilHalving = Math.max(0, nextHalvingTime - currentTime);

    // Time as miner
    const timeAsMiner = Math.max(0, currentTime - minerState.startTime);

    // Format response
    const response = {
      // Basic game state
      epochId: minerState.epochId,
      currentMiner: currentMinerAddress,
      // *** ADD THE USERNAME FIELD ***
      currentMinerUsername: currentMinerUsername, 
      
      price: minerState.price.toString(),
      priceInEth: ethers.utils.formatEther(minerState.price),
      
      // ... (rest of the response remains the same) ...
      
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
      
      // Claimable (already calculated by contract as "glazed")
      claimableDonuts: minerState.glazed.toString(),
      claimableDonutsFormatted: ethers.utils.formatEther(minerState.glazed),
      
      // Supply info
      totalDonutSupply: totalSupply.toString(),
      totalDonutSupplyFormatted: ethers.utils.formatEther(totalSupply),
      
      // Contract addresses
      minerContract: MINER_ADDRESS,
      donutContract: donutAddress,
      
      // URI
      uri: minerState.uri
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
