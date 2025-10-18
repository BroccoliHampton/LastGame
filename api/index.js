const { createPaymentFrame } = require("../lib/frame-helpers")

module.exports = async function handler(req, res) {
  try {
    // Validate environment variables
    const START_IMAGE_URL = process.env.START_IMAGE_URL
    const PUBLIC_URL = process.env.PUBLIC_URL

    if (!START_IMAGE_URL || !PUBLIC_URL) {
      return res.status(500).send("Missing required environment variables")
    }

    const html = createPaymentFrame(START_IMAGE_URL, PUBLIC_URL)
    res.setHeader("Content-Type", "text/html")
    res.status(200).send(html)
  } catch (e) {
    console.error("Error in /api/index:", e)
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
