const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const isEmpty = require("validator/lib/isEmpty");
const isEmail = require("validator/lib/isEmail");
const { promisify } = require("util");
const { User } = require("../../../models/User");
const secretKey = "a4@801??983";
const hashPass = promisify(bcrypt.hash);

const createToken = async (payload) => {
    try {
        const token = await jwt.sign(payload, secretKey, { expiresIn: "2h" });
        return token;
    } catch (error) {
        return res.status(500).json({ error });
    }
};

const createUser = async (req, res) => {
    const { email, password, confirmPassword, name } = req.body;
    const validatedFields = ["email", "password", "confirmPassword", "name"];
    let errors = {};

    for (let field of validatedFields) {
        if (!req.body[field] || isEmpty(req.body[field])) {
            errors[field] = `${field} is required`;
        }
    }
    if (Object.keys(errors).length) return res.status(500).json(errors);
    if (password.length < 8) errors.password = "password must have at least 8 characters";
    if (password !== confirmPassword) errors.confirmPassword = "password and confirmPassword does not match";
    if (!isEmail(email)) errors.email = "email is invalid";
    if (Object.keys(errors).length) return res.status(500).json(errors);
    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ email: "email already exists" });

    const hash = await hashPass(password, 10);
    const newUser = new User({
        email,
        name,
        password: hash,
    });
    try {
        await newUser.save();
        const { _id } = newUser;
        const token = await createToken({ id: _id, email, name, userType: newUser.userType });
        return res.status(201).json({ token });
    } catch (error) {
        return res.status(500).json({ error });
    }
};

const signIn = async (req, res) => {
    const { email, password } = req.body;
    const errors = {};

    if (!email) errors.email = "email is required";
    if (!password) errors.password = "password is required";
    if(Object.keys(errors).length) return res.status(400).json(errors);

    const user = await User.findOne({ email });
    if (!user) return res.status(500).json({ email: "email does not exist" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ password: "password does not match" });

    delete user.password;
    const token = await createToken({ id: user.id, email, name: user.name, userType: user.userType });
    return res.status(200).json({
        token,
    });
};

module.exports = {
    createUser,
    signIn,
};
