//
// This is the full content for the NEW file: api/check-tx.js
//
const { ethers } = require("ethers");

const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
let readOnlyProvider;

// Initialize provider outside the handler for reuse
if (BASE_PROVIDER_URL) {
  try {
    readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);
    console.log("[check-tx] Read-only provider initialized.");
  } catch (e) {
    console.error("[check-tx] FAILED to create read-only provider:", e.message);
  }
}

module.exports = async function handler(req, res) {
  console.log("[v1] /api/check-tx called");

  if (!readOnlyProvider) {
    console.error("[check-tx] Provider not initialized. Check BASE_PROVIDER_URL env var.");
    return res.status(500).json({ status: "failed", error: "Server configuration error." });
  }

  const { txHash } = req.query;

  if (!txHash) {
    console.log("[check-tx] Error: Missing txHash query parameter.");
    return res.status(400).json({ status: "failed", error: "Missing txHash." });
  }

  try {
    console.log(`[check-tx] Waiting for tx: ${txHash}`);
    
    // Wait for 1 confirmation, with a 60-second timeout
    const receipt = await readOnlyProvider.waitForTransaction(txHash, 1, 60000); 

    if (receipt.status === 1) {
      console.log(`[check-tx] Tx confirmed: ${txHash}`);
      res.status(200).json({ status: "confirmed" });
    } else {
      console.log(`[check-tx] Tx reverted: ${txHash}`);
      res.status(400).json({ status: "reverted", error: "Transaction was reverted." });
    }
    
  } catch (error) {
    console.error(`[check-tx] Error waiting for tx: ${error.message}`);
    if (error.code === 'TIMEOUT') {
      res.status(408).json({ status: "timeout", error: "Transaction timed out." });
    } else {
      res.status(500).json({ status: "failed", error: error.message });
    }
  }
};
