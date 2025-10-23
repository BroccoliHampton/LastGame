module.exports = async function handler(req, res) {
  console.log("[v0] /api/index called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"

    console.log("[v0] Using START_IMAGE_URL:", START_IMAGE_URL)
    console.log("[v0] Using PUBLIC_URL:", PUBLIC_URL)

    const miniAppEmbed = {
      version: "1",
      imageUrl: START_IMAGE_URL,
      button: {
        title: "Play If U Dare",
        action: {
          type: "launch_frame",
          name: "Payment Frame",
          url: `${PUBLIC_URL}/api/payment-frame`,
          splashImageUrl: START_IMAGE_URL,
          splashBackgroundColor: "#1a1a1a",
        },
      },
    }

    const serializedEmbed = JSON.stringify(miniAppEmbed)
    console.log("[v0] Mini App Embed:", serializedEmbed)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>
  
  <!-- Farcaster Mini App Meta Tag -->
  <meta property="fc:miniapp" content='${serializedEmbed}' />
  <meta property="fc:frame" content='${serializedEmbed}' />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="Payment Frame" />
  <meta property="og:description" content="Pay to play the game" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;">
    <h1>Payment Required</h1>
    <p>Click the button below to pay 0.25 USDC and start playing!</p>
  </div>
</body>
</html>`

    console.log("[v0] Generated HTML with Mini App Embed format")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v0] Response sent successfully")
  } catch (e) {
    console.error("[v0] Error:", e.message)
    res.status(500).send(`Error: ${e.message}`)
  }
}
