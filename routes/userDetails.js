const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const UserData = require('../models/userData');
const Loan = require('../models/loan');
const { convertWorldToUserCurrency, convertUserToWorldCurrency, updateUserCurrencyValues } = require('../utils/economy'); 
const authMiddleware = require('../middleware/authMiddleware');


router.post('/addDetails',authMiddleware(2), async (req, res) => {
    try {
        const { email, treasury, GDP, Sector } = req.body;

        // Validate input
        if (!email || treasury == null || GDP == null || !Sector) {
            return res.status(400).send('Invalid input data');
        }

        // Find or create user data entry
        let userData = await UserData.findOne({ email });
        if (!userData) {
            // Create a new user data entry if it doesn't exist
            userData = new UserData({ email, treasury, GDP, Sector });
            await userData.save();
            
            // Update currency values for new users
            await updateUserCurrencyValues();
        } else {
            // Update existing user data entry
            userData.treasury = treasury;
            userData.GDP = GDP;
            userData.Sector = Sector;
            await userData.save();
        }

        res.send({ message: 'User details added or updated successfully' });
    } catch (error) {
        console.error('Error adding or updating user details:', error);
        res.status(500).send('Server error');
    }
});

// Endpoint to allot a won bid to a user
router.post('/allotWonBid', authMiddleware(1),  async (req, res) => {
    try {
        const { email, productId, bidAmount } = req.body;

        // Validate input
        if (!email || !productId || bidAmount <= 0) {
            return res.status(400).send('Invalid bid data');
        }

        // Find the product by productId
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Find or create user data entry
        let userData = await UserData.findOne({ email });
        if (!userData) {
            userData = new UserData({ email, Sector: "default" }); // Add a default sector if not found
        }

        // Convert bid amount from world currency to user currency
        const bidAmountInUserCurrency = await convertWorldToUserCurrency(bidAmount, email);
        console.log(`Bid Amount in User Currency: ${bidAmountInUserCurrency}`);

        // Ensure the user has enough treasury to cover the bid
        if (userData.treasury < bidAmountInUserCurrency) {
            return res.status(400).send('Insufficient funds in treasury');
        }

        // Determine sector and country bonuses
        const SB = userData.Sector === product.description ? "Yes" : "No";
        const CB = email.split('@')[0].toUpperCase() === product.country.toUpperCase() ? "Yes" : "No";

        // Capitalize the country name
        function capitalizeFirstLetter(string) {
            if (string.length === 0) return string; // Return the string as is if it's empty
            return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
        }
        const cName = capitalizeFirstLetter(email.split('@')[0]);

        // Add won bid details to user data
        userData.wonBids.push({
            productId,
            productName: product.name,
            price: bidAmount,
            sector: product.description,
            countryName: cName,
            sectorBonus: SB,
            indigeneousBonus: CB,
            date: new Date()
        });

        // Convert treasury to world currency
        const treasuryInWorldCurrency = await convertUserToWorldCurrency(userData.treasury, email);
        console.log(`Treasury in World Currency: ${treasuryInWorldCurrency}`);

        // Calculate GDP without treasury
        const GDPWT = userData.GDP - treasuryInWorldCurrency;
        console.log(`GDP without Treasury: ${GDPWT}`);

        // Deduct the bid amount from the user's treasury in their own currency
        userData.treasury -= bidAmountInUserCurrency;

        // GDP Increase calculation
        const sectorBonus = Number(userData.Sector === product.description ? 1.2 : 1.0);
        const countryBonus = Number(email.split('@')[0].toUpperCase() === product.country.toUpperCase() ? 1.2 : 1.0);
        console.log('Sector Bonus:', sectorBonus);
        console.log('Country Bonus:', countryBonus);
        const GDPIncrease = Number(product.startingBid) * Number(sectorBonus) * Number(countryBonus);
        console.log('Product Starting Bid:', product.startingBid);
        console.log(`GDP Increase: ${Number(GDPIncrease)}`);

        const treasuryInWorldCurrency2 = await convertUserToWorldCurrency(userData.treasury, email);
        console.log(`Updated Treasury in World Currency: ${treasuryInWorldCurrency2}`);

        // Update the user's GDP in world currency
        userData.GDP = Number(GDPIncrease) + GDPWT + treasuryInWorldCurrency2 + product.purchaseBonus;
        console.log(`Updated GDP: ${userData.GDP}`);
        
        // Deduct loan interest and principal if applicable
        const loans = await Loan.find({ email });
        for (const loan of loans) {
            const interestAmount = loan.principal * (loan.interest / 100);
            const principalAmount = loan.principal / 10;  // Assuming 10 installments

            loan.remainingPrincipal -= (principalAmount + interestAmount);

            if (loan.remainingPrincipal <= 0) {
                await Loan.deleteOne({ _id: loan._id });
            } else {
                await loan.save();
            }

            // Deduct the interest and principal from the user's treasury
            userData.treasury -= (principalAmount + interestAmount);

            // Ensure the user's treasury does not go negative
            if (userData.treasury < 0) {
                return res.status(400).send('Insufficient funds to cover loan repayment');
            }
        }

        // Save user data with updated treasury balance, won bids, and GDP
        await userData.save();

        // Update currency values for all users
        await updateUserCurrencyValues();

        res.send({ message: 'Bid allotted and treasury adjusted successfully' });
    } catch (error) {
        console.error('Error allotting won bid:', error);
        res.status(500).send('Server error');
    }
});



