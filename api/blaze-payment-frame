//
// api/blaze-payment-frame.js - Payment frame for LP-based blaze() function
// Handles both approval and blaze transaction
//
module.exports = async function handler(req, res) {
  console.log("[blaze-payment-frame] Called - Method:", req.method);

  try {
    const BLAZE_IMAGE_URL = process.env.BLAZE_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"; // Use same or different image
    const PUBLIC_URL = process.env.PUBLIC_URL;
    const GAME_URL = process.env.GAME_URL;

    if (!GAME_URL || !PUBLIC_URL) {
      console.error("[blaze-payment-frame] ERROR: Missing GAME_URL or PUBLIC_URL");
      return res.status(500).send("Server configuration error");
    }

    // Get user's FID from query params (passed from your frontend)
    const { needsApproval } = req.query;

    // CASE 1: User needs to approve LP tokens first
    if (needsApproval === 'true') {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Approve LP Tokens</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${BLAZE_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="og:image" content="${BLAZE_IMAGE_URL}" />
  
  <!-- Button triggers APPROVAL transaction -->
  <meta property="fc:frame:button:1" content="Approve LP Tokens 🔓" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${PUBLIC_URL}/api/approve-lp" />
  
  <!-- After approval, redirect to blaze frame -->
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/blaze-payment-frame?needsApproval=false" />
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
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
      backdrop-filter: blur(10px);
    }
    
    .highlight {
      color: #ffd700;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 Blaze Approval</h1>
    <p>First, you need to approve the contract to spend your LP tokens.</p>
    
    <div class="info">
      <p><span class="highlight">Step 1 of 2:</span></p>
      <p>• Approve unlimited LP tokens</p>
      <p>• One-time approval needed</p>
      <p>• Next step: Blaze transaction</p>
    </div>
  </div>
</body>
</html>`;

      console.log("[blaze-payment-frame] Serving APPROVAL frame");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).send(html);
    }

    // CASE 2: User has approval, ready to blaze
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blaze for ETH</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${BLAZE_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="og:image" content="${BLAZE_IMAGE_URL}" />
  
  <!-- Button triggers BLAZE transaction -->
  <meta property="fc:frame:button:1" content="Blaze 🔥" />
  <meta property="fc:frame:button:1:action" content="tx" />
  <meta property="fc:frame:button:1:target" content="${PUBLIC_URL}/api/blaze-transaction" />
  
  <!-- After transaction, verify it -->
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/blaze-verify" />
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
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
      backdrop-filter: blur(10px);
    }
    
    .highlight {
      color: #ffd700;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 Blaze Auction</h1>
    <p>Trade your LP tokens for ETH from the auction!</p>
    
    <div class="info">
      <p><span class="highlight">How it works:</span></p>
      <p>• Pay DONUT-ETH LP tokens</p>
      <p>• Receive ETH instantly</p>
      <p>• Price decreases over time</p>
      <p>• Best deals early in epoch</p>
    </div>
  </div>
</body>
</html>`;

    console.log("[blaze-payment-frame] Serving BLAZE frame");
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
    
  } catch (e) {
    console.error("[blaze-payment-frame] ERROR:", e.message);
    res.status(500).send(`Server Error: ${e.message}`);
  }
};
