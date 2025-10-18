const { createPaymentFrame } = require("../lib/frame-helpers")

module.exports = async function handler(req, res) {
  console.log("[v0] /api/index called")
  console.log("[v0] Request method:", req.method)
  console.log("[v0] Request headers:", JSON.stringify(req.headers))

  try {
    // Validate environment variables
    const START_IMAGE_URL = process.env.START_IMAGE_URL
    const PUBLIC_URL = process.env.PUBLIC_URL

    console.log("[v0] START_IMAGE_URL:", START_IMAGE_URL ? "Set" : "Missing")
    console.log("[v0] PUBLIC_URL:", PUBLIC_URL ? "Set" : "Missing")

    if (!START_IMAGE_URL || !PUBLIC_URL) {
      console.log("[v0] ERROR: Missing environment variables")
      return res.status(500).send("Missing required environment variables")
    }

    const html = createPaymentFrame(START_IMAGE_URL, PUBLIC_URL)
    console.log("[v0] Generated HTML length:", html.length)
    console.log("[v0] HTML preview:", html.substring(0, 200))

    res.setHeader("Content-Type", "text/html")
    res.status(200).send(html)
    console.log("[v0] Response sent successfully")
  } catch (e) {
    console.error("[v0] Error in /api/index:", e)
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
