const UserData = require('../models/userData');

const BASE_WCV = 100; // Base value of the world currency

// Calculate World GDP
const calculateWorldGDP = async () => {
    const users = await UserData.find({});
    const totalGDP = users.reduce((acc, user) => acc + user.GDP, 0);
    return totalGDP;
};

// Update Each User's Currency Value
const updateUserCurrencyValues = async () => {
    const totalGDP = await calculateWorldGDP();
    const users = await UserData.find({});

    for (const user of users) {
        user.currencyValue = (user.GDP / totalGDP) * BASE_WCV;
        await user.save();
    }
};

// Currency Conversion Logic between users
const convertCurrencyBetweenUsers = async (amount, fromUserEmail, toUserEmail) => {
    const fromUser = await UserData.findOne({ email: fromUserEmail });
    const toUser = await UserData.findOne({ email: toUserEmail });

    if (!fromUser || !toUser) {
        throw new Error('One or both users not found');
    }

    const conversionRate = fromUser.currencyValue / toUser.currencyValue;
    const convertedAmount = amount * conversionRate;

    return convertedAmount;
};

// Currency Conversion Logic between world and user
const convertWorldToUserCurrency = async (amount, userEmail) => {
    const user = await UserData.findOne({ email: userEmail });

    if (!user) {
        throw new Error('User not found');
    }

    const worldToUserRate = user.currencyValue / BASE_WCV;
    const convertedAmount = amount * worldToUserRate;

    return convertedAmount;
};

const convertUserToWorldCurrency = async (amount, userEmail) => {
    const user = await UserData.findOne({ email: userEmail });

    if (!user) {
        throw new Error('User not found');
    }

    const userToWorldRate = BASE_WCV / user.currencyValue;
    const convertedAmount = amount * userToWorldRate;

    return convertedAmount;
};


function getUsername(email) {
    if (email.length === 0) return ''; // Return empty string if email is empty

    // Split the email by '@' and take the first part
    const beforeAt = email.split('@')[0];

    // Split the part before '@' by '.' and take the first part
    const namePart = beforeAt.split('.')[0];

    // Capitalize the first letter and return
    return capitalizeFirstLetter(namePart);
}

const getSellerEmailFromCountry = (country) => `${country}@bnb.com`;



module.exports = {
    calculateWorldGDP,
    updateUserCurrencyValues,
    convertCurrencyBetweenUsers,
    convertWorldToUserCurrency,
    convertUserToWorldCurrency,
    getUsername,
    getSellerEmailFromCountry,
};

