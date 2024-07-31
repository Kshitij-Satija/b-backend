const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const User = require('../models/user');

// Define base rate for the common currency
const BASE_RATE = 1; // Example base rate, adjust according to your needs
const GLOBAL_GDP = 1000000000; // Example global GDP, adjust as needed

// Function to calculate exchange rate
const calculateExchangeRate = (countryGDP) => {
    return BASE_RATE / (countryGDP / GLOBAL_GDP);
};

// Endpoint to add a new product
router.post('/addProduct', async (req, res) => {
    try {
        const { name, description, startingBid } = req.body;

        // Validate input
        if (!name || !description || startingBid <= 0) {
            return res.status(400).send('Invalid product data');
        }

        const newProduct = new Product({
            name,
            description,
            startingBid,
            isActive: true
        });

        await newProduct.save();
        res.send({ message: 'Product added successfully' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error');
    }
});

// Endpoint to update the winner of a bid and deduct the bid amount
router.post('/updateBid', async (req, res) => {
    try {
        const { productId, winnerEmail, bidAmount } = req.body;

        // Validate input
        if (!productId || !winnerEmail || bidAmount <= 0) {
            return res.status(400).send('Invalid bid data');
        }

        // Find the product and check if it exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Find the winner user by email
        const winner = await User.findOne({ email: winnerEmail });
        if (!winner) {
            return res.status(404).send('User not found');
        }

        // Calculate the exchange rate
        const exchangeRate = calculateExchangeRate(winner.GDP);

        // Convert bid amount from common currency to local currency
        const localBidAmount = bidAmount * exchangeRate;

        // Check if the user has enough funds
        if (winner.treasury < localBidAmount) {
            return res.status(400).send('Insufficient funds');
        }

        // Deduct the bid amount from the winner's treasury in local currency
        winner.treasury -= localBidAmount;
        await winner.save();

        res.send({ message: 'Bid updated and treasury adjusted' });
    } catch (error) {
        console.error('Error updating bid:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
