const { NeynarAPIClient } = require("@neynar/nodejs-sdk")
const { ethers } = require("ethers")
const { createRedirectFrame, createRetryFrame } = require("../lib/frame-helpers")

// Initialize clients outside handler for reuse
let neynarClient
let provider

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed")
  }

  try {
    // Validate environment variables
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
    const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL
    const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL
    const FAILED_IMAGE_URL = process.env.FAILED_IMAGE_URL
    const GAME_URL = process.env.GAME_URL
    const PUBLIC_URL = process.env.PUBLIC_URL

    if (!NEYNAR_API_KEY || !BASE_PROVIDER_URL || !SUCCESS_IMAGE_URL || !FAILED_IMAGE_URL || !GAME_URL || !PUBLIC_URL) {
      return res.status(500).send("Missing required environment variables")
    }

    // Initialize clients if not already done
    if (!neynarClient) {
      neynarClient = new NeynarAPIClient(NEYNAR_API_KEY)
    }
    if (!provider) {
      provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL)
    }

    // Validate the frame action
    if (!req.body?.trustedData?.messageBytes) {
      return res.status(400).send("Invalid request: missing trustedData")
    }

    const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes)

    // Check if transaction hash exists
    if (!validation?.action?.transaction?.hash) {
      return res.send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL))
    }

    const txHash = validation.action.transaction.hash
    console.log("Verifying transaction:", txHash)

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash)

    // Check if transaction was successful
    if (receipt && receipt.status === 1) {
      console.log("Payment verified successfully")
      res.setHeader("Content-Type", "text/html")
      res.status(200).send(createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL))
    } else {
      console.log("Payment failed or pending")
      res.setHeader("Content-Type", "text/html")
      res.status(200).send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL))
    }
  } catch (e) {
    console.error("Error in /api/verify:", e)
    res.status(500).send(`Server Error: ${e.message}`)
  }
}
