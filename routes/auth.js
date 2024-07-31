const express = require("express");
const router = express.Router();
const { User } = require("../models/user");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
    try {
        const { error } = validate(req.body);
        if (error)
            return res.status(400).send({ message: error.details[0].message });

        const user = await User.findOne({ email: req.body.email });
        if (!user)
            return res.status(401).send({ message: "Invalid Email or Password" });

        if (user.loggedIn === 1)
            return res.status(401).send({ message: "User is already logged in from another device/browser" });

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword)
            return res.status(401).send({ message: "Invalid Email or Password" });

        user.loggedIn = 1;
        await user.save();

        const token = user.generateAuthToken();
        res.status(200).send({ data: token, isAdmin: user.isAdmin, userHash: user.userHash, message: "Logged in successfully" });
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).send({ message: "Token is required" });

        const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
        const user = await User.findById(decoded._id);

        if (!user) return res.status(401).send({ message: "Invalid token" });

        
        user.loggedIn = 0;
        await user.save();

        res.status(200).send({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
});

router.get("/me", async (req, res) => {
    try {
        // Extract token from headers
        const token = req.header("x-auth-token");
        if (!token) return res.status(401).send("Access Denied. No token provided.");

        // Verify token
        const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
        if (!decoded || !decoded._id) {
            return res.status(400).send("Invalid token.");
        }

        // Fetch user from database
        const user = await User.findById(decoded._id).select("-password");
        if (!user) return res.status(404).send("User not found.");

        // Send user details
        res.send(user);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send("Internal Server Error");
    }
});

const validate = (data) => {
    const schema = Joi.object({
        email: Joi.string().email().required().label("Email"),
        password: Joi.string().required().label("Password"),
    });
    return schema.validate(data);
};

module.exports = router;
