const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const authMiddleware = require('../middleware/authMiddleware'); // Import the middleware

// Endpoint to add a new product
router.post('/addProduct', authMiddleware(1),async (req, res) => {
    try {
        const { productId, name, description, startingBid, country, purchaseBonus, round1Profit, round2Profit, round3Profit, round4Profit } = req.body;

        // Validate input
        if (!productId || !name || !description || startingBid <= 0 || !country || !purchaseBonus || !round1Profit || !round2Profit || !round3Profit || !round4Profit) {
            return res.status(400).send('Invalid product data');
        }

        // Check if productId is unique
        const existingProduct = await Product.findOne({ productId });
        if (existingProduct) {
            return res.status(400).send('Product ID already exists');
        }

        const newProduct = new Product({
            productId,
            name,
            description,
            startingBid,
            country,
            purchaseBonus,
            roundProfits: [round1Profit, round2Profit, round3Profit, round4Profit],
            isActive: true
        });

        await newProduct.save();
        res.send({ message: 'Product added successfully' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
