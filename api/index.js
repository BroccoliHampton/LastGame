const express = require('express');
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const { kv } = require('@vercel/kv');
const app = express();
app.use(express.json());

// --- CONFIGURATION - Add these to Vercel Environment Variables ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const VERCEL_URL = process.env.VERCEL_URL;
// This is the URL of your *other* Vercel project (the one with the index.html game)
const GAME_URL = "YOUR_EXISTING_GAME_URL_ON_VERCEL"; 
const START_IMAGE_URL = "YOUR_START_SCREEN_IMAGE_URL"; // Image URL for your game's start screen

if (!NEYNAR_API_KEY || !VERCEL_URL || !GAME_URL || !START_IMAGE_URL) {
    throw new Error("Missing required environment variables. Please check your Vercel project settings.");
}

const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);

// Switched back to app.post for production
app.post('/api/index', async (req, res) => {
    try {
        // We check if the request is valid and comes from a real Farcaster user.
        // The body might be empty on the very first load.
        const validation = req.body.trustedData ? await neynarClient.validateFrameAction(req.body.trustedData.messageBytes) : null;
        const fid = validation ? validation.action.interactor.fid : null;

        let hasPaid = false;
        if (fid) {
            // Check our database to see if this user has paid
            hasPaid = await kv.get(`paid:${fid}`);
        }

        if (hasPaid) {
            // If they have paid, show a Frame with a "Launch Game" button that links to your game
            res.send(`
                <!DOCTYPE html><html><head>
                    <meta property="fc:frame" content="vNext" />
                    <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
                    <meta property="fc:frame:button:1" content="Launch Game" />
                    <meta property="fc:frame:button:1:action" content="link" />
                    <meta property="fc:frame:button:1:target" content="${GAME_URL}" />
                </head></html>`);
        } else {
            // If they are new or haven't paid, show the "Pay to Play" transaction button
            res.send(`
                <!DOCTYPE html><html><head>
                    <meta property="fc:frame" content="vNext" />
                    <meta property="fc:frame:image" content="${START_IMAGE_URL}" />
                    <meta property="fc:frame:button:1" content="Pay $1.00 USDC to Play" />
                    <meta property="fc:frame:button:1:action" content="tx" />
                    <meta property="fc:frame:button:1:target" content="https://${VERCEL_URL}/api/transaction" />
                    <meta property="fc:frame:post_url" content="https://${VERCEL_URL}/api/verify" />
                </head></html>`);
        }
    } catch (e) {
        console.error("Error in /api/index:", e);
        res.status(500).send("Server Error");
    }
});

module.exports = app;

