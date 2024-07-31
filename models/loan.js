const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    email: { type: String, required: true },
    principal: { type: Number, required: true },
    interest: { type: Number, required: true, default: 12 },
    remainingPrincipal: { type: Number, required: true }
});

const Loan = mongoose.model('Loan', loanSchema);

module.exports = Loan;
