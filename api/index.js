const express = require('express');
const app = express();

const testFrameHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Responding](https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Responding)!" />
        <meta property="og:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Responding](https://placehold.co/800x600/22AA22/FFFFFF?text=Server+is+Responding)!" />
        <meta property="fc:frame:button:1" content="Success!" />
    </head>
    </html>
`;

// This route will handle all requests and respond immediately.
app.all('/api/index', (req, res) => {
    try {
        console.log("--- Serving minimal test frame to diagnose timeout ---");
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(testFrameHtml);
    } catch (e) {
        console.error("Error in minimal test:", e);
        res.status(500).send("Server Error");
    }
});

// This is the Vercel entry point.
module.exports = app;

