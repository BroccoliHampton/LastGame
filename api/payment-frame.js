module.exports = async function handler(req, res) {
  console.log("[v0] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"
    const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS
    const GAME_URL = process.env.GAME_URL

    console.log("[v0] Payment frame loaded")

    // This is the actual payment frame with transaction button
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.1rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }
    button {
      background: white;
      color: #667eea;
      border: none;
      padding: 1rem 2rem;
      font-size: 1.1rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      pointer-events: auto;
      position: relative;
      z-index: 10;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }
    button:active {
      transform: translateY(0);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .status {
      margin-top: 1rem;
      font-size: 0.9rem;
      min-height: 20px;
    }
    .error {
      color: #ffcccc;
    }
    .success {
      color: #ccffcc;
    }
    .loading {
      color: #ffffcc;
    }
  </style>
  
  <!-- Farcaster Frame Meta Tags for Transaction -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="fc:frame:button:1" content="Pay 0.25 USDC" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${PUBLIC_URL}/api/transaction" />
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/verify" />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="Payment Frame" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div class="container">
    <h1>🎮 Last Game</h1>
    <p>Pay 0.25 USDC to unlock the game</p>
    <button id="payButton">Pay 0.25 USDC</button>
    <div id="status" class="status"></div>
  </div>

  <script type="module">
    console.log('[v0] Payment frame script starting')
    
    const payButton = document.getElementById('payButton')
    const statusDiv = document.getElementById('status')
    
    payButton.addEventListener('click', async () => {
      console.log('[v0] Button clicked!')
      statusDiv.textContent = 'Initializing payment...'
      statusDiv.className = 'status loading'
      
      try {
        payButton.disabled = true
        
        console.log('[v0] Importing Farcaster SDK')
        const { default: sdk } = await import('https://esm.sh/@farcaster/frame-sdk@0.0.5')
        
        console.log('[v0] SDK imported, calling ready()')
        await sdk.actions.ready()
        
        console.log('[v0] SDK ready, initiating sendToken')
        statusDiv.textContent = 'Opening payment form...'
        
        // Use sendToken action to send 0.25 USDC on Base
        await sdk.actions.sendToken({
          token: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
          amount: '250000', // 0.25 USDC (6 decimals)
          recipientAddress: '${YOUR_WALLET_ADDRESS}',
        })
        
        console.log('[v0] Payment initiated successfully')
        statusDiv.textContent = 'Payment successful! Redirecting...'
        statusDiv.className = 'status success'
        
        // Redirect to game after 2 seconds
        setTimeout(() => {
          window.location.href = '${GAME_URL}'
        }, 2000)
        
      } catch (error) {
        console.error('[v0] Payment error:', error)
        statusDiv.textContent = 'Error: ' + (error.message || 'Payment failed')
        statusDiv.className = 'status error'
        payButton.disabled = false
      }
    })
    
    console.log('[v0] Click handler attached')
    statusDiv.textContent = 'Ready to pay'
  </script>
</body>
</html>`

    console.log("[v0] Payment frame HTML generated")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v0] Payment frame response sent")
  } catch (e) {
    console.error("[v0] Error in payment frame:", e.message)
    res.status(500).send(`Error: ${e.message}`)
  }
}
