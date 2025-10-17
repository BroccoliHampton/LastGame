const express = require('express');
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { ethers } = require("ethers");
const { kv } = require('@vercel/kv');
const app = express();
app.use(express.json());

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const BASE_PROVIDER_URL = process.env.BASE_PROVIDER_URL;
const GAME_URL = process.env.GAME_URL;
const SUCCESS_IMAGE_URL = process.env.SUCCESS_IMAGE_URL;
const FAILED_IMAGE_URL = process.env.FAILED_IMAGE_URL;
const VERCEL_URL = process.env.VERCEL_URL;

const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);
const provider = new ethers.providers.JsonRpcProvider(BASE_PROVIDER_URL);

app.post('/api/verify', async (req, res) => {
    try {
        const validation = await neynarClient.validateFrameAction(req.body.trustedData.messageBytes);
        const txHash = validation.action.transaction.hash;
        const fid = validation.action.interactor.fid;

        const receipt = await provider.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
            await kv.set(`paid:${fid}`, true);

            res.send(`
                <!DOCTYPE html><html><head>
                    <meta property="fc:frame" content="vNext" />
                    <meta property="fc:frame:image" content="${SUCCESS_IMAGE_URL}" />
                    <meta property="fc:frame:button:1" content="Launch Game" />
                    <meta property="fc:frame:button:1:action" content="link" />
                    <meta property="fc:frame:button:1:target" content="${GAME_URL}" />
                </head></html>`);
        } else {
            res.send(`
                <!DOCTYPE html><html><head>
                    <meta property="fc:frame" content="vNext" />
                    <meta property="fc:frame:image" content="${FAILED_IMAGE_URL}" />
                    <meta property="fc:frame:button:1" content="Retry Payment" />
                    <meta property="fc:frame:post_url" content="https://${VERCEL_URL}/api/index" />
                </head></html>`);
        }
    } catch (e) {
        console.error("Error in /api/verify:", e);
        res.status(500).send("Server Error");
    }
});

module.exports = app;
