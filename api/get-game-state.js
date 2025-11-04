// api/get-game-state.js
// Returns game state including blaze data and LP approval status

const { ethers } = require('ethers');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get optional user address from query
    const { userAddress } = req.query;

    // --- CONFIGURATION ---
    const RPC_URL = process.env.BASE_PROVIDER_URL;
    const MULTICALL_ADDRESS = '0x3eE553912ba4262Ddd955DD5F910bA0844B16278';
    const LP_TOKEN_ADDRESS = '0xc3b9bd6f7d4bfcc22696a7bc1cc83948a33d7fab';

    if (!RPC_URL) {
      console.error('[get-game-state] BASE_PROVIDER_URL not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // --- SETUP PROVIDER & CONTRACTS ---
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    const MULTICALL_ABI = [
      'function getMiner(address player) view returns (tuple(uint8 epochId, uint256 price, uint40 startTime, address currentMiner, string uri, uint256 ethBalance, uint256 donutBalance, uint256 wethBalance, uint256 glazed))',
      'function getBlazer(address player) view returns (tuple(uint8 epochId, uint256 initPrice, uint40 startTime, address paymentToken, uint256 price, uint256 paymentTokenPrice, uint256 wethAccumulated, uint256 wethBalance, uint256 paymentTokenBalance))',
      'function donutContract() view returns (address)'
    ];

    const ERC20_ABI = [
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)'
    ];

    const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);

    // --- FETCH DATA FROM MULTICALL ---
    const address = userAddress || ethers.constants.AddressZero;

    console.log('[get-game-state] Fetching for address:', address);

    const [minerState, blazerState, donutAddress] = await Promise.all([
      multicallContract.getMiner(address),
      multicallContract.getBlazer(address),
      multicallContract.donutContract()
    ]);

    console.log('[get-game-state] Miner data loaded');
    console.log('[get-game-state] Blazer data loaded');

    // --- FETCH ADDITIONAL DATA ---
    const donutContract = new ethers.Contract(donutAddress, ERC20_ABI, provider);
    const totalSupply = await donutContract.totalSupply();

    // Fetch user's LP balance and approval status if user address provided
    let userLpBalance = '0';
    let userLpBalanceFormatted = '0';
    let userNeedsApproval = true; // Default to true

    if (userAddress && userAddress !== ethers.constants.AddressZero) {
      const lpTokenContract = new ethers.Contract(LP_TOKEN_ADDRESS, ERC20_ABI, provider);
      
      // Get user's LP token balance
      userLpBalance = await lpTokenContract.balanceOf(userAddress);
      userLpBalanceFormatted = ethers.utils.formatEther(userLpBalance);
      
      // Check if user has approved the Multicall contract
      const allowance = await lpTokenContract.allowance(userAddress, MULTICALL_ADDRESS);
      const priceNeeded = ethers.BigNumber.from(blazerState.price);
      
      // User needs approval if allowance is less than price needed
      userNeedsApproval = allowance.lt(priceNeeded);
      
      console.log('[get-game-state] LP Balance:', userLpBalanceFormatted);
      console.log('[get-game-state] Allowance:', ethers.utils.formatEther(allowance));
      console.log('[get-game-state] Price needed:', ethers.utils.formatEther(priceNeeded));
      console.log('[get-game-state] Needs approval:', userNeedsApproval);
    }

    // --- BUILD RESPONSE ---
    const response = {
      // Miner state
      epochId: minerState.epochId,
      price: minerState.price.toString(),
      priceInEth: ethers.utils.formatEther(minerState.price),
      startTime: minerState.startTime,
      currentMiner: minerState.currentMiner,
      currentMinerUsername: null, // You can fetch this separately
      
      // Time calculations
      timeAsMiner: minerState.currentMiner !== ethers.constants.AddressZero 
        ? Math.floor(Date.now() / 1000) - minerState.startTime 
        : 0,
      secondsUntilHalving: 3600 - (Math.floor(Date.now() / 1000) - minerState.startTime),
      currentDpsFormatted: minerState.currentMiner !== ethers.constants.AddressZero
        ? (Number(ethers.utils.formatEther(minerState.glazed)) / ((Date.now() / 1000) - minerState.startTime)).toFixed(2)
        : '0.00',
      
      // User balances
      userAddress: userAddress || null,
      userEthBalance: minerState.ethBalance.toString(),
      userEthBalanceFormatted: ethers.utils.formatEther(minerState.ethBalance),
      userDonutBalance: minerState.donutBalance.toString(),
      userDonutBalanceFormatted: ethers.utils.formatEther(minerState.donutBalance),
      userWethBalance: minerState.wethBalance.toString(),
      userWethBalanceFormatted: ethers.utils.formatEther(minerState.wethBalance),
      
      // Claimable donuts
      claimableDonuts: minerState.glazed.toString(),
      claimableDonutsFormatted: ethers.utils.formatEther(minerState.glazed),
      
      // Supply info
      totalDonutSupply: totalSupply.toString(),
      totalDonutSupplyFormatted: ethers.utils.formatEther(totalSupply),
      
      // URI
      uri: minerState.uri,
      
      // Contract addresses
      minerContract: MULTICALL_ADDRESS,
      multicallContract: MULTICALL_ADDRESS,
      donutContract: donutAddress,
      
      // Blaze state (NEW)
      blaze: {
        epochId: blazerState.epochId,
        initPrice: blazerState.initPrice.toString(),
        startTime: blazerState.startTime,
        paymentToken: blazerState.paymentToken,
        
        // Current auction price (in LP tokens)
        price: blazerState.price.toString(),
        priceFormatted: ethers.utils.formatEther(blazerState.price),
        
        // LP token price
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
        userLpBalance: userLpBalance.toString(),
        userLpBalanceFormatted: userLpBalanceFormatted,
        
        // *** CRITICAL: Approval status ***
        userNeedsApproval: userNeedsApproval
      }
    };

    console.log('[get-game-state] Blaze data included with approval status:', userNeedsApproval);

    return res.status(200).json(response);

  } catch (error) {
    console.error('[get-game-state] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch game state',
      details: error.message 
    });
  }
};
