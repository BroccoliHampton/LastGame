const express = require('express');
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { ethers } = require("ethers");
const { kv } = require('@vercel/kv');
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
// Use our new, reliable public URL variable
const PUBLIC_URL = process.env.PUBLIC_URL;
const GAME_URL = process.env.GAME_URL;
const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;

// --- TEMPORARY TEST IMAGE URLS ---
const START_IMAGE_URL = "[https://placehold.co/800x600/110515/FFFFFF?text=Last+Game](https://placehold.co/800x600/110515/FFFFFF?text=Last+Game)";
const SUCCESS_IMAGE_URL = "[https://placehold.co/800x600/110515/FFFFFF?text=Payment+Successful](https://placehold.co/800x600/110515/FFFFFF?text=Payment+Successful)!";
const FAILED_IMAGE_URL = "[https://placehold.co/800x600/110515/FFFFFF?text=Payment+Failed](https://placehold.co/800x600/110515/FFFFFF?text=Payment+Failed)";

let neynarClient;
let provider;

app.all('/api/index', async (req, res) => {
    try {
        if (!neynarClient) neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
        if (!provider) provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

        const validation = req.body.trustedData ? await neynarClient.validateFrameAction(req.body.trustedData.messageBytes) : null;
        const fid = validation ? validation.action.interactor.fid : null;

        let hasPaid = false;
        if (fid) {
            hasPaid = await kv.get(`paid:${fid}`);
        }

        if (hasPaid) {
            res.send(createRedirectFrame(START_IMAGE_URL, GAME_URL));
        } else {
            res.send(createPaymentFrame(START_IMAGE_URL, PUBLIC_URL));
        }
    } catch (e) {
        console.error("Error in /api/index:", e);
        res.status(500).send(`Server Error in /api/index: ${e.message}`);
    }
});

// ... (The rest of your transaction and verify routes remain the same) ...

const usdcAbi = ["function transfer(address to, uint256 amount)"];
const usdcInterface = new ethers.utils.Interface(usdcAbi);
const USDC_CONTRACT_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

app.post('/api/transaction', async (req, res) => {
    try {
        const amount = ethers.BigNumber.from("1000000");
        const calldata = usdcInterface.encodeFunctionData("transfer", [YOUR_WALLET_ADDRESS, amount]);
        res.status(200).json({
            chainId: "eip155:8453",
            method: "eth_sendTransaction",
            params: { abi: usdcAbi, to: USDC_CONTRACT_ADDRESS_BASE, data: calldata, value: "0" },
        });
    } catch (error) {
        res.status(500).send(`Server Error in /api/transaction: ${error.message}`);
    }
});

app.post('/api/verify', async (req, res) => {
    try {
        if (!neynarClient) neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
        if (!provider) provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

        const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);
        const txHash = validation.action.transaction.hash;
        const fid = validation.action.interactor.fid;
        const receipt = await provider.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
            await kv.set(`paid:${fid}`, true);
            res.send(createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL));
        } else {
            res.send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL));
        }
    } catch (e) {
        res.status(500).send(`Server Error in /api/verify: ${e.message}`);
    }
});

function createRedirectFrame(imageUrl, targetUrl) { /* ... same helper ... */ }
function createPaymentFrame(imageUrl, publicUrl) {
    // This function now uses the reliable PUBLIC_URL
    const html = `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Pay $1.00 USDC to Play" />
            <meta property="fc:frame:button:1:action" content="tx" />
            <meta property="fc:frame:button:1:target" content="${publicUrl}/api/transaction" />
            <meta property="fc:frame:post_url" content="${publicUrl}/api/verify" />
        </head></html>`;
    return html;
}
function createRetryFrame(imageUrl, publicUrl) { /* ... same helper ... */ }

module.exports = app;
