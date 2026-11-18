const { getUser } = require("../services/auth.service.js");

const authorizeUserRole = (...allowedRoles) => {
    return (req, res, next) => {                    // Layer 2: gets its args at REQUEST time
                                                     //          (Express calls this automatically, per request)
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access Denied" });
        }
        next();
    };
}

const restrictToLogin = async (req, res, next) => {
    try {
        const token = req.cookies?.loginSessionId;
        if (!token) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const decoded = getUser(token); // throws if invalid/expired — caught below
        req.user = decoded;             // matches what authorizeUserRole reads
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

/**
 * Attaches req.user when a valid session cookie exists, but never blocks the
 * request. Used by the public chat widget so guests can ask clinic questions
 * while signed-in patients get personalised answers.
 */
const optionalAuth = (req, res, next) => {
    const token = req.cookies?.loginSessionId;
    if (token) {
        try {
            req.user = getUser(token);
        } catch {
            req.user = null;
        }
    }
    return next();
}

module.exports = {
    restrictToLogin,
    optionalAuth,
    authorizeUserRole
};