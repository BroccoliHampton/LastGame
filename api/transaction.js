const express = require('express');
const { ethers } = require("ethers");
const app = express();

const YOUR_WALLET_ADDRESS = process.env.YOUR_WALLET_ADDRESS;
const USDC_CONTRACT_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

if (!YOUR_WALLET_ADDRESS) {
    throw new Error("You must define YOUR_WALLET_ADDRESS in your environment variables.");
}

const abi = ["function transfer(address to, uint256 amount)"];
const iface = new ethers.utils.Interface(abi);

app.post('/api/transaction', async (req, res) => {
    try {
        const amount = ethers.BigNumber.from("1000000"); // 1.00 USDC (6 decimals)
        const calldata = iface.encodeFunctionData("transfer", [YOUR_WALLET_ADDRESS, amount]);

        res.status(200).json({
            chainId: "eip155:8453", // Base Mainnet
            method: "eth_sendTransaction",
            params: {
                abi: abi,
                to: USDC_CONTRACT_ADDRESS_BASE,
                data: calldata,
                value: "0",
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

module.exports = app;
