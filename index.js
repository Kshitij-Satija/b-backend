require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const connection = require("./db");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const productRoute = require('./routes/products');
const updateBidRoutes = require('./routes/updateBid');
const userDetailsRoutes = require('./routes/userDetails');
const conversion = require('./routes/conversion');
const roundRoutes = require('./routes/roundUpdate'); // Route for updating round
const loanRoutes = require('./routes/loan'); // Route for loans
const foreignCurrencyRoutes = require('./routes/foreignCurrency'); // New route for foreign currency transactions
const conversionRoutes = require('./routes/conversion');


// Database connection
connection();

// Middlewares
app.use(express.json());

// Configure CORS
app.use(cors({
    origin: 'http://localhost:3000', // Allow requests from this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these HTTP methods
    credentials: true // Allow credentials (cookies, headers, etc.)
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use('/api/products', productRoute); // Route for products
app.use('/api/bids', updateBidRoutes); // Route for updating bids
app.use('/api/userDetails', userDetailsRoutes); // Route for user details
app.use('/api/conversion', conversion); // Route for currency conversion
app.use('/api/round', roundRoutes); // Route for updating round
app.use('/api/loans', loanRoutes); // Route for loans
app.use('/api/foreignCurrency', foreignCurrencyRoutes); // Route for foreign currency transactions
app.use('/api/conversion', conversionRoutes);
const port = process.env.PORT || 8080; // Use 8080 if PORT is not defined
app.listen(port, () => console.log(`Listening on port ${port}...`));
