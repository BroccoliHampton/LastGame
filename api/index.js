const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// CORRECTED HTML: The 'content' attributes for images now contain only the direct URL,
// without any extra brackets or markdown formatting.
const testFrameHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Frame</title>
        <meta property="og:title" content="Test Frame" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="[https://placehold.co/800x600/28a745/ffffff?text=Success](https://placehold.co/800x600/28a745/ffffff?text=Success)!" />
        <meta property="og:image" content="[https://placehold.co/800x600/28a745/ffffff?text=Success](https://placehold.co/800x600/28a745/ffffff?text=Success)!" />
        <meta property="fc:frame:button:1" content="It Works!" />
    </head>
    <body>
        <p>If you see this, the server is running.</p>
    </body>
    </html>
`;

// This route will handle all requests to the root of the serverless function.
app.all('/api', (req, res) => {
    res.setHeader('Cache-Control', 'max-age=0, s-maxage=0');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(testFrameHtml);
});

// This is for Vercel to export the serverless function.
module.exports = app;
