const express = require('express');
const app = express();

// This code ONLY listens for a GET request, which is what a browser makes.
app.get('/api/index', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('Hello World! The server is running correctly.');
});

module.exports = app;
