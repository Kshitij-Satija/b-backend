// routes/updateBid.js

const express = require('express');
const router = express.Router();
const Company = require('../models/product'); // Adjust the path based on your project structure
const User = require('../models/user'); // Adjust the path based on your project structure

// Endpoint to handle internal bidding
router.post('/internalBid', async (req, res) => {
    try {
        const { sellerEmail, buyerEmail, productId, bidAmount } = req.body;

        // Validate input
        if (!sellerEmail || !buyerEmail || !productId || bidAmount <= 0) {
            return res.status(400).send('Invalid bid data');
        }

        // Find the product by productId
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Check if bid amount is more than the base price
        if (bidAmount <= product.basePrice) {
            return res.status(400).send('Bid amount must be higher than the base price');
        }

        // Find or create seller and buyer data entries
        let sellerData = await UserData.findOne({ email: sellerEmail });
        let buyerData = await UserData.findOne({ email: buyerEmail });

        if (!sellerData) {
            return res.status(404).send('Seller not found');
        }

        if (!buyerData) {
            return res.status(404).send('Buyer not found');
        }

        // Ensure the buyer has enough funds in their treasury
        if (buyerData.treasury < bidAmount) {
            return res.status(400).send('Buyer has insufficient funds in treasury');
        }

        // Update the seller's and buyer's treasury
        buyerData.treasury -= bidAmount;
        sellerData.treasury += bidAmount;

        // GDP Update calculations
        const sellerSectorBonus = sellerData.Sector === product.description ? 1.2 : 1.0;
        const buyerSectorBonus = buyerData.Sector === product.description ? 1.2 : 1.0;

        const GDPIncrease = bidAmount * sellerSectorBonus;
        const GDPDecrease = bidAmount * buyerSectorBonus;

        // Update the seller's and buyer's GDP
        sellerData.GDP += GDPIncrease;
        buyerData.GDP -= GDPDecrease;

        // Save updated user data
        await sellerData.save();
        await buyerData.save();

        res.send({ message: 'Internal bid processed successfully' });
    } catch (error) {
        console.error('Error processing internal bid:', error);
        res.status(500).send('Server error');
    }
});


module.exports = router;
