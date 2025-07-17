"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_saml_1 = require("passport-saml");
const samlService_1 = require("../services/samlService");
const userService_1 = require("../services/userService");
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config/config"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
passport_1.default.use('saml', new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (profile, done) => {
    return done(null, profile || undefined);
}));
router.get('/login/saml', passport_1.default.authenticate('saml', { failureRedirect: '/login', failureFlash: true }));
router.post('/saml/callback', (req, res, next) => {
    passport_1.default.authenticate('saml', async (err, profile, info) => {
        if (err || !profile) {
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
        }
        try {
            const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
            const getAttr = (keyArr, fallback) => {
                for (const key of keyArr) {
                    if (samlAttributes[key] && samlAttributes[key][0])
                        return samlAttributes[key][0];
                }
                return fallback;
            };
            const username = getAttr(['User.Userrname', 'User.Username', 'username', 'uid']);
            const email = getAttr(['User.Email', 'email', 'mail']);
            const firstName = getAttr(['first_name', 'firstname', 'givenName']);
            const lastName = getAttr(['last_name', 'lastname', 'sn']);
            const department = getAttr(['depart_name', 'department', 'organizationalUnit']);
            const groups = getAttr(['http://schemas.xmlsoap.org/claims/Group', 'groups', 'Groups', 'memberOf'], []);
            if (!username) {
                return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
            }
            const userProfile = {
                nameID: profile.nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups,
            };
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            const tokenPayload = {
                sub: user._id,
                nameID: user.nameID,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                department: user.department,
                groups: user.groups,
                role: user.role,
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            };
            const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
            return res.redirect(`${config_1.default.FRONTEND_URL}/auth/callback?token=${token}`);
        }
        catch (e) {
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(e.message)}`);
        }
    })(req, res, next);
});
router.get('/metadata', (req, res) => {
    const samlStrategy = new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (() => { }));
    res.type('application/xml');
    const cert = config_1.default.SAML_CERTIFICATE ? config_1.default.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim() : undefined;
    if (cert) {
        res.send(samlStrategy.generateServiceProviderMetadata(cert));
    }
    else {
        res.send(samlStrategy.generateServiceProviderMetadata(null));
    }
});
router.get('/logout/saml', (req, res) => {
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
});
router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await userService_1.userService.find_admin_by_username(username);
    if (!user || !user.password) {
        return res.status(401).json({ detail: 'User account not found or password not set' });
    }
    const isMatch = await userService_1.userService.verify_admin_password(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ detail: 'Password is incorrect' });
    }
    const tokenPayload = {
        sub: user._id,
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        groups: user.groups,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    };
    const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
    return res.json({ token, user: { ...user.toObject(), password: undefined } });
});
router.get('/me', auth_1.authenticateJWT, auth_1.requireAnyRole, (req, res) => {
    const user = req.user;
    return res.json(user);
});
router.post('/refresh', auth_1.authenticateJWT, auth_1.requireAnyRole, (req, res) => {
    const user = req.user;
    const newTokenPayload = {
        sub: user.sub,
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        groups: user.groups,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    const newToken = jsonwebtoken_1.default.sign(newTokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
    return res.json({ token: newToken });
});
router.get('/logout', (req, res) => {
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
});
exports.default = router;
//# sourceMappingURL=auth.js.map