function createRedirectFrame(imageUrl, targetUrl) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="fc:frame:button:1" content="Launch Game" />
    <meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="${targetUrl}" />
</head>
<body></body>
</html>`
}

function createPaymentFrame(imageUrl, publicUrl) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="fc:frame:button:1" content="Pay $0.25 USDC to Play" />
    <meta property="fc:frame:button:1:action" content="tx" />
    <meta property="fc:frame:button:1:target" content="${publicUrl}/api/transaction" />
    <meta property="fc:frame:post_url" content="${publicUrl}/api/verify" />
</head>
<body></body>
</html>`
}

function createRetryFrame(imageUrl, publicUrl) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="fc:frame:button:1" content="Retry Payment" />
    <meta property="fc:frame:post_url" content="${publicUrl}/api/index" />
</head>
<body></body>
</html>`
}

module.exports = {
  createRedirectFrame,
  createPaymentFrame,
  createRetryFrame,
}
