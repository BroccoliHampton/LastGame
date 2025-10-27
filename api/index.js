module.exports = async function handler(req, res) {
  console.log("[v0] /api/index called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    // Use PUBLIC_URL as the base URL for the miniapp 
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app" 

    console.log("[v0] Using START_IMAGE_URL:", START_IMAGE_URL)
    console.log("[v0] Using PUBLIC_URL:", PUBLIC_URL)

    // The embed now simply provides a "link" action to open the game's base URL.
    const miniAppEmbed = {
      version: "1",
      imageUrl: START_IMAGE_URL,
      button: {
        title: "Play If U Dare",
        action: {
          type: "link", // <-- Use 'link' to open the external Miniapp URL
          name: "Donut Miner Miniapp",
          url: `${PUBLIC_URL}`, // <-- Base URL where index.html is hosted
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
  <title>Donut Miner</title>
  
  <meta property="fc:miniapp" content='${serializedEmbed}' />
  <meta property="fc:frame" content='${serializedEmbed}' />
  
  <meta property="og:title" content="Donut Miner" />
  <meta property="og:description" content="Click the button to start mining donuts!" />
  <meta property="og:image" content="${START_IMAGE_URL}" />
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;">
    <h1>Donut Miner</h1>
    <p>Click the button below to launch the miniapp and play!</p>
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
