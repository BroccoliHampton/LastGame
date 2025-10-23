//
// This is the full content for api/payment-frame.js (v18 - New Text)
//
module.exports = async function handler(req, res) {
  console.log("[v18-style] /api/payment-frame called - Method:", req.method)

  try {
    const START_IMAGE_URL = process.env.START_IMAGE_URL || "https://i.imgur.com/IsUWL7j.png"
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://last-game-kappa.vercel.app"
    const GAME_URL = process.env.GAME_URL

    // Validation
    if (!GAME_URL || !PUBLIC_URL) {
      console.error("[v18-style] ERROR: Missing GAME_URL or PUBLIC_URL env vars")
      return res.status(500).send("Server configuration error: Missing required environment variables.")
    }

    console.log("[v18-style] Payment frame loaded")

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Frame</title>

  <style>
    /* Import pixel font */
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    body {
      margin: 0;
      padding: 0;
      /* Classic 8-bit dark purple background */
      background: #2a2a3a;
      /* Pixel font for everything */
      font-family: 'Press Start 2P', cursive;
      color: #f0f0f0; /* Off-white text */
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      /* For sharp pixel rendering */
      image-rendering: pixelated;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    h1 {
      font-size: 1.5rem; /* Pixel fonts are big, scale it down */
      margin-bottom: 1.5rem;
      color: #ffffff;
    }
    p {
      font-size: 0.8rem; /* Scaled down for pixel font */
      margin-bottom: 2rem;
      line-height: 1.5; /* Add spacing for readability */
      opacity: 0.9;
    }
    button {
      /* Use the pixel font */
      font-family: 'Press Start 2P', cursive;
      font-size: 0.9rem;
      font-weight: 600;
      
      /* 8-bit button style */
      background: #f0f0f0; /* Light background */
      color: #2a2a3a;     /* Dark text */
      border: 2px solid #ffffff; /* White border */
      padding: 1rem 1.5rem;
      border-radius: 0; /* Sharp corners */
      cursor: pointer;
      
      /* 8-bit shadow */
      box-shadow: 4px 4px 0px #1a1a2a; /* Darker bg color for shadow */
      
      transition: transform 0.1s, box-shadow 0.1s;
      
      pointer-events: auto;
      position: relative;
      z-index: 10;
    }
    button:hover {
      /* "Press" effect */
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px #1a1a2a;
    }
    button:active {
      /* Full press effect */
      transform: translate(4px, 4px);
      box-shadow: 0px 0px 0px #1a1a2a;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #
