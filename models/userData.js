const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    treasury: { type: Number, default: 0 },
    GDP: { type: Number, default: 0 },
    Sector: { type: String, required: true },
    wonBids: [{
        productId: { type: String, required: true }, // Ensure this matches your product schema
        productName: { type: String },
        price: { type: Number },
        sector: { type: String },
        countryName: { type: String },
        sectorBonus: { type: String },
        indigeneousBonus: { type: String },
        date: { type: Date, default: Date.now }
    }],
    currencyValue: { type: Number, default: 0 }
});

// Ensure correct indexes are set
userDataSchema.index({ email: 1 }, { unique: true });

const UserData = mongoose.model("UserData", userDataSchema);

module.exports = UserData;
