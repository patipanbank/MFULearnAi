"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetadata = exports.samlLogout = exports.logoutRedirect = exports.logout = exports.adminLogin = exports.samlCallback = exports.samlLogin = exports.googleCallback = exports.googleLogin = exports.initializeGoogleStrategy = exports.initializeSamlStrategy = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_saml_1 = require("passport-saml");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const config_1 = require("../config/config");
const autoDepartment_service_1 = require("../services/autoDepartment.service");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
/**
 * Map SAML groups to role
 */
const mapGroupToRole = (groups) => {
    const isStudent = groups.some(group => group === 'student_all_grp');
    return isStudent ? 'Students' : 'Staffs';
};
/**
 * Initialize SAML strategy
 */
const initializeSamlStrategy = () => {
    const samlStrategy = new passport_saml_1.Strategy({
        issuer: process.env.SAML_SP_ENTITY_ID,
        callbackUrl: process.env.SAML_SP_ACS_URL,
        entryPoint: process.env.SAML_IDP_SSO_URL,
        logoutUrl: process.env.SAML_IDP_SLO_URL,
        cert: process.env.SAML_CERTIFICATE || '',
        disableRequestedAuthnContext: true,
        forceAuthn: false,
        identifierFormat: null,
        wantAssertionsSigned: true,
        acceptedClockSkewMs: -1,
        validateInResponseTo: false,
        passReqToCallback: true,
    }, async function (req, profile, done) {
        try {
            const nameID = profile.nameID;
            const username = profile['User.Userrname'];
            const email = profile['User.Email'];
            const firstName = profile['first_name'];
            const lastName = profile['last_name'];
            const department = profile['depart_name']?.toLowerCase() || '';
            const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];
            console.log('=== Extracted Values ===');
            console.log({ nameID, username, email, firstName, lastName, department, groups });
            if (!nameID) {
                return done(new Error('Missing required user information'));
            }
            // Ensure department exists
            if (department) {
                await (0, autoDepartment_service_1.ensureDepartmentExists)(department);
            }
            // Fallback for username if undefined (extract from nameID or email)
            const finalUsername = username || nameID.split('@')[0] || email.split('@')[0];
            const user = await User_1.default.findOneAndUpdate({ nameID }, {
                nameID,
                username: finalUsername,
                email,
                firstName,
                lastName,
                department,
                groups: Array.isArray(groups) ? groups : [groups],
                role: mapGroupToRole(Array.isArray(groups) ? groups : [groups]),
                updated: new Date(),
            }, { upsert: true, new: true });
            const token = jsonwebtoken_1.default.sign({ userId: user._id }, config_1.JWT_SECRET, { expiresIn: '24h' });
            const userData = {
                nameID: user.nameID,
                username: user.username,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                depart_name: user.department,
                groups: user.groups,
            };
            return done(null, { token, userData });
        }
        catch (error) {
            console.error('SAML Strategy Error:', error);
            return done(error);
        }
    });
    passport_1.default.use(samlStrategy);
    passport_1.default.serializeUser((user, done) => {
        done(null, user);
    });
    passport_1.default.deserializeUser((user, done) => {
        done(null, user);
    });
    passport_1.default.deserializeUser((user, done) => {
        done(null, user);
    });
};
exports.initializeSamlStrategy = initializeSamlStrategy;
const passport_google_oauth20_1 = require("passport-google-oauth20");
/**
 * Initialize Google Strategy
 */
const initializeGoogleStrategy = () => {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            const firstName = profile.name?.givenName || '';
            const lastName = profile.name?.familyName || '';
            const googleId = profile.id;
            if (!email) {
                return done(new Error('No email found in Google profile'));
            }
            // Default role mapping based on email domain (optional logic)
            // For now, defaulting to 'Students' if not explicitly defined
            const role = email.endsWith('@mfu.ac.th') ? 'Students' : 'Students';
            const department = 'General'; // Default department
            await (0, autoDepartment_service_1.ensureDepartmentExists)(department);
            // Find or create user
            const user = await User_1.default.findOneAndUpdate({ email }, // Match by email
            {
                googleId,
                username: email.split('@')[0],
                email,
                firstName,
                lastName,
                department,
                role, // careful with overwriting existing roles
                groups: ['google_user'],
                updated: new Date(),
            }, { upsert: true, new: true, setDefaultsOnInsert: true });
            const token = jsonwebtoken_1.default.sign({ userId: user._id }, config_1.JWT_SECRET, { expiresIn: '24h' });
            const userData = {
                nameID: user.nameID || googleId,
                username: user.username,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                depart_name: user.department,
                groups: user.groups,
            };
            return done(null, { token, userData });
        }
        catch (error) {
            console.error('Google Strategy Error:', error);
            return done(error);
        }
    }));
};
exports.initializeGoogleStrategy = initializeGoogleStrategy;
/**
 * GET /api/auth/login/google - Initiate Google login
 */
