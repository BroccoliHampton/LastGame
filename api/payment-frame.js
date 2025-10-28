//
// api/payment-frame.js - Payment frame for ETH-based mine() function
// This is a SIMPLER version since we don't need USDC approval
//
module.exports = async function handler(req, res) {
  console.log("[payment-frame] Called - Method:", req.method);

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png";
    const PUBLIC_URL = process.env.PUBLIC_URL;
    const GAME_URL = process.env.GAME_URL;

    if (!GAME_URL || !PUBLIC_URL) {
      console.error("[payment-frame] ERROR: Missing GAME_URL or PUBLIC_URL");
      return res.status(500).send("Server configuration error");
    }

    // This is a FARCASTER FRAME - not a direct wallet connection page
    // The frame meta tags tell Farcaster how to handle the transaction
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Glaze to Mine</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
  
  <!-- Button triggers transaction -->
  <meta property="fc:frame:button:1" content="Glaze to Mine 🍩" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${PUBLIC_URL}/api/transaction" />
  
  <!-- After transaction, verify it -->
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/verify" />
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background: #2a2a3a;
      font-family: 'Press Start 2P', cursive;
      color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      image-rendering: pixelated;
    }
    
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #ffffff;
    }
    
    p {
      font-size: 0.8rem;
      margin-bottom: 2rem;
      line-height: 1.5;
      opacity: 0.9;
    }
    
    .info {
      background: rgba(255, 255, 255, 0.1);
      padding: 1rem;
      border-radius: 8px;
      margin-top: 2rem;
      font-size: 0.7rem;
      line-height: 1.6;
    }
    
    .highlight {
      color: #ff9aa2;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍩 Donut Miner</h1>
    <p>Click the button below to pay and become the active miner!</p>
    
    <div class="info">
      <p><span class="highlight">How it works:</span></p>
      <p>• Pay ETH to become the miner</p>
      <p>• Mine DONUT tokens while active</p>
      <p>• Earn 80% of next player's payment</p>
      <p>• Price doubles each time</p>
      <p>• Decays to 0 over 1 hour</p>
    </div>
  </div>
</body>
</html>`;

    console.log("[payment-frame] Serving frame HTML");
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
    
  } catch (e) {
    console.error("[payment-frame] ERROR:", e.message);
    res.status(500).send(`Server Error: ${e.message}`);
  }
};
