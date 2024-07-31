const express = require('express');
const router = express.Router();
const UserData = require('../models/userData');
const Product = require('../models/product');
const Round = require('../models/round');
const { convertWorldToUserCurrency } = require('../utils/economy'); // Import your currency conversion function
const authMiddleware = require('../middleware/authMiddleware'); // Import the middleware

// Endpoint to update the round number and distribute profits
router.post('/updateRound', authMiddleware(2), async (req, res) => {
    try {
        // Get the current round number
        let round = await Round.findOne();
        if (!round) {
            round = new Round();
        }
        const currentRound = round.roundNumber;

        // Get all user data
        const users = await UserData.find();

        // Iterate over each user to update their treasury based on company profits
        for (const user of users) {
            for (const company of user.wonBids) {
                const companyDetails = await Product.findOne({ productId: company.productId });
                if (companyDetails) {
                    const profit = companyDetails.roundProfits[`round${currentRound}`];
                    if (profit) {
                        // Convert the profit to the user's currency
                        const convertedProfit = await convertWorldToUserCurrency(profit, user.email);
                        user.treasury += convertedProfit;
                    }
                }
            }
            await user.save();
        }

        // Increment the round number
        round.roundNumber = currentRound + 1;
        await round.save();

        res.send({ message: 'Round updated and profits distributed successfully' });
    } catch (error) {
        console.error('Error updating round and distributing profits:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
