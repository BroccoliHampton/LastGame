module.exports = async function handler(req, res) {
  console.log("[v1] /api/index called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const GAME_URL = process.env.GAME_URL || "https://last-game-game.vercel.app"

    console.log("[v1] Using START_IMAGE_URL:", START_IMAGE_URL)
    console.log("[v1] Using GAME_URL:", GAME_URL)

    // Mini app embed now launches game directly
    const miniAppEmbed = {
      version: "1",
      imageUrl: START_IMAGE_URL,
      button: {
        title: "Glaze It!",
        action: {
          type: "launch_frame",
          name: "Last Game",
          url: GAME_URL, // Launch game directly instead of payment-frame
          splashImageUrl: START_IMAGE_URL,
          splashBackgroundColor: "#1a1a1a",
        },
      },
    }

    const serializedEmbed = JSON.stringify(miniAppEmbed)
    console.log("[v1] Mini App Embed:", serializedEmbed)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Last Game</title>
  
  <!-- Farcaster Mini App Meta Tag -->
  <meta property="fc:miniapp" content='${serializedEmbed}' />
  <meta property="fc:frame" content='${serializedEmbed}' />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="Last Game" />
  <meta property="og:description" content="Play if you dare" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;">
    <h1>Last Game</h1>
    <p>Click the button to play!</p>
  </div>
</body>
</html>`

    console.log("[v1] Generated HTML with Mini App Embed format")

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.status(200).send(html)

    console.log("[v1] Response sent successfully")
  } catch (e) {
    console.error("[v1] Error:", e.message)
    res.status(500).send(`Error: ${e.message}`)
  }
}
