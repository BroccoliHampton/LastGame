//
// This is the full content for api/payment-frame.js (v19 - Syntax Fix)
//
module.exports = async function handler(req, res) {
  console.log("[v19-style] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"
    const GAME_URL = process.env.GAME_URL

    // Validation
    if (!GAME_URL || !PUBLIC_URL) {
      console.error("[v19-style] ERROR: Missing GAME_URL or PUBLIC_URL env vars")
      return res.status(500).send("Server configuration error: Missing required environment variables.")
    }

    console.log("[v19-style] Payment frame loaded")

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>

  <style>
    /* Import pixel font */
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    body {
      margin: 0;
      padding: 0;
      /* Classic 8-bit dark purple background */
      background: #2a2a3a;
      /* Pixel font for everything */
      font-family: 'Press Start 2P', cursive;
      color: #f0f0f0; /* Off-white text */
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      /* For sharp pixel rendering */
      image-rendering: pixelated;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    h1 {
      font-size: 1.5rem; /* Pixel fonts are big, scale it down */
      margin-bottom: 1.5rem;
      color: #ffffff;
    }
    p {
      font-size: 0.8rem; /* Scaled down for pixel font */
      margin-bottom: 2rem;
      line-height: 1.5; /* Add spacing for readability */
      opacity: 0.9;
    }
    button {
      /* Use the pixel font */
      font-family: 'Press Start 2P', cursive;
      font-size: 0.9rem;
      font-weight: 600;
      
      /* 8-bit button style */
      background: #f0f0f0; /* Light background */
      color: #2a2a3a;     /* Dark text */
      border: 2px solid #ffffff; /* White border */
      padding: 1rem 1.5rem;
      border-radius: 0; /* Sharp corners */
      cursor: pointer;
      
      /* 8-bit shadow */
      box-shadow: 4px 4px 0px #1a1a2a; /* Darker bg color for shadow */
      
      transition: transform 0.1s, box-shadow 0.1s;
      
      pointer-events: auto;
      position: relative;
      z-index: 10;
    }
    button:hover {
      /* "Press" effect */
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px #1a1a2a;
    }
    button:active {
      /* Full press effect */
      transform: translate(4px, 4px);
      box-shadow: 0px 0px 0px #1a1a2a;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #777777;
      color: #bbbbbb;
      box-shadow: 4px 4px 0px #1a1a2a;
      transform: none;
    }
    .status {
      margin-top: 1.5rem;
      font-size: 0.7rem;
      min-height: 20px;
      line-height: 1.4;
    }
    .error {
      color: #ff6b6b; /* Bright 8-bit red */
    }
    .success {
      color: #73ff73; /* Bright 8-bit green */
    }
    .loading {
      color: #ffff73; /* Bright 8-bit yellow */
    }
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
    <h1>Waddup Glazer!</h1>
    <p>Pay to glaze and earn $DONUT until someone else glazes. Glaze price doubles when someone glazes, and cools off back to $1 over an hour. 90% of glaze price goes to the previous glazer</p>
    
    <button id="payButton">Pay to Play</button>
    <div id="status" class="status"></div>
  </div>

  <script type="module">
    console.log('[v19-style] Payment frame script starting')
    
    const { ethers } = await import('https://esm.sh/ethers@5.7.2')
    
    // --- START CONFIGURATION ---
    const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const CONTRACT_ADDRESS = '0x9c751e6825edaa55007160b99933846f6eceec9b'
    const CHAIN_ID = '0x2105' // Base chain ID (8453)
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

    // --- Function to pre-load price ---
    async function loadPrice() {
      console.log('[v19-style] Pre-loading price...')
      statusDiv.textContent = 'Fetching price...'
      statusDiv.className = 'status loading'
      payButton.disabled = true;

      try {
        const response = await fetch(\`/api/get-price\`); // No user address
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch price.');
        }

        const price = ethers.BigNumber.from(data.price);
        const priceInUsdc = data.priceInUsdc;

        if (price.isZero()) {
          payButton.textContent = 'Claim for Free'
          statusDiv.textContent = 'Price is 0. Click to claim!'
        } else {
          payButton.textContent = \`Pay \${priceInUsdc} USDC\`
          statusDiv.textContent = 'Ready to play'
        }
        payButton.disabled = false;
        statusDiv.className = 'status';

      } catch (e) {
        console.error("Error pre-loading price:", e.message)
        statusDiv.textContent = \`Error: \${e.message}\`
        statusDiv.className = 'status error'
        payButton.textContent = 'Error'
      }
    }
    // --- END ---

    payButton.addEventListener('click', async () => {
      console.log('[v19-style] Button clicked!')
      statusDiv.textContent = 'Initializing...'
      statusDiv.className = 'status loading'
      payButton.disabled = true
      
      let price;
      let epochId;
      let priceInUsdc;
      let currentAllowance;

      try {
        // --- 1. Connect to wallet FIRST ---
        console.log('[v19-style] Importing Farcaster SDK')
        const { default: sdk } = await import('https://esm.sh/@farcaster/miniapp-sdk')
        
        console.log('[v19-style] SDK imported, calling ready()')
        await sdk.actions.ready()
        
        console.log('[v19-style] Getting Ethereum provider from wallet')
        const provider = await sdk.wallet.getEthereumProvider()
        
        if (!provider) {
          throw new Error('Wallet provider not available')
        }
        
        console.log('[v19-style] Provider obtained, requesting accounts')
        statusDiv.textContent = 'Connecting wallet...'
        
        const accounts = await provider.request({ method: 'eth_requestAccounts' })
        
        const rawUserAddress = accounts[0]
        const userAddress = ethers.utils.getAddress(rawUserAddress)
        console.log(\`[v19-style] User address: \${userAddress}\`)

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
        console.log(\`[v19-style] Fetching data from /api/get-price?userAddress=\${userAddress}\`)
        
        const response = await fetch(\`/api/get-price?userAddress=\${userAddress}\`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch game data.');
        }

        price = ethers.BigNumber.from(data.price);
        epochId = data.epochId;
        priceInUsdc = data.priceInUsdc;
        currentAllowance = ethers.BigNumber.from(data.allowance);
        
        console.log(\`[v19-style] Price: \${price.toString()}, Epoch: \${epochId}, Allowance: \${currentAllowance.toString()}\`)

        // Update button text *again* in case price changed
        if (price.isZero()) {
          payButton.textContent = 'Claim for Free'
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
          console.log('[v19-style] Price > 0. Checking allowance...')
          
          if (currentAllowance.lt(price)) {
            console.log('[v19-style] Allowance is too low, requesting approval...')
            statusDiv.textContent = \`Please approve \${priceInUsdc} USDC...\`
            
            const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, price, { 
              gasLimit: APPROVE_GAS_LIMIT 
            })
            console.log('[v19-style] Approval transaction sent:', approveTx.hash)
            
            statusDiv.textContent = 'Waiting for approval (1/2)...'
            const approvePoll = await fetch(\`/api/check-tx?txHash=\${approveTx.hash}\`);
            const approveData = await approvePoll.json();
            
            if (!approvePoll.ok || approveData.status !== 'confirmed') {
              throw new Error(approveData.error || 'Approval transaction failed.');
            }
            console.log('[v19-style] Approval confirmed by server!')
            
          } else {
            console.log('[v19-style] Approval already sufficient.')
          }
        } else {
          console.log('[v19-style] Price is 0. Skipping approval.')
        }

        // --- 5. Call the 'takeover' function ---
        if (price.isZero()) {
          statusDiv.textContent = 'Claiming for free...'
        } else {
          statusDiv.textContent = 'Finalizing payment (2/2)...'
        }
        console.log('[v19-style] Preparing takeover transaction...')

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
        
        console.log('[v19-style] Takeover transaction sent:', takeoverTx.hash)
        
        statusDiv.textContent = 'Waiting for final confirmation (2/2)...'
        const takeoverPoll = await fetch(\`/api/check-tx?txHash=\${takeoverTx.hash}\`);
        const takeoverData = await takeoverPoll.json();
        
        if (!takeoverPoll.ok || takeoverData.status !== 'confirmed') {
          throw new Error(takeoverData.error || 'Payment transaction failed.');
        }
        console.log('[v19-style] Payment confirmed by server!')
        
        statusDiv.textContent = 'Success! Redirecting...'
        statusDiv.className = 'status success'
        
        setTimeout(() => {
          window.location.href = GAME_URL 
        }, 2000)
        
      } catch (error) {
        console.error('[v19-style] Payment error:', error)
        let errorMessage = error.message || 'Payment failed'
        if (error.data?.message) {
          errorMessage = error.data.message
        } else if (error.reason) {
          errorMessage = error.reason
        }
        
        // --- SYNTAX FIX: Changed 'else.if' to 'else if' ---
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
        // --- END FIX ---
        
        statusDiv.textContent = 'Error: ' + errorMessage
        statusDiv.className = 'status error'
        payButton.disabled = false
      }
    })
    
    // --- Call the function to load the price on page load ---
    loadPrice();

  </script>
</body>
</html>`

    console.log("[v19-style] Payment frame HTML generated")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v19-style] Payment frame response sent")
  } catch (e) {
    console.error("[v19-style] FATAL ERROR in payment frame:", e.message)
    console.error(e) // Log the full error stack
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
