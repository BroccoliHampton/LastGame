//
// api/get-game-state.js - Fetches all game state from Multicall contract
//
const { ethers } = require("ethers");

// --- CONFIGURATION ---
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const MULTICALL_ADDRESS = '0x88e52940E62E150619cAa54b1bc51b1103a2EA9F';
const MINER_ADDRESS = '0x3EE441030984ACfeCf17FDa6953bea00a8c53Fa7';

const multicallAbi = [
  `function getMiner(address account) external view returns (
    tuple(
      uint16 epochId,
      uint192 initPrice,
      uint40 startTime,
      uint256 balance,
      uint256 donuts,
      uint256 price,
      uint256 dps,
      uint256 nextDps,
      address miner,
      string uri
    )
  )`
];

const minerAbi = [
  "function startTime() external view returns (uint256)",
  "function HALVING_PERIOD() external view returns (uint256)",
  "function INITIAL_DPS() external view returns (uint256)",
  "function TAIL_DPS() external view returns (uint256)",
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
} else {
  console.error("[get-game-state] BASE_PROVIDER_URL environment variable is not set!");
}

module.exports = async function handler(req, res) {
  console.log("[get-game-state] API called");
  console.log("[get-game-state] Method:", req.method);
  console.log("[get-game-state] Query:", req.query);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log("[get-game-state] Handling OPTIONS preflight");
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    console.log("[get-game-state] Method not allowed:", req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if environment variable is set
  if (!BASE_PROVIDER_URL) {
    console.error("[get-game-state] BASE_PROVIDER_URL not configured");
    return res.status(500).json({ 
      error: "Server configuration error: BASE_PROVIDER_URL not set",
      details: "Please set BASE_PROVIDER_URL environment variable in Vercel"
    });
  }

  if (!readOnlyProvider || !multicallContract || !minerContract) {
    console.error("[get-game-state] Contracts not initialized");
    return res.status(500).json({ 
      error: "Server configuration error: Contracts not initialized",
      providerUrl: BASE_PROVIDER_URL ? "Set" : "Not set"
    });
  }

  try {
    // Get user address from query (optional)
    const { userAddress } = req.query;
    const address = userAddress || ethers.constants.AddressZero;
    
    console.log(`[get-game-state] Fetching state for address: ${address}`);

    // Get all game state from Multicall with timeout
    console.log("[get-game-state] Calling multicallContract.getMiner()...");
    const minerState = await Promise.race([
      multicallContract.getMiner(address),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Multicall timeout after 10s')), 10000)
      )
    ]);
    console.log("[get-game-state] Multicall response received");
    
    // Get additional data from Miner contract
    console.log("[get-game-state] Fetching additional contract data...");
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
    console.log("[get-game-state] Additional data fetched");

    // Calculate time until next halving
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceStart = currentTime - contractStartTime.toNumber();
    const currentHalvingPeriod = Math.floor(timeSinceStart / halvingPeriod.toNumber());
    const nextHalvingTime = contractStartTime.toNumber() + ((currentHalvingPeriod + 1) * halvingPeriod.toNumber());
    const secondsUntilHalving = Math.max(0, nextHalvingTime - currentTime);

    // Calculate claimable donuts for current miner
    const timeAsMiner = Math.max(0, currentTime - minerState.startTime);
    const claimableDonuts = ethers.BigNumber.from(timeAsMiner).mul(minerState.dps);

    // Format response
    const response = {
      // Basic game state
      epochId: minerState.epochId,
      currentMiner: minerState.miner,
      price: minerState.price.toString(),
      priceInEth: ethers.utils.formatEther(minerState.price),
      
      // DPS info
      currentDps: minerState.dps.toString(),
      currentDpsFormatted: ethers.utils.formatEther(minerState.dps),
      nextDps: minerState.nextDps.toString(),
      nextDpsFormatted: ethers.utils.formatEther(minerState.nextDps),
      
      // Timing
      startTime: minerState.startTime,
      currentTime: currentTime,
      timeAsMiner: timeAsMiner,
      secondsUntilHalving: secondsUntilHalving,
      
      // User data (only if address provided)
      userAddress: address === ethers.constants.AddressZero ? null : address,
      userEthBalance: minerState.balance.toString(),
      userEthBalanceFormatted: ethers.utils.formatEther(minerState.balance),
      userDonutBalance: minerState.donuts.toString(),
      userDonutBalanceFormatted: ethers.utils.formatEther(minerState.donuts),
      
      // Claimable (for current miner)
      claimableDonuts: claimableDonuts.toString(),
      claimableDonutsFormatted: ethers.utils.formatEther(claimableDonuts),
      
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
    console.log("[get-game-state] Current miner:", minerState.miner);
    console.log("[get-game-state] Price (ETH):", ethers.utils.formatEther(minerState.price));
    
    res.status(200).json(response);

  } catch (error) {
    console.error("[get-game-state] ERROR:", error);
    console.error("[get-game-state] Error message:", error.message);
    console.error("[get-game-state] Error stack:", error.stack);
    
    res.status(500).json({ 
      error: `Failed to fetch game state: ${error.message}`,
      details: error.stack,
      providerConfigured: !!BASE_PROVIDER_URL,
      multicallAddress: MULTICALL_ADDRESS,
      minerAddress: MINER_ADDRESS
    });
  }
};
