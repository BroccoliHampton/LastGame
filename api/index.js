Problem: Persistent Vercel Routing Errors

The "Cannot GET" error is persisting because Vercel is struggling to correctly route requests between the multiple files in our api directory.

The Solution: A Single, Unified Server File

The most reliable and standard way to fix this is to consolidate all our server logic into a single entry point: api/index.js. This file will handle all routes (/api/index, /api/transaction, and /api/verify), removing any chance for Vercel's router to get confused.

Step 1: Update Your vercel.json File

First, let's simplify your vercel.json file. This new version tells Vercel that every request starting with /api/ should be handled by the api/index.js file.

Go to your GitHub repository, edit vercel.json, and replace its content with this:

{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/index.js"
    }
  ]
}


Step 2: Update Your api/index.js File

Next, replace the entire content of your api/index.js file with the new, unified code below. This single file now contains all the logic that was previously split across three files.

Go to your GitHub repository, edit api/index.js, and replace its content with this:

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
const START_IMAGE_URL = process.env.START_IMAGE_URL;
const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL;
const FAILED_IMAGE_URL = process.env.FAILED_IMAGE_URL;
const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;

const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
const provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

// --- ROUTE 1: The "Front Door" ---
app.post('/api/index', async (req, res) => {
    try {
        const validation = req.body.trustedData ? await neynarClient.validateFrameAction(req.body.trustedData.messageBytes) : null;
        const fid = validation ? validation.action.interactor.fid : null;

        let hasPaid = false;
        if (fid) {
            hasPaid = await kv.get(`paid:${fid}`);
        }

        if (hasPaid) {
            res.send(createRedirectFrame(START_IMAGE_URL, GAME_URL));
        } else {
            res.send(createPaymentFrame(START_IMAGE_URL, VERCEL_URL));
        }
    } catch (e) {
        res.status(500).send("Server Error in /api/index");
    }
});

// --- ROUTE 2: The Transaction Definition ---
const usdcAbi = ["function transfer(address to, uint256 amount)"];
const usdcInterface = new ethers.utils.Interface(usdcAbi);
const USDC_CONTRACT_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

app.post('/api/transaction', async (req, res) => {
    try {
        const amount = ethers.BigNumber.from("1000000"); // 1.00 USDC
        const calldata = usdcInterface.encodeFunctionData("transfer", [YOUR_WALLET_ADDRESS, amount]);

        res.status(200).json({
            chainId: "eip155:8453",
            method: "eth_sendTransaction",
            params: {
                abi: usdcAbi,
                to: USDC_CONTRACT_ADDRESS_BASE,
                data: calldata,
                value: "0",
            },
        });
    } catch (error) {
        res.status(500).send("Server Error in /api/transaction");
    }
});

// --- ROUTE 3: The Payment Verification ---
app.post('/api/verify', async (req, res) => {
    try {
        const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);
        const txHash = validation.action.transaction.hash;
        const fid = validation.action.interactor.fid;

        const receipt = await provider.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
            await kv.set(`paid:${fid}`, true);
            res.send(createRedirectFrame(SUCCESS_IMAGE_URL, GAME_URL));
        } else {
            res.send(createRetryFrame(FAILED_IMAGE_URL, VERCEL_URL));
        }
    } catch (e) {
        res.status(500).send("Server Error in /api/verify");
    }
});


// --- HTML Frame Generation Helpers ---
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

function createPaymentFrame(imageUrl, vercelUrl) {
    return `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Pay $1.00 USDC to Play" />
            <meta property="fc:frame:button:1:action" content="tx" />
            <meta property="fc:frame:button:1:target" content="https://${vercelUrl}/api/transaction" />
            <meta property="fc:frame:post_url" content="https://${vercelUrl}/api/verify" />
        </head></html>`;
}

function createRetryFrame(imageUrl, vercelUrl) {
    return `
        <!DOCTYPE html><html><head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${imageUrl}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="fc:frame:button:1" content="Retry Payment" />
            <meta property="fc:frame:post_url" content="https://${vercelUrl}/api/index" />
        </head></html>`;
}

// This is the Vercel entry point.
module.exports = app;
