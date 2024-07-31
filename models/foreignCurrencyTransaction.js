const mongoose = require('mongoose');

const foreignCurrencyTransactionSchema = new mongoose.Schema({
    buyerEmail: { type: String, required: true },
    buyerCountry: { type: String, required: true },
    totalAmountInForeignCurrency: { type: Number, required: true }, // Total amount in the foreign currency
    purchasedCurrencies: [
        {
            countryName: { type: String, required: true },
            amountInSellerCurrency: { type: Number, required: true } // Amount in the seller's local currency
        }
    ]
});

const ForeignCurrencyTransaction = mongoose.model('ForeignCurrencyTransaction', foreignCurrencyTransactionSchema);

module.exports = ForeignCurrencyTransaction;
