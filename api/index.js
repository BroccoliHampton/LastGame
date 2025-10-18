const express = require('express');
const app = express();

const testFrameHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=It+Works](https://placehold.co/800x600/22AA22/FFFFFF?text=It+Works)!" />
        <meta property="og:image" content="[https://placehold.co/800x600/22AA22/FFFFFF?text=It+Works](https://placehold.co/800x600/22AA22/FFFFFF?text=It+Works)!" />
        <meta property="fc:frame:button:1" content="Success!" />
    </head>
    </html>
`;

app.all('/api/index', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(testFrameHtml);
});

module.exports = app;
