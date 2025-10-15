const express = require('express');
const app = express();

// A simple Farcaster Frame HTML response
app.post('/api/index', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="[https://placehold.co/800x600/000000/FFFFFF?text=Hello+World](https://placehold.co/800x600/000000/FFFFFF?text=Hello+World)" />
            <meta property="og:image" content="[https://placehold.co/800x600/000000/FFFFFF?text=Hello+World](https://placehold.co/800x600/000000/FFFFFF?text=Hello+World)" />
            <meta property="fc:frame:button:1" content="Click Me!" />
        </head>
        <body>
            <h1>My First Frame Server</h1>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
});

module.exports = app;
