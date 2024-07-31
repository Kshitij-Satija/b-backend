const express = require('express');
const router = express.Router();
const UserData = require('../models/userData');
const ForeignCurrencyTransaction = require('../models/foreignCurrencyTransaction');
const { convertWorldToUserCurrency, convertUserToWorldCurrency } = require('../utils/economy');
const authMiddleware = require('../middleware/authMiddleware'); // Import the middleware

// Function to extract the username from the email, split at '.' and '@', and capitalize the first letter
function capitalizeFirstLetter(string) {
    if (string.length === 0) return string; // Return the string as is if it's empty
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function getUsername(email) {
    if (email.length === 0) return ''; // Return empty string if email is empty

    // Split the email by '@' and take the first part
    const beforeAt = email.split('@')[0];

    // Split the part before '@' by '.' and take the first part
    const namePart = beforeAt.split('.')[0];

    // Capitalize the first letter and return
    return capitalizeFirstLetter(namePart);
}

// Get seller's email from the country name
const getSellerEmailFromCountry = (country) => `${country}@bnb.com`;

// Middleware for routes that require level 0 admin access
const adminMiddleware = authMiddleware(0); // Level 0 admins have access

// Route to buy foreign currency
router.post('/buyForeignCurrency', adminMiddleware, async (req, res) => {
    try {
        const { buyerEmail, sellerCountry, amountInWorldCurrency } = req.body;

        // Find the buyer
        const buyer = await UserData.findOne({ email: buyerEmail });
        if (!buyer) return res.status(404).send('Buyer not found');

        // Find the seller
        const sellerEmail = getSellerEmailFromCountry(sellerCountry);
        const seller = await UserData.findOne({ email: sellerEmail });
        if (!seller) return res.status(404).send('Seller not found');

        // Get the buyer's country using the getUsername function
        const buyerCountry = getUsername(buyerEmail);

        // Calculate the amount to deduct from the buyer's treasury
        const amountInBuyerCurrency = await convertWorldToUserCurrency(amountInWorldCurrency, buyerEmail);

        // Calculate amounts to be added and deducted
        const amountToBuy = amountInWorldCurrency * 0.98; // 98% allotted to buyer
        const amountToSeller = amountInWorldCurrency * 0.02; // 2% to seller's treasury
        const amountInExcSellerCurrency = await convertWorldToUserCurrency(amountToBuy, sellerEmail);

        // Check if buyer has enough treasury to make the purchase
        if (buyer.treasury < amountInBuyerCurrency) {
            return res.status(400).send('Insufficient funds in treasury');
        }

        // Update buyer's treasury (deduct in user's currency)
        buyer.treasury -= amountInBuyerCurrency;
        await buyer.save();

        // Update seller's treasury (add in seller's currency)
        const amountToSellerCurrency = await convertWorldToUserCurrency(amountToSeller, sellerEmail);
        seller.treasury += amountToSellerCurrency;
        await seller.save();

        // Find or create a record for the buyer's country
        let transaction = await ForeignCurrencyTransaction.findOne({ buyerCountry });

        if (transaction) {
            // Update existing record
            transaction.totalAmountInForeignCurrency += amountToBuy;

            // Update purchased currencies array
            const purchasedCurrencyIndex = transaction.purchasedCurrencies.findIndex(
                (item) => item.countryName === sellerCountry
            );

            if (purchasedCurrencyIndex !== -1) {
                transaction.purchasedCurrencies[purchasedCurrencyIndex].amountInSellerCurrency += amountInExcSellerCurrency;
            } else {
                transaction.purchasedCurrencies.push({
                    countryName: sellerCountry,
                    amountInSellerCurrency: amountInExcSellerCurrency
                });
            }
        } else {
            // Create a new record
            transaction = new ForeignCurrencyTransaction({
                buyerEmail: buyer.email,
                buyerCountry: buyerCountry,
                totalAmountInForeignCurrency: amountToBuy,
                purchasedCurrencies: [{
                    countryName: sellerCountry,
                    amountInSellerCurrency: amountInExcSellerCurrency
                }]
            });
        }

        await transaction.save();

        res.send({ message: 'Foreign currency bought and transaction recorded successfully' });
    } catch (error) {
        console.error('Error buying foreign currency:', error);
        res.status(500).send('Server error');
    }
});

// Route to sell foreign currency
router.post('/sellForeignCurrency', adminMiddleware, async (req, res) => {
    try {
        const { buyerEmail, sellerCountry, amountInWorldCurrency } = req.body;

        // Find the buyer
        const buyer = await UserData.findOne({ email: buyerEmail });
        if (!buyer) return res.status(404).send('Buyer not found');

        // Find the seller
        const sellerEmail = getSellerEmailFromCountry(sellerCountry);
        const seller = await UserData.findOne({ email: sellerEmail });
        if (!seller) return res.status(404).send('Seller not found');

        // Find the buyer's transaction record
        const transaction = await ForeignCurrencyTransaction.findOne({ buyerEmail });
        if (!transaction) return res.status(404).send('Transaction record not found');

        // Find the specific currency in the purchased currencies array
        const purchasedCurrency = transaction.purchasedCurrencies.find(
            (item) => item.countryName === sellerCountry
        );
        if (!purchasedCurrency) return res.status(404).send('Purchased currency not found');

        // Convert the amount in seller's currency to world currency
        const amountInWorldCurrencyAvailable = await convertUserToWorldCurrency(purchasedCurrency.amountInSellerCurrency, sellerEmail);

        // Check if the requested amount exceeds the available amount
        if (amountInWorldCurrency > amountInWorldCurrencyAvailable) {
            return res.status(400).send('Insufficient currency amount');
        }

        // Calculate the amounts to be updated
        // No need to update seller's treasury as they are selling the currency

        // Convert amounts using the convertWorldToUserCurrency function
        const amountToAddCurrency = await convertWorldToUserCurrency(amountInWorldCurrency, buyer.email);
        const amountInSellerCurrencyToSubtract = await convertWorldToUserCurrency(amountInWorldCurrency, seller.email);
        // Deduct the amount from the purchased currency
        purchasedCurrency.amountInSellerCurrency -= amountInSellerCurrencyToSubtract;

        // Update the total amount in foreign currency
        transaction.totalAmountInForeignCurrency -= amountInWorldCurrency;

        // Save the updated transaction record
        await transaction.save();
        const buyerTreasuryInWorldCurrency = await convertUserToWorldCurrency(buyer.treasury, buyerEmail);
        buyer.GDP -= buyerTreasuryInWorldCurrency;
        // Update buyer's treasury (add in user's currency)
        buyer.treasury += amountToAddCurrency;
        const buyerTreasuryInWorldCurrency2 = await convertUserToWorldCurrency(buyer.treasury, buyerEmail);
        buyer.GDP -= buyerTreasuryInWorldCurrency2;
        await buyer.save();

        // Seller's treasury remains unaffected in this case

        res.send({ message: 'Foreign currency sold and transaction recorded successfully' });
    } catch (error) {
        console.error('Error selling foreign currency:', error);
        res.status(500).send('Server error');
    }
});

// Route to get foreign reserves
router.get('/foreignReserves/:buyerEmail', adminMiddleware, async (req, res) => {
    try {
        const { buyerEmail } = req.params;

        // Find the transaction records for the buyer
        const transactions = await ForeignCurrencyTransaction.find({ buyerEmail });

        if (!transactions.length) {
            return res.status(404).send('No foreign reserves found for the buyer');
        }

        // Calculate the total amount in foreign currency
        const totalForeignReserves = transactions.reduce((total, transaction) => total + transaction.totalAmountInForeignCurrency, 0);

        res.send({ totalForeignReserves });
    } catch (error) {
        console.error('Error fetching foreign reserves:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
