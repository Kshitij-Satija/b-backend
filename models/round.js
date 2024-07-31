const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
    roundNumber: { type: Number, default: 1 },
    bidCount: { type: Number, default: 0 }  // Track the number of bids
});

const Round = mongoose.model('Round', roundSchema);

module.exports = Round;
