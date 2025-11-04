//
// api/blaze-verify.js - Verify blaze transaction and redirect back to game
//
const { ethers } = require('ethers');

module.exports = async function handler(req, res) {
  console.log("[blaze-verify] Called - Method:", req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GAME_URL = process.env.GAME_URL;
    const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png";

    if (!GAME_URL) {
      console.error("[blaze-verify] ERROR: Missing GAME_URL");
      return res.status(500).send("Server configuration error");
    }

    // Parse the Farcaster frame POST body
    const { untrustedData } = req.body;
    
    if (!untrustedData) {
      console.error("[blaze-verify] No untrustedData in request body");
      return res.status(400).send("Invalid request");
    }

    const transactionId = untrustedData.transactionId;
    
    console.log("[blaze-verify] Transaction ID:", transactionId);

    // TODO: Optional - verify transaction on-chain
    // For now, we'll just redirect back to the game

    // Return success frame that redirects to game
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blaze Success!</title>
  
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${SUCCESS_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="og:image" content="${SUCCESS_IMAGE_URL}" />
  
  <!-- Button to return to game -->
  <meta property="fc:frame:button:1" content="Back to Game 🎮" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${GAME_URL}" />
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
      font-family: 'Press Start 2P', cursive;
      color: #2a2a3a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    
    .container {
      max-width: 400px;
    }
    
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #2a2a3a;
    }
    
    p {
      font-size: 0.8rem;
      line-height: 1.5;
    }
    
    .tx-id {
      font-size: 0.6rem;
      word-break: break-all;
      background: rgba(0,0,0,0.1);
      padding: 0.5rem;
      border-radius: 4px;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 Blaze Success!</h1>
    <p>Your transaction has been submitted!</p>
    <div class="tx-id">TX: ${transactionId}</div>
  </div>
</body>
</html>`;

    console.log("[blaze-verify] Sending success frame");
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
    
  } catch (e) {
    console.error("[blaze-verify] ERROR:", e.message);
    res.status(500).send(`Server Error: ${e.message}`);
  }
};
