module.exports = async function handler(req, res) {
  console.log("[v0] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"

    console.log("[v0] Payment frame loaded")

    // This is the actual payment frame with transaction button
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>
  
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
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;">
    <h1>Payment Required</h1>
    <p>Pay 0.25 USDC to unlock the game</p>
  </div>
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
