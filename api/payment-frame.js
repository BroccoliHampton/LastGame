//
// This is the full content for api/payment-frame.js (v3 - Robust Read Calls)
//
module.exports = async function handler(req, res) {
  console.log("[v3] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"
    const GAME_URL = process.env.GAME_URL
    
    // --- NEW: Pass the public RPC URL to the client ---
    const BASE_PROVIDER_URL = process.env.NEXT_PUBLIC_BASE_PROVIDER_URL
    // ---

    // Validation
    if (!GAME_URL || !PUBLIC_URL || !BASE_PROVIDER_URL) {
      console.error("[v3] ERROR: Missing env vars. Need GAME_URL, PUBLIC_URL, and NEXT_PUBLIC_BASE_PROVIDER_URL")
      return res.status(500).send("Server configuration error: Missing required environment variables.")
    }

    console.log("[v3] Payment frame loaded")

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
    console.log('[v3] Payment frame script starting')
    
    const { ethers } = await import('https://esm.sh/ethers@5.7.2')
    
    // --- START CONFIGURATION ---
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913' // Base USDC
    const CONTRACT_ADDRESS = '0x9C751E6825EDAa55007160b99933846f6ECeEc9B' // Your contract
    const CHAIN_ID = '0x2105' // Base chain ID (8453)
    const GAME_URL = '${GAME_URL}'
    // --- NEW: Get the public RPC URL from the server ---
    const BASE_PROVIDER_URL = '${BASE_PROVIDER_URL}' 
    // ---

    const usdcAbi = [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ]
    
    const contractAbi = [
      "function takeover(string memory uri, address channelOwner, uint256 epochId, uint256 deadline, uint256 maxPaymentAmount) external returns (uint256 paymentAmount)",
      "function getPrice() external view returns (uint256)",
      "function getSlot0() external view returns (tuple(uint8 locked, uint16 epochId, uint192 initPrice, uint40 startTime, address owner, string uri))"
    ]
    // --- END CONFIGURATION ---

    const payButton = document.getElementById('payButton')
    const statusDiv = document.getElementById('status')

    // --- NEW: Create a read-only provider ---
    let readOnlyProvider;
    let readOnlyGameContract;
    try {
      readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
      readOnlyGameContract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, readOnlyProvider);
    } catch (e) {
      console.error("[v3] Failed to create read-only provider:", e)
      statusDiv.textContent = 'Error: Failed to connect to Base network.'
      statusDiv.className = 'status error'
    }
    // ---

    payButton.addEventListener('click', async () => {
      console.log('[v3] Button clicked!')
      statusDiv.textContent = 'Initializing...'
      statusDiv.className = 'status loading'
      payButton.disabled = true
      
      let price;
      let epochId;

      try {
        // --- 1. Get Game Data (Price and Epoch) via read-only provider ---
        // This runs *before* connecting to the user's wallet
        statusDiv.textContent = 'Fetching current price...'
        console.log('[v3] Fetching price and slot0 using read-only provider...')
        
        price = await readOnlyGameContract.getPrice()
        const slot0 = await readOnlyGameContract.getSlot0()
        epochId = slot0.epochId
        
        const priceInUsdc = ethers.utils.formatUnits(price, 6)
        console.log(\`[v3] Current price: \${price.toString()} (\${priceInUsdc} USDC)\`)
        console.log(\`[v3] Current epochId: \${epochId}\`)

        if (price.isZero()) {
          throw new Error('Current price is zero. The epoch may have expired.')
        }

        // --- Now, connect to the user's wallet ---
        console.log('[v3] Importing Farcaster SDK')
        const { default: sdk } = await import('https://esm.sh/@farcaster/miniapp-sdk')
        
        console.log('[v3] SDK imported, calling ready()')
        await sdk.actions.ready()
        
        console.log('[v3] Getting Ethereum provider from wallet')
        const provider = await sdk.wallet.getEthereumProvider()
        
        if (!provider) {
          throw new Error('Wallet provider not available')
        }
        
        console.log('[v3] Provider obtained, requesting accounts')
        statusDiv.textContent = 'Connecting wallet...'
        
        const accounts = await provider.request({ method: 'eth_requestAccounts' })
        const userAddress = accounts[0]
        console.log('[v3] User address:', userAddress)

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

        // Create ethers instances *with the user's wallet*
        const ethersProvider = new ethers.providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer)
        const gameContract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer)
        
        // --- 2. Check Allowance and Request Approval ---
        statusDiv.textContent = 'Checking USDC approval...'
        console.log('[v3] Checking allowance...')
        
        const currentAllowance = await usdcContract.allowance(userAddress, CONTRACT_ADDRESS)
        console.log(\`[v3] Current allowance: \${currentAllowance.toString()}\`)
        
        if (currentAllowance.lt(price)) {
          console.log('[v3] Allowance is too low, requesting approval...')
          statusDiv.textContent = \`Please approve \${priceInUsdc} USDC...\`
          
          const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, price)
          console.log('[v3] Approval transaction sent:', approveTx.hash)
          
          statusDiv.textContent = 'Waiting for approval confirmation...'
          await approveTx.wait() // Wait for 1 confirmation
          
          console.log('[v3] Approval confirmed!')
        } else {
          console.log('[v3] Approval already sufficient.')
        }

        // --- 3. Call the 'takeover' function ---
        statusDiv.textContent = 'Finalizing payment...'
        console.log('[v3] Preparing takeover transaction...')

        const deadline = Math.floor(Date.now() / 1000) + 300 // 5-minute deadline
        const uri = "" 
        const channelOwner = userAddress
        
        const takeoverTx = await gameContract.takeover(
          uri,
          channelOwner,
          epochId,
          deadline,
          price // Use the fetched price as maxPaymentAmount
        )
        
        console.log('[v3] Takeover transaction sent:', takeoverTx.hash)
        statusDiv.textContent = 'Waiting for payment confirmation...'
        
        await takeoverTx.wait() 
        
        console.log('[v3] Transaction confirmed!')
        statusDiv.textContent = 'Payment successful! Redirecting...'
        statusDiv.className = 'status success'
        
        setTimeout(() => {
          window.location.href = GAME_URL
        }, 2000)
        
      } catch (error) {
        console.error('[v3] Payment error:', error)
        let errorMessage = error.message || 'Payment failed'
        if (error.data?.message) {
          errorMessage = error.data.message
        } else if (error.reason) {
          errorMessage = error.reason
        }
        
        // Handle common contract errors
        if (errorMessage.includes("Television__Expired")) {
          errorMessage = "Transaction expired. Please try again."
        } else if (errorMessage.includes("Television__EpochIdMismatch")) {
          errorMessage = "Game state updated. Please refresh and try again."
        } else if (errorMessage.includes("Television__MaxPaymentAmountExceeded")) {
          errorMessage = "Price changed. Please refresh and try again."
        } else if (errorMessage.includes("call exception")) {
          errorMessage = "Network error or wrong wallet network. Please check your wallet and try again."
        }
        
        statusDiv.textContent = 'Error: ' + errorMessage
        statusDiv.className = 'status error'
        payButton.disabled = false
      }
    })
    
    console.log('[v3] Click handler attached')
    statusDiv.textContent = 'Ready to play'
  </script>
</body>
</html>`

    console.log("[v3] Payment frame HTML generated")

    res.setHeader("Content-Type", "text/html; charset-utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v3] Payment frame response sent")
  } catch (e) {
    console.error("[v3] Error in payment frame:", e.message)
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
