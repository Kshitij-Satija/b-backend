const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

const authMiddleware = (requiredRole) => {
    return async (req, res, next) => {
        // Extract token from headers
        const token = req.header("x-auth-token");
        if (!token) return res.status(401).send({ message: "Access Denied. No token provided." });

        try {
            // Verify token
            console.log('Token:', token);

            const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
            req.user = decoded;

            // Fetch user from database
            const user = await User.findById(req.user._id);
            if (!user) return res.status(404).send({ message: "User not found." });

            // Check user role
            if (user.isAdmin < requiredRole) return res.status(403).send({ message: "Access Denied. Insufficient permissions." });

            // Proceed to next middleware/route handler
            next();
        } catch (ex) {
            res.status(400).send({ message: "Invalid token." });
        }
    };
};

module.exports = authMiddleware;
