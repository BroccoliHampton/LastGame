const express = require('express');
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { ethers } = require("ethers");
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL;
const GAME_URL = process.env.GAME_URL;
const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const START_IMAGE_URL = process.env.START_IMAGE_URL;
const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL;
const FAILED_IMAGE_URL = process.env.FAILED_IMAGE_URL;

let neynarClient;
let provider;

// --- ROUTE 1: The "Front Door" (Always shows the payment button) ---
app.all('/api/index', async (req, res) => {
    try {
        // This route now *always* presents the option to pay.
        const html = createPaymentFrame(START_IMAGE_URL, PUBLIC_URL);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    } catch (e) {
        console.error("Error in /api/index:", e);
        res.status(500).send(`Server Error: ${e.message}`);
    }
});

// --- ROUTE 2: The Transaction Definition (Updated to $0.25) ---
const usdcAbi = ["function transfer(address to, uint256 amount)"];
const usdcInterface = new ethers.utils.Interface(usdcAbi);
const USDC_CONTRACT_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

app.post('/api/transaction', async (req, res) => {
    try {
        // Amount: 0.25 USDC (250,000 wei, since USDC has 6 decimals)
        const amount = ethers.BigNumber.from("250000"); 
        const calldata = usdcInterface.encodeFunctionData("transfer", [YOUR_WALLET_ADDRESS, amount]);
        res.status(200).json({
            chainId: "eip155:8453", // Base Mainnet
            method: "eth_sendTransaction",
            params: { abi: usdcAbi, to: USDC_CONTRACT_ADDRESS_BASE, data: calldata, value: "0" },
        });
    } catch (error) {
        res.status(500).send(`Server Error: ${error.message}`);
    }
});

// --- ROUTE 3: The Payment Verification (No database needed) ---
app.post('/api/verify', async (req, res) => {
    try {
        if (!neynarClient) neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
        if (!provider) provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

        const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);
        const txHash = validation.action.transaction.hash;

        const receipt = await provider.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
            // Payment successful, show the redirect button.
            res.send(createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL));
        } else {
            // Payment failed, show the retry button.
            res.send(createRetryFrame(FAILED_IMAGE_URL, PUBLIC_URL));
        }
    } catch (e) {
        res.status(500).send(`Server Error: ${e.message}`);
    }
});


// --- HTML Frame Generation Helpers ---
function createRedirectFrame(imageUrl, targetUrl) { /* ... same as before ... */ }
function createPaymentFrame(imageUrl, publicUrl) { /* ... same as before, but with updated button text ... */ }
function createRetryFrame(imageUrl, publicUrl) { /* ... same as before ... */ }

// Helper function implementations (copy these as well)
function createRedirectFrame(imageUrl, targetUrl) {
    return `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Launch Game" />
            <meta property="fc:frame:button:1:action" content="link" />
            <meta property="fc:frame:button:1:target" content="${targetUrl}" />
        </head></html>`;
}

function createPaymentFrame(imageUrl, publicUrl) {
    return `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Pay $0.25 USDC to Play" />
            <meta property="fc:frame:button:1:action" content="tx" />
            <meta property="fc:frame:button:1:target" content="${publicUrl}/api/transaction" />
            <meta property="fc:frame:post_url" content="${publicUrl}/api/verify" />
        </head></html>`;
}

function createRetryFrame(imageUrl, publicUrl) {
    return `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Retry Payment" />
            <meta property="fc:frame:post_url" content="${publicUrl}/api/index" />
        </head></html>`;
}

module.exports = app;
