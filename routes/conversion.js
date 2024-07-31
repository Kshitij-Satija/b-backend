const express = require('express');
const router = express.Router();
const { convertWorldToUserCurrency, convertUserToWorldCurrency } = require('../utils/economy');
const UserData = require('../models/userData');
const authMiddleware = require('../middleware/authMiddleware'); // Import the middleware

router.post('/convertWorldToUserCurrency', authMiddleware(0),async (req, res) => {
    try {
        const { amount, email } = req.body;
        const result = await convertWorldToUserCurrency(amount, email);
        res.json({ convertedAmount: result });
    } catch (error) {
        console.error('Error converting world to user currency:', error);
        res.status(500).send('Server error');
    }
});

router.post('/convertUserToWorldCurrency',authMiddleware(0), async (req, res) => {
    try {
        const { amount, email } = req.body;
        const result = await convertUserToWorldCurrency(amount, email);
        res.json({ convertedAmount: result });
    } catch (error) {
        console.error('Error converting user to world currency:', error);
        res.status(500).send('Server error');
    }
});

router.get('/currencyValues', async (req, res) => {
    try {
        const users = await UserData.find({});
        const worldGDP = users.reduce((sum, user) => sum + user.GDP, 0);
        const baseValue = 1; // World Currency Value (WCV)

        const currencyValues = users.map(user => {
            const countryCurrencyValue = (user.GDP / worldGDP) * baseValue;
            return {
                email: user.email,
                currencyValue: countryCurrencyValue
            };
        });

        res.send(currencyValues);
    } catch (error) {
        console.error('Error fetching currency values:', error);
        res.status(500).send('Server error');
    }
});
module.exports = router;