// Endpoint to reverse a won bid
router.post('/reverseWonBid', authMiddleware(2),async (req, res) => {
    try {
        const { email, productId, bidAmount } = req.body;

        // Validate input
        if (!email || !productId || bidAmount <= 0) {
            return res.status(400).send('Invalid bid data');
        }

        // Find the product by productId
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Find the user data entry
        let userData = await UserData.findOne({ email });
        if (!userData) {
            return res.status(404).send('User not found');
        }

        // Find the won bid
        const wonBidIndex = userData.wonBids.findIndex(bid => bid.productId === productId && bid.price === bidAmount);
        if (wonBidIndex === -1) {
            return res.status(404).send('Won bid not found');
        }

        // Remove the won bid from the user's wonBids array
        userData.wonBids.splice(wonBidIndex, 1);

        // Convert bid amount from world currency to user currency
        const bidAmountInUserCurrency = await convertWorldToUserCurrency(bidAmount, email);
        const treasuryInWorldCurrency = await convertUserToWorldCurrency(userData.treasury, email);
        
        const GDPWT = userData.GDP - treasuryInWorldCurrency;

        // Add the bid amount back to the user's treasury in user currency
        userData.treasury += bidAmountInUserCurrency;


        // GDP Decrease calculation
        const sectorBonus = userData.Sector === product.description ? 1.2 : 1.0;
        const countryBonus = email.split('@')[0].toUpperCase() === product.country.toUpperCase() ? 1.2 : 1.0;
        const GDPDecrease = product.startingBid * sectorBonus * countryBonus;

        const treasuryInWorldCurrency2 = await convertUserToWorldCurrency(userData.treasury, email);
        
        // Update the user's GDP
        userData.GDP = GDPWT - GDPDecrease + treasuryInWorldCurrency2 -product.purchaseBonus;

        // Save user data with updated treasury balance, won bids, and GDP
        await userData.save();

        // Update currency values for all users
        await updateUserCurrencyValues();

        res.send({ message: 'Bid reversed and treasury adjusted successfully' });
    } catch (error) {
        console.error('Error reversing won bid:', error);
        res.status(500).send('Server error');
    }
});

