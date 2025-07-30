"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_saml_1 = require("@node-saml/passport-saml");
const samlService_1 = require("../services/samlService");
const userService_1 = require("../services/userService");
const auth_1 = require("../middleware/auth");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
const router = (0, express_1.Router)();
passport_1.default.use('saml', new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (profile, done) => {
    return done(null, profile || undefined);
}, (profile, done) => {
    return done(null, profile || undefined);
}, (profile, done) => {
    return done(null, profile || undefined);
}, (profile, done) => {
    return done(null, profile || undefined);
}, (profile, done) => {
    return done(null, profile || undefined);
}));
router.get('/login_saml', passport_1.default.authenticate('saml', { failureRedirect: '/login', failureFlash: true }));
router.post('/saml_callback', (req, res, next) => {
    passport_1.default.authenticate('saml', { failureRedirect: '/login', failureFlash: true }, async (err, profile, info) => {
        if (err) {
            console.error('❌ SAML authentication error:', err);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }
        if (!profile) {
            console.error('❌ No SAML profile received');
            return res.status(401).json({
                success: false,
                error: 'No profile received from SAML provider'
            });
        }
        try {
            const userProfile = {
                nameID: profile.nameID,
                username: profile.username || profile.nameID,
                email: profile.email,
                firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
                lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
                department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organizationalunit'] || '',
                groups: profile.groups || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || []
            };
            console.log('📋 SAML Profile:', userProfile);
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
            const token = jsonwebtoken_1.default.sign({
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department
            }, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
        }
        catch (error) {
            console.error('❌ Error processing SAML callback:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to process authentication'
            });
        }
    })(req, res, next);
});
router.get('/saml_callback', (req, res, next) => {
    passport_1.default.authenticate('saml', { failureRedirect: '/login', failureFlash: true }, async (err, profile, info) => {
        if (err) {
            console.error('❌ SAML authentication error:', err);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }
        if (!profile) {
            console.error('❌ No SAML profile received');
            return res.status(401).json({
                success: false,
                error: 'No profile received from SAML provider'
            });
        }
        try {
            const userProfile = {
                nameID: profile.nameID,
                username: profile.username || profile.nameID,
                email: profile.email,
                firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
                lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
                department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organizationalunit'] || '',
                groups: profile.groups || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || []
            };
            console.log('📋 SAML Profile:', userProfile);
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
            const token = jsonwebtoken_1.default.sign({
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department
            }, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
        }
        catch (error) {
            console.error('❌ Error processing SAML callback:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to process authentication'
            });
        }
    })(req, res, next);
});
router.get('/metadata', (req, res) => {
    const samlStrategy = new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (() => { }), (() => { }));
    res.type('application/xml');
    const cert = process.env.SAML_CERTIFICATE ? process.env.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim() : undefined;
    if (cert) {
        res.send(samlStrategy.generateServiceProviderMetadata(cert));
    }
    else {
        res.send(samlStrategy.generateServiceProviderMetadata(null));
    }
});
router.get('/logout_saml', (req, res) => {
    const { name_id, session_index } = req.query;
    console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?logged_out=true`);
});
router.get('/logout_saml_manual', (req, res) => {
    console.log('Manual return from SAML logout');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true&manual=true`);
});
router.post('/logout_saml_callback', (req, res) => {
    console.log('SAML logout callback received (POST)');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
});
router.get('/logout_saml_callback', (req, res) => {
    console.log('SAML logout callback received (GET)');
    const { SAMLResponse, SAMLRequest, RelayState } = req.query;
    console.log(`GET request - SAMLResponse: ${SAMLResponse ? 'present' : 'not present'}`);
    console.log(`GET request - SAMLRequest: ${SAMLRequest ? 'present' : 'not present'}`);
    console.log(`GET request - RelayState: ${RelayState}`);
    if (!SAMLResponse && !SAMLRequest) {
        console.log('No SAML data in GET request, redirecting to login');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
    }
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
});
router.post('/admin_login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }
        const user = await userService_1.userService.find_admin_by_username(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        const isMatch = await userService_1.userService.verify_admin_password(password, user.password || '');
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        const tokenPayload = {
            sub: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
        return res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            }
        });
    }
    catch (error) {
        console.error('❌ Admin login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
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
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?logged_out=true`);
});
exports.default = router;
//# sourceMappingURL=auth.js.map