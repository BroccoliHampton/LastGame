const express = require('express');
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { ethers } = require("ethers");
const { kv } = require('@vercel/kv');
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const VERCEL_URL = process.env.VERCEL_URL;
const GAME_URL = process.env.GAME_URL;
const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;

// --- TEMPORARY TEST IMAGE URLS ---
const START_IMAGE_URL = "https://placehold.co/800x600/110515/FFFFFF?text=Last+Game";
const SUCCESS_IMAGE_URL = "https://placehold.co/800x600/110515/FFFFFF?text=Payment+Successful!";
const FAILED_IMAGE_URL = "https://placehold.co/800x600/110515/FFFFFF?text=Payment+Failed";


// --- INITIALIZE CLIENTS ---
let neynarClient;
let provider;

// --- ROUTE 1: The "Front Door" (Handles both GET and POST) ---
app.all('/api/index', async (req, res) => {
    try {
        console.log("--- Request received at /api/index ---");
        if (!neynarClient) neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
        if (!provider) provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

        const validation = req.body.trustedData ? await neynarClient.validateFrameAction(req.body.trustedData.messageBytes) : null;
        const fid = validation ? validation.action.interactor.fid : null;

        let hasPaid = false;
        if (fid) {
            hasPaid = await kv.get(`paid:${fid}`);
        }

        if (hasPaid) {
            console.log("[DEBUG] User has paid. Generating redirect frame.");
            const html = createRedirectFrame(START_IMAGE_URL, GAME_URL);
            console.log("[DEBUG] Sending HTML:", html);
            res.send(html);
        } else {
            console.log("[DEBUG] User has not paid. Generating payment frame.");
            const html = createPaymentFrame(START_IMAGE_URL, VERCEL_URL);
            console.log("[DEBUG] Sending HTML:", html);
            res.send(html);
        }
    } catch (e) {
        console.error("Error in /api/index:", e);
        res.status(500).send(`Server Error in /api/index: ${e.message}`);
    }
});

// --- ROUTE 2: The Transaction Definition ---
const usdcAbi = ["function transfer(address to, uint256 amount)"];
const usdcInterface = new ethers.utils.Interface(usdcAbi);
const USDC_CONTRACT_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

app.post('/api/transaction', async (req, res) => {
    try {
        console.log("--- Request received at /api/transaction ---");
        const amount = ethers.BigNumber.from("1000000"); // 1.00 USDC
        const calldata = usdcInterface.encodeFunctionData("transfer", [YOUR_WALLET_ADDRESS, amount]);
        const tx_details = {
            chainId: "eip155:8453",
            method: "eth_sendTransaction",
            params: {
                abi: usdcAbi,
                to: USDC_CONTRACT_ADDRESS_BASE,
                data: calldata,
                value: "0",
            },
        };
        console.log("[DEBUG] Sending transaction details:", tx_details);
        res.status(200).json(tx_details);
    } catch (error) {
        console.error("Error in /api/transaction:", error);
        res.status(500).send(`Server Error in /api/transaction: ${error.message}`);
    }
});

// --- ROUTE 3: The Payment Verification ---
app.post('/api/verify', async (req, res) => {
    try {
        console.log("--- Request received at /api/verify ---");
        if (!neynarClient) neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
        if (!provider) provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

        const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);
        const txHash = validation.action.transaction.hash;
        const fid = validation.action.interactor.fid;

        const receipt = await provider.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
            await kv.set(`paid:${fid}`, true);
            const html = createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL);
            console.log("[DEBUG] Sending HTML:", html);
            res.send(html);
        } else {
            const html = createRetryFrame(FAILED_IMAGE_URL, VERCEL_URL);
            console.log("[DEBUG] Sending HTML:", html);
            res.send(html);
        }
    } catch (e) {
        console.error("Error in /api/verify:", e);
        res.status(500).send(`Server Error in /api/verify: ${e.message}`);
    }
});


// --- HTML Frame Generation Helpers ---
function createRedirectFrame(imageUrl, targetUrl) {
    const html = `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Launch Game" />
            <meta property="fc:frame:button:1:action" content="link" />
            <meta property="fc:frame:button:1:target" content="${targetUrl}" />
        </head></html>`;
    return html;
}

function createPaymentFrame(imageUrl, vercelUrl) {
    const html = `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Pay $1.00 USDC to Play" />
            <meta property="fc:frame:button:1:action" content="tx" />
            <meta property="fc:frame:button:1:target" content="https://${vercelUrl}/api/transaction" />
            <meta property="fc:frame:post_url" content="https://${vercelUrl}/api/verify" />
        </head></html>`;
    return html;
}

function createRetryFrame(imageUrl, vercelUrl) {
    const html = `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Retry Payment" />
            <meta property="fc:frame:post_url" content="https://${vercelUrl}/api/index" />
        </head></html>`;
    return html;
}

// This is the Vercel entry point.
module.exports = app;

