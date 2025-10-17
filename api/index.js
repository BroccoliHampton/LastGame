const express = require('express');
const app = express();

// This is a minimal Frame HTML with a known-good image URL.
// It uses no environment variables and makes no external calls.
const testFrameHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Working](https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Working)!" />
        <meta property="og:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Working](https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Working)!" />
        <meta property="fc:frame:button:1" content="Success!" />
    </head>
    </html>
`;

// This route will now handle all requests to /api/*
app.all('/api/index', async (req, res) => {
    try {
        console.log("--- Serving minimal test frame (Corrected) ---");
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(testFrameHtml);
    } catch (e) {
        console.error("Error in minimal test:", e);
        res.status(500).send("Server Error");
    }
});

// We keep the other routes so the server doesn't crash, but they won't be called.
app.post('/api/transaction', (req, res) => res.status(500).send("Not implemented in test."));
app.post('/api/verify', (req, res) => res.status(500).send("Not implemented in test."));

module.exports = app;
