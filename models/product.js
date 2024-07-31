const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    startingBid: { type: Number, required: true },
    country: {type: String, required: true},
    isActive: { type: Boolean, default: true },
    purchaseBonus: { type: Number, required: true },
    roundProfits: {
        round1: { type: Number, default: 0 },
        round2: { type: Number, default: 0 },
        round3: { type: Number, default: 0 },
        round4: { type: Number, default: 0 }
    }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
