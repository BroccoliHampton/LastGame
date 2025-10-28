//
// api/verify.js - Verifies transaction and redirects back to game
//
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { ethers } = require("ethers");
const { createRedirectFrame, createRetryFrame } = require("../lib/frame-helpers");

let neynarClient;
let provider;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    // Validate environment variables
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
    const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL || "https://i.imgur.com/success.png";
    const FAILED_IMAGE_URL = process.env.FAILED_IMAGE_URL || "https://i.imgur.com/failed.png";
    const GAME_URL = process.env.GAME_URL;
    const PUBLIC_URL = process.env.PUBLIC_URL;

    if (!NEYNAR_API_KEY || !BASE_PROVIDER_URL || !GAME_URL || !PUBLIC_URL) {
      console.error("[verify] Missing required environment variables");
      return res.status(500).send("Missing required environment variables");
    }

    // Initialize clients
    if (!neynarClient) {
      neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
    }
    if (!provider) {
      provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    }

    // Validate frame action
    if (!req.body?.trustedData?.messageBytes) {
      console.error("[verify] Missing trustedData");
      return res.status(400).send("Invalid request: missing trustedData");
    }

    const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);

    // Check if transaction hash exists
    if (!validation?.action?.transaction?.hash) {
      console.log("[verify] No transaction hash found, showing retry frame");
      return res.send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL));
    }

    const txHash = validation.action.transaction.hash;
    console.log("[verify] Verifying transaction:", txHash);

    // Wait for transaction with timeout
    let receipt;
    try {
      receipt = await provider.waitForTransaction(txHash, 1, 60000); // 1 confirmation, 60s timeout
    } catch (error) {
      console.error("[verify] Transaction wait error:", error.message);
      return res.send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL));
    }

    // Check transaction status
    if (receipt && receipt.status === 1) {
      console.log("[verify] Payment verified successfully");
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL));
    } else {
      console.log("[verify] Payment failed or reverted");
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL));
    }

  } catch (e) {
    console.error("[verify] Error:", e);
    res.status(500).send(`Server Error: ${e.message}`);
  }
};
