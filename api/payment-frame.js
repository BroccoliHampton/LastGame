//
// This is the full content for api/payment-frame.js (v16 - Fix Redirect URL)
//
module.exports = async function handler(req, res) {
  console.log("[v16] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"
    const GAME_URL = process.env.GAME_URL

    // Validation
    if (!GAME_URL || !PUBLIC_URL) {
      console.error("[v16] ERROR: Missing GAME_URL or PUBLIC_URL env vars")
      return res.status(500).send("Server configuration error: Missing required environment variables.")
    }

    console.log("[v16] Payment frame loaded")

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { font-size: 1.1rem; margin-bottom: 2rem; opacity: 0.9; }
    button { background: white; color: #667eea; border: none; padding: 1rem 2rem; font-size: 1.1rem; font-weight: 600; border-radius: 12px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: auto; position: relative; z-index: 10; }
    button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    button:active { transform: translateY(0); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .status { margin-top: 1rem; font-size: 0.9rem; min-height: 20px; }
    .error { color: #ffcccc; }
    .success { color: #ccffcc; }
    .loading { color: #ffffcc; }
  </style>
  
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="fc:frame:button:1" content="Pay to Play" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${PUBLIC_URL}/api/transaction" />
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/verify" />
  
  <meta property="og:title" content="Payment Frame" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div class="container">
    <h1>🎮 Last Game</h1>
    <p>Pay to unlock the game</p>
    <button id="payButton">Pay to Play</button>
    <div id="status" class="status"></div>
  </div>

  <script type="module">
    console.log('[v16] Payment frame script starting')
    
    const { ethers } = await import('https://esm.sh/ethers@5.7.2')
    
    // --- START CONFIGURATION ---
    const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const CONTRACT_ADDRESS = '0x9c751e6825edaa55007160b99933846f6eceec9b'
    const CHAIN_ID = '0x2105' // Base chain ID (8453)
    
    // --- BUG FIX: Removed the \ so the server injects the URL ---
    const GAME_URL = '${GAME_URL}' 
    
    const APPROVE_GAS_LIMIT = 200000
    const TAKEOVER_GAS_LIMIT = 500000
    // ---

    const usdcAbi = [
      "function approve(address spender, uint256 amount) external returns (bool)",
    ]
    
    const contractAbi = [
      "function takeover(string memory uri, address channelOwner, uint256 epochId, uint256 deadline, uint256 maxPaymentAmount) external returns (uint256 paymentAmount)",
    ]
    // --- END CONFIGURATION ---

    const payButton = document.getElementById('payButton')
    const statusDiv = document.getElementById('status')

    payButton.addEventListener('click', async () => {
      console.log('[v16] Button clicked!')
      statusDiv.textContent = 'Initializing...'
      statusDiv.className = 'status loading'
      payButton.disabled = true
      
      let price;
      let epochId;
      let priceInUsdc;
      let currentAllowance;

      try {
        // --- 1. Connect to wallet FIRST ---
        console.log('[v16] Importing Farcaster SDK')
        const { default: sdk } = await import('https://esm.sh/@farcaster/miniapp-sdk')
        
        console.log('[v16] SDK imported, calling ready()')
        await sdk.actions.ready()
        
        console.log('[v16] Getting Ethereum provider from wallet')
        const provider = await sdk.wallet.getEthereumProvider()
        
        if (!provider) {
          throw new Error('Wallet provider not available')
        }
        
        console.log('[v16] Provider obtained, requesting accounts')
        statusDiv.textContent = 'Connecting wallet...'
        
        const accounts = await provider.request({ method: 'eth_requestAccounts' })
        
        const rawUserAddress = accounts[0]
        const userAddress = ethers.utils.getAddress(rawUserAddress)
        console.log(\`[v16] User address: \${userAddress}\`)

        // Ensure user is on the correct chain
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CHAIN_ID }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            throw new Error('Please switch to Base network in your wallet.')
          }
          throw switchError
        }
        
        // --- 2. Get Game Data (Price, Epoch, Allowance) via OUR server ---
        statusDiv.textContent = 'Fetching game data...'
        console.log(\`[v16] Fetching data from /api/get-price?userAddress=\${userAddress}\`)
        
        const response = await fetch(\`/api/get-price?userAddress=\${userAddress}\`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch game data.');
        }

        price = ethers.BigNumber.from(data.price);
        epochId = data.epochId;
        priceInUsdc = data.priceInUsdc;
        currentAllowance = ethers.BigNumber.from(data.allowance);
        
        console.log(\`[v16] Price: \${price.toString()}, Epoch: \${epochId}, Allowance: \${currentAllowance.toString()}\`)

        if (price.isZero()) {
          console.log('[v16] Price is zero. Switching to free claim.')
          payButton.textContent = 'Claim for Free'
          statusDiv.textContent = 'Price is 0. Claim for free to play!'
        } else {
          payButton.textContent = \`Pay \${priceInUsdc} USDC\`
        }

        // --- 3. Create Signer for WRITE Txs ---
        const ethersProvider = new ethers.providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer)
        const gameContract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer)
        
        // --- 4. Check Allowance and Request Approval (SKIP IF PRICE IS ZERO) ---
        if (price.gt(0)) { 
          statusDiv.textContent = 'Checking USDC approval...'
          console.log('[v16] Price > 0. Checking allowance...')
          
          if (currentAllowance.lt(price)) {
            console.log('[v16] Allowance is too low, requesting approval...')
            statusDiv.textContent = \`Please approve \${priceInUsdc} USDC...\`
            
            const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, price, { 
              gasLimit: APPROVE_GAS_LIMIT 
            })
            console.log('[v16] Approval transaction sent:', approveTx.hash)
            
            statusDiv.textContent = 'Waiting for approval (1/2)...'
            const approvePoll = await fetch(\`/api/check-tx?txHash=\${approveTx.hash}\`);
            const approveData = await approvePoll.json();
            
            if (!approvePoll.ok || approveData.status !== 'confirmed') {
              throw new Error(approveData.error || 'Approval transaction failed.');
            }
            console.log('[v16] Approval confirmed by server!')
            
          } else {
            console.log('[v16] Approval already sufficient.')
          }
        } else {
          console.log('[v16] Price is 0. Skipping approval.')
        }

        // --- 5. Call the 'takeover' function ---
        if (price.isZero()) {
          statusDiv.textContent = 'Claiming for free...'
        } else {
          statusDiv.textContent = 'Finalizing payment (2/2)...'
        }
        console.log('[v16] Preparing takeover transaction...')

        const deadline = Math.floor(Date.now() / 1000) + 300 // 5-minute deadline
        const uri = "" 
        const channelOwner = userAddress
        
        const takeoverTx = await gameContract.takeover(
          uri,
          channelOwner,
          epochId,
          deadline,
          price,
          { gasLimit: TAKEOVER_GAS_LIMIT }
        )
        
        console.log('[v16] Takeover transaction sent:', takeoverTx.hash)
        
        statusDiv.textContent = 'Waiting for final confirmation (2/2)...'
        const takeoverPoll = await fetch(\`/api/check-tx?txHash=\${takeoverTx.hash}\`);
        const takeoverData = await takeoverPoll.json();
        
        if (!takeoverPoll.ok || takeoverData.status !== 'confirmed') {
          throw new Error(takeoverData.error || 'Payment transaction failed.');
        }
        console.log('[v16] Payment confirmed by server!')
        
        statusDiv.textContent = 'Success! Redirecting...'
        statusDiv.className = 'status success'
        
        setTimeout(() => {
          // This will now use the correctly injected URL
          window.location.href = GAME_URL 
        }, 2000)
        
      } catch (error) {
        console.error('[v16] Payment error:', error)
        let errorMessage = error.message || 'Payment failed'
        if (error.data?.message) {
          errorMessage = error.data.message
        } else if (error.reason) {
          errorMessage = error.reason
        }
        
        if (errorMessage.includes("eth_estimateGas") || errorMessage.includes("UnsupportedMethodError")) {
          errorMessage = "Your wallet does not support this action. Please try a different wallet."
        } else if (errorMessage.includes("Television__Expired")) {
          errorMessage = "Transaction expired. Please try again."
        } else if (errorMessage.includes("Television__EpochIdMismatch")) {
          errorMessage = "Game state updated. Please refresh and try again."
        } else if (errorMessage.includes("Television__MaxPaymentAmountExceeded")) {
          errorMessage = "Price changed. Please refresh and try again."
        } else if (errorMessage.includes("call exception") || errorMessage.includes("could not detect network")) {
          errorMessage = "Network error or wrong wallet network. Please check your wallet and try again."
        } else if (errorMessage.includes("bad address checksum")) {
          errorMessage = "Wallet address error. Please try reconnecting."
        } else if (errorMessage.includes("Transaction timed out")) {
          errorMessage = "Confirmation timed out. Please try again."
        }
        
        statusDiv.textContent = 'Error: ' + errorMessage
        statusDiv.className = 'status error'
        payButton.disabled = false
      }
    })
    
    console.log('[v16] Click handler attached')
    statusDiv.textContent = 'Ready to play'
  </script>
</body>
</html>`

    console.log("[v16] Payment frame HTML generated")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v16] Payment frame response sent")
  } catch (e) {
    console.error("[v16] FATAL ERROR in payment frame:", e.message)
    console.error(e) // Log the full error stack
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
