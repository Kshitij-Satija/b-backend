const router = require("express").Router();
const { User, validate } = require("../models/user");
const bcrypt = require("bcrypt");

router.post("/", async (req, res) => {
    try {
        const { error } = validate(req.body);
        if (error)
            return res.status(400).send({ message: error.details[0].message });

        const user = await User.findOne({ email: req.body.email });
        if (user)
            return res
                .status(409)
                .send({ message: "User with given email already exists!" });

        const salt = await bcrypt.genSalt(Number(process.env.SALT));
		
        const salt2 = await bcrypt.genSalt(Number(process.env.SALT2));
        const hashPassword = await bcrypt.hash(req.body.password, salt);

		const userHash = await bcrypt.hash(req.body.email + "KSHITIJ", salt2);

        await new User({
            ...req.body,
            password: hashPassword,
            userHash,
            loggedIn: 0 // Ensure loggedIn is set to default 0
        }).save();
        
        res.status(201).send({ message: "User created successfully" });
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
    }
});

module.exports = router;
