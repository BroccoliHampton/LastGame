module.exports = async function handler(req, res) {
  console.log("[v0] /api/index called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"

    console.log("[v0] Using START_IMAGE_URL:", START_IMAGE_URL)
    console.log("[v0] Using PUBLIC_URL:", PUBLIC_URL)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
  <meta property="fc:frame:image:aspect_ratio" content="1:1" />
  <meta property="fc:frame:button:1" content="Test Button" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:post_url" content="${PUBLIC_URL}/api/index" />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="Payment Frame" />
  <meta property="og:description" content="Pay to play the game" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
    <h1>Payment Required</h1>
    <p>Testing button rendering - you should see a "Test Button" below</p>
  </div>
</body>
</html>`

    console.log("[v0] Generated HTML with test button")
    console.log("[v0] Frame meta tags included")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v0] Response sent successfully")
  } catch (e) {
    console.error("[v0] Error:", e.message)
    res.status(500).send(`Error: ${e.message}`)
  }
}
