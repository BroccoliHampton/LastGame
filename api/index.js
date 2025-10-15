const express = require('express');
const app = express();

// DEBUGGING CHANGE: Using app.all() to accept both GET and POST requests.
// Farcaster frames use POST, but this will help us debug routing issues.
app.all('/api/index', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="https://placehold.co/800x600/000000/FFFFFF?text=Success!" />
            <meta property="og:image" content="https://placehold.co/800x600/000000/FFFFFF?text=Success!" />
            <meta property="fc:frame:button:1" content="It Works!" />
        </head>
        <body>
            <h1>My First Frame Server is Running!</h1>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
});

module.exports = app;
