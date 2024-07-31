const express = require("express");
const router = express.Router();
const Loan = require("../models/loan");
const UserData = require("../models/userData"); // Import the correct user data model
const { convertWorldToUserCurrency, convertUserToWorldCurrency } = require('../utils/economy'); // Adjust the path to your utils file
const authMiddleware = require('../middleware/authMiddleware'); // Import the middleware

// Middleware for routes that require level 0 admin access
const adminMiddleware = authMiddleware(0); // Level 0 admins have access

// Allot a loan
router.post("/allotLoan", adminMiddleware, async (req, res) => {
    const { email, principal } = req.body;
    const interest = 12; // Hardcoded interest rate

    try {
        const user = await UserData.findOne({ email });
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Check if a loan already exists for the user
        let loan = await Loan.findOne({ email });

        const principalAmount = Number(principal); // Convert principal to a number

        if (loan) {
            // Update the existing loan
            loan.principal = Number(loan.principal) + principalAmount; // Ensure loan.principal is a number before adding
            loan.remainingPrincipal = Number(loan.remainingPrincipal) + principalAmount; // Ensure loan.remainingPrincipal is a number before adding
        } else {
            // Create a new loan in world currency
            loan = new Loan({
                email,
                principal: principalAmount, // In world currency
                interest,
                remainingPrincipal: principalAmount, // In world currency
            });
        }

        const treasuryInWorldCurrency = await convertUserToWorldCurrency(user.treasury, email);
        user.GDP -= treasuryInWorldCurrency;

        // Convert the principal amount from world currency to user currency
        const principalInUserCurrency = await convertWorldToUserCurrency(principalAmount, email);
        user.treasury += principalInUserCurrency; // Credit the user's treasury in user currency

        const treasuryInWorldCurrency2 = await convertUserToWorldCurrency(user.treasury, email);
        user.GDP += treasuryInWorldCurrency2;

        // Save the updated user data and loan
        await user.save();
        await loan.save();
        res.status(201).send(loan);
    } catch (error) {
        console.error("Error allotting loan:", error);
        res.status(500).send("Failed to allot loan");
    }
});

// Get loans by user email
router.get("/getLoans/:email", adminMiddleware, async (req, res) => {
    const { email } = req.params;

    try {
        const loans = await Loan.find({ email });

        // Convert loan amounts from world currency to user currency for display
        const userLoans = await Promise.all(loans.map(async (loan) => {
            const principalInUserCurrency = await convertWorldToUserCurrency(loan.principal, email);
            return {
                ...loan.toObject(),
                principal: principalInUserCurrency,
                remainingPrincipal: await convertWorldToUserCurrency(loan.remainingPrincipal, email),
            };
        }));

        res.send(userLoans);
    } catch (error) {
        console.error("Error fetching loans:", error);
        res.status(500).send("Failed to fetch loans");
    }
});

// Repay loan
router.post("/repayLoan", adminMiddleware, async (req, res) => {
    const { email, amountInWorldCurrency } = req.body; // User inputs the amount in world currency

    try {
        // Find the loan for the user
        const loan = await Loan.findOne({ email });
        if (!loan) {
            return res.status(404).send("Loan not found");
        }

        const user = await UserData.findOne({ email });
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Convert the repayment amount from world currency to user currency
        const amountInUserCurrency = await convertWorldToUserCurrency(amountInWorldCurrency, email);

        // Ensure the amounts are valid numbers
        if (isNaN(amountInWorldCurrency) || isNaN(amountInUserCurrency) || isNaN(loan.remainingPrincipal)) {
            console.error("Invalid number detected", {
                amountInWorldCurrency,
                amountInUserCurrency,
                remainingPrincipal: loan.remainingPrincipal,
            });
            return res.status(400).send("Invalid repayment amount");
        }

        // Check if the repayment amount in world currency is sufficient
        if (amountInWorldCurrency >= loan.remainingPrincipal) {
            // If amount is more than or equal to remaining principal, fully repay the loan
            await Loan.findByIdAndDelete(loan._id);

            // Deduct the repayment amount from user's treasury
            user.treasury -= amountInUserCurrency; // Amount is in user currency
            await user.save();

            return res.send("Loan fully repaid successfully");
        } else {
            // Partially repay the loan
            const newRemainingPrincipal = loan.remainingPrincipal - amountInWorldCurrency;

            // Ensure newRemainingPrincipal is a valid number
            if (isNaN(newRemainingPrincipal) || newRemainingPrincipal < 0) {
                console.error("Invalid remainingPrincipal after subtraction", {
                    remainingPrincipal: loan.remainingPrincipal,
                    amountInWorldCurrency,
                    newRemainingPrincipal,
                });
                return res.status(500).send("Invalid remaining principal after subtraction");
            }

            loan.remainingPrincipal = newRemainingPrincipal;
            await loan.save();

            const treasuryInWorldCurrency = await convertUserToWorldCurrency(user.treasury, email);
            user.GDP -= treasuryInWorldCurrency;

            // Deduct the repayment amount from user's treasury
            user.treasury -= amountInUserCurrency; // Amount is in user currency

            const treasuryInWorldCurrency2 = await convertUserToWorldCurrency(user.treasury, email);
            user.GDP += treasuryInWorldCurrency2;

            await user.save();

            return res.send("Loan partially repaid successfully");
        }
    } catch (error) {
        console.error("Error repaying loan:", error);
        res.status(500).send("Failed to repay loan");
    }
});

module.exports = router;
