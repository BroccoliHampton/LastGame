const { ethers } = require('ethers');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Farcaster frames send data in the POST body
    let player;
    
    if (req.method === 'POST' && req.body && req.body.untrustedData) {
      // Extract player address from Farcaster frame POST
      player = req.body.untrustedData.address;
    } else {
      // Fallback to query params for testing
      player = req.query.player;
    }

    if (!player) {
      return res.status(400).json({ error: 'Player address required' });
    }

    // --- CONFIGURATION ---
    const MULTICALL_ADDRESS = '0x3eE553912ba4262Ddd955DD5F910bA0844B16278';
    const RPC_URL = 'https://mainnet.base.org';

    // --- MULTICALL ABI - buy() function + read functions ---
    const MULTICALL_ABI = [
      'function buy(uint256 epochId, uint256 deadline, uint256 maxPaymentTokenAmount) external',
      'function getAuction(address account) external view returns (tuple(uint16 epochId, uint192 initPrice, uint40 startTime, address paymentToken, uint256 price, uint256 paymentTokenPrice, uint256 wethAcummulated, uint256 wethBalance, uint256 paymentTokenBalance))'
    ];
    
    // Setup Ethers
    const providerRpc = new ethers.providers.JsonRpcProvider(RPC_URL);
    const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, providerRpc);

    // --- FETCH AUCTION STATE FROM MULTICALL ---
    const auctionState = await multicallContract.getAuction(player);
    const epochId = auctionState.epochId;
    const wethBalance = auctionState.wethBalance;
    const lpPrice = auctionState.price; // LP tokens needed
    
    console.log('Current epoch ID:', epochId);
    console.log('WETH available:', ethers.utils.formatEther(wethBalance));
    console.log('LP price:', ethers.utils.formatEther(lpPrice));

    // --- CALCULATE TRANSACTION PARAMETERS ---
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Use the exact LP price from contract
    const lpAmountWei = lpPrice;
    
    // Calculate expected WETH output with 5% slippage tolerance
    const minWethOut = wethBalance.mul(95).div(100);

    const params = [
        epochId,                            // 1. epochId: Current epoch ID
        currentTime + 300,                  // 2. deadline: 5 minutes from now
        lpAmountWei                         // 3. maxPaymentTokenAmount: Maximum LP tokens to spend
    ];

    // --- ENCODE FUNCTION DATA ---
    const iface = new ethers.utils.Interface(MULTICALL_ABI);
    const data = iface.encodeFunctionData('buy', params);

    console.log('Epoch ID:', epochId);
    console.log('Max LP Amount:', ethers.utils.formatEther(lpAmountWei));
    console.log('Min WETH out:', ethers.utils.formatEther(minWethOut));

    // Return transaction params - NO ETH VALUE NEEDED (it's an LP token swap)
    const txData = {
      chainId: 'eip155:8453', // Base chain ID
      method: 'eth_sendTransaction',
      params: {
        abi: MULTICALL_ABI,
        to: MULTICALL_ADDRESS,
        data: data,
        value: '0x0' // No ETH payment needed for buy
      }
    };

    console.log('Returning buy transaction data:', JSON.stringify(txData, null, 2));

    return res.status(200).json(txData);

  } catch (error) {
    console.error('Buy Transaction API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to create buy transaction',
      details: error.message 
    });
  }
};