// Endpoint to handle internal bidding
router.post('/internalBid', authMiddleware(1), async (req, res) => {
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

        // Find seller and buyer data entries
        let sellerData = await UserData.findOne({ email: sellerEmail });
        let buyerData = await UserData.findOne({ email: buyerEmail });

        if (!sellerData) {
            return res.status(404).send('Seller not found');
        }

        if (!buyerData) {
            return res.status(404).send('Buyer not found');
        }

        // Ensure the buyer has enough funds in their treasury
        const bidAmountInUserCurrency = await convertWorldToUserCurrency(bidAmount, buyerEmail);
        if (buyerData.treasury < bidAmountInUserCurrency) {
            return res.status(400).send('Buyer has insufficient funds in treasury');
        }

        // Check if the seller has the product in their wonBids
        const wonBidIndex = sellerData.wonBids.findIndex(bid => bid.productId === productId);
        if (wonBidIndex === -1) {
            return res.status(404).send('Product not found in seller\'s won bids');
        }

        // Get the won bid details from the seller
        const wonBid = sellerData.wonBids[wonBidIndex];

        // Convert bid amount from world currency to user currency for treasury updates
        const sellerTreasuryInWorldCurrency = await convertUserToWorldCurrency(sellerData.treasury, sellerEmail);
        const buyerTreasuryInWorldCurrency = await convertUserToWorldCurrency(buyerData.treasury, buyerEmail);
        const bidAmountInBuyerCurrency = await convertWorldToUserCurrency(bidAmount, buyerEmail);
        const bidAmountInSellerCurrency = await convertWorldToUserCurrency(bidAmount, sellerEmail);
        
        // Update the seller's and buyer's treasury
        const BGDPWT = buyerData.GDP - buyerTreasuryInWorldCurrency;
        const SGDPWT = sellerData.GDP - sellerTreasuryInWorldCurrency;
        buyerData.treasury -= bidAmountInBuyerCurrency;
        sellerData.treasury += bidAmountInSellerCurrency;

        // GDP Update calculations
        const sellerSectorBonus = sellerData.Sector === product.description ? 1.2 : 1.0;
        const buyerSectorBonus = buyerData.Sector === product.description ? 1.2 : 1.0;
        const sellerCountryBonus = sellerEmail.split('@')[0].toUpperCase() === product.country.toUpperCase() ? 1.2 : 1.0;
        const buyerCountryBonus = buyerEmail.split('@')[0].toUpperCase() === product.country.toUpperCase() ? 1.2 : 1.0;
        
        const GDPDecrease = Product.startingBid * buyerSectorBonus * buyerCountryBonus;
        const GDPIncrease = Product.startingBid * sellerSectorBonus * sellerCountryBonus;
        const sellerTreasuryInWorldCurrency2 = await convertUserToWorldCurrency(sellerData.treasury, sellerEmail);
        const buyerTreasuryInWorldCurrency2 = await convertUserToWorldCurrency(buyerData.treasury, buyerEmail);
        
        // Update the seller's and buyer's GDP
        buyerData.GDP = BGDPWT - GDPDecrease + buyerTreasuryInWorldCurrency2;
        sellerData.GDP = SGDPWT + GDPIncrease + sellerTreasuryInWorldCurrency2;

        // Remove the won bid from the seller's wonBids array
        sellerData.wonBids.splice(wonBidIndex, 1);

        // Add the won bid to the buyer's wonBids array with the updated price
        buyerData.wonBids.push({
            productId: wonBid.productId,
            productName: wonBid.productName,
            price: bidAmount, // Update with the new bid amount
            date: new Date()
        });

        // Save updated user data
        await sellerData.save();
        await buyerData.save();

        // Update currency values for all users
        await updateUserCurrencyValues();

        res.send({ message: 'Internal bid processed successfully' });
    } catch (error) {
        console.error('Error processing internal bid:', error);
        res.status(500).send('Server error');
    }
});


router.get('/getUserDetails/:email',authMiddleware(0), async (req, res) => {
    try {
        const { email } = req.params;

        // Find the user data by email
        const userData = await UserData.findOne({ email });

        if (!userData) {
            return res.status(404).send('User not found');
        }

        res.send(userData);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