exports.googleLogin = passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
});
/**
 * GET /api/auth/google/callback - Google callback handler
 */
exports.googleCallback = [
    passport_1.default.authenticate('google', { session: false, failureRedirect: '/login' }),
    (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { token, userData } = req.user;
        const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');
        const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth-callback`);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('user_data', encodedUserData);
        res.redirect(redirectUrl.toString());
    }),
];
/**
 * GET /api/auth/login/saml - Initiate SAML login
 */
exports.samlLogin = passport_1.default.authenticate('saml');
/**
 * POST /api/auth/saml/callback - SAML callback handler
 */
exports.samlCallback = [
    passport_1.default.authenticate('saml', { session: false }),
    (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const userData = {
            nameID: req.user.userData.nameID,
            username: req.user.userData.username,
            email: req.user.userData.email,
            firstName: req.user.userData.first_name,
            lastName: req.user.userData.last_name,
            department: req.user.userData.depart_name,
            groups: [mapGroupToRole(req.user.userData.groups || [])],
        };
        // Ensure department exists
        if (userData.department) {
            await (0, autoDepartment_service_1.ensureDepartmentExists)(userData.department);
        }
        const token = jsonwebtoken_1.default.sign({
            nameID: userData.nameID,
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            department: userData.department,
            groups: userData.groups,
        }, config_1.JWT_SECRET, { expiresIn: '7d' });
        const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');
        const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth-callback`);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('user_data', encodedUserData);
        res.redirect(redirectUrl.toString());
    }),
];
/**
 * POST /api/auth/admin/login - Admin login with username/password
 */
exports.adminLogin = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        throw new errors_1.BadRequestError('Please provide username and password');
    }
    const user = await User_1.default.findOne({
        username,
        role: { $in: ['Admin', 'SuperAdmin'] }
    });
    if (!user) {
        throw new errors_1.UnauthorizedError('Account not found');
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new errors_1.UnauthorizedError('Invalid password');
    }
    // Ensure department exists
    if (user.department) {
        await (0, autoDepartment_service_1.ensureDepartmentExists)(user.department);
    }
    const token = jsonwebtoken_1.default.sign({
        userId: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        role: user.role,
        groups: user.groups,
    }, config_1.JWT_SECRET, { expiresIn: '24h' });
    res.json({
        token,
        user: {
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            department: user.department,
            role: user.role,
            groups: user.groups,
        },
    });
});
/**
 * POST /api/auth/logout - Logout
 */
const logout = (req, res) => {
    req.logout(() => {
        res.status(200).json({ message: 'Logged out successfully' });
    });
};
exports.logout = logout;
/**
 * GET /api/auth/logout - Logout redirect
 */
const logoutRedirect = (req, res) => {
    req.logout(() => {
        res.redirect(process.env.SAML_IDP_SLO_URL || '/');
    });
};
exports.logoutRedirect = logoutRedirect;
/**
 * GET /api/auth/logout/saml - SAML logout
 */
const samlLogout = (req, res) => {
    req.logout(() => {
        const logoutUrl = process.env.SAML_IDP_SLO_URL || '';
        res.redirect(logoutUrl);
    });
};
exports.samlLogout = samlLogout;
/**
 * GET /api/auth/metadata - SAML metadata
 */
const getMetadata = (req, res) => {
    // Access the SAML strategy through passport
    const strategy = passport_1.default._strategy('saml');
    if (!strategy) {
        res.status(500).send('SAML strategy not configured');
        return;
    }
    const metadata = strategy.generateServiceProviderMetadata(null, process.env.SAML_CERTIFICATE);
    res.type('application/xml');
    res.send(metadata);
};
exports.getMetadata = getMetadata;
