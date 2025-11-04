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
    const { player } = req.query;

    if (!player) {
      return res.status(400).json({ error: 'Player address required' });
    }

    // --- CONFIGURATION ---
    const MULTICALL_ADDRESS = '0xe03a89eb8b75d73Caf762a81dA260106fD42F18A'; // NEW MULTICALL!
    const LP_TOKEN_ADDRESS = '0xc3b9bd6f7d4bfcc22696a7bc1cc83948a33d7fab'; // DONUT-ETH LP

    // ERC20 ABI for approve function
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) external returns (bool)'
    ];

    // --- ENCODE APPROVAL TRANSACTION ---
    const iface = new ethers.utils.Interface(ERC20_ABI);
    
    // Approve unlimited tokens (MaxUint256)
    const data = iface.encodeFunctionData('approve', [
      MULTICALL_ADDRESS,
      ethers.constants.MaxUint256
    ]);

    console.log('[Approve LP] Creating approval transaction');
    console.log('[Approve LP] LP Token:', LP_TOKEN_ADDRESS);
    console.log('[Approve LP] Spender (Multicall):', MULTICALL_ADDRESS);
    console.log('[Approve LP] Amount: Unlimited (MaxUint256)');

    // Return transaction params
    const txData = {
      chainId: 'eip155:8453', // Base chain ID
      method: 'eth_sendTransaction',
      params: {
        abi: ERC20_ABI,
        to: LP_TOKEN_ADDRESS,  // Send to LP token contract
        data: data,
        value: '0x0' // No ETH payment for approval
      }
    };

    console.log('Returning approval transaction data:', JSON.stringify(txData, null, 2));

    return res.status(200).json(txData);

  } catch (error) {
    console.error('Approve LP API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to create approval transaction',
      details: error.message 
    });
  }
};
