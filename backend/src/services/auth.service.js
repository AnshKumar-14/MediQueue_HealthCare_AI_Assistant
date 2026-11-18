const jwt = require("jsonwebtoken");

const setUser = (user) => {
    return jwt.sign(
        {
        id: user._id,
        email: user.email,
        role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );
}

const getUser = (token) => {
    // try {
    //     if(!token) {
    //         return res.status(401).json({
    //         message: "Not authenticated"
    //     });
    // }
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.user = decoded;
    // next();
    
    // } catch (error) {
    //         return res.status(401).json({
    //         message: "Invalid or expired token"
    //     });
    // }

    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
    setUser,
    getUser
};