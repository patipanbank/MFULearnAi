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
            console.log('❌ SAML Authentication failed:', err);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
        }
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPLETE SAML DATA ANALYSIS');
        console.log('='.repeat(80));
        console.log(`📋 NameID: ${profile.nameID}`);
        console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
        console.log(`📋 Session Index: ${profile.sessionIndex}`);
        const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
        console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
        console.log('📊 All SAML Attributes:');
        for (const [key, value] of Object.entries(samlAttributes)) {
            console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
        }
        console.log('\n📄 Raw Profile Object:');
        console.log(JSON.stringify(profile, null, 2));
        console.log('='.repeat(80));
        console.log('🔍 END SAML DATA ANALYSIS');
        console.log('='.repeat(80) + '\n');
        try {
            console.log('\n🔍 Raw SAML Attributes:');
            for (const [key, value] of Object.entries(samlAttributes)) {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
            const getAttr = (keyArr, fallback) => {
                for (const key of keyArr) {
                    if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
                        if (key === 'http://schemas.xmlsoap.org/claims/Group') {
                            return samlAttributes[key];
                        }
                        return samlAttributes[key][0];
                    }
                    if (samlAttributes[key] && !Array.isArray(samlAttributes[key])) {
                        return samlAttributes[key];
                    }
                }
                return fallback;
            };
            const username = (getAttr(['User.Userrname']) ||
                getAttr(['User.Username']) ||
                getAttr(['username']) ||
                getAttr(['uid']));
            const email = (getAttr(['User.Email']) ||
                getAttr(['email']) ||
                getAttr(['mail']));
            const firstName = (getAttr(['first_name']) ||
                getAttr(['firstname']) ||
                getAttr(['givenName']));
            const lastName = (getAttr(['last_name']) ||
                getAttr(['lastname']) ||
                getAttr(['sn']));
            const department = (getAttr(['depart_name']) ||
                getAttr(['department']) ||
                getAttr(['organizationalUnit']));
            let groups = [];
            const groupsAttr = getAttr(['Groups']);
            const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']);
            console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
            console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
            if (groupSids && Array.isArray(groupSids)) {
                groups = groupSids;
                console.log(`🔍 Groups mapping - Using Group SIDs array: ${JSON.stringify(groupSids)}`);
            }
            else if (groupSids && !Array.isArray(groupSids)) {
                groups = [groupSids];
                console.log(`🔍 Groups mapping - Using Group SIDs single: ${groupSids}`);
            }
            else {
                groups = [];
                console.log(`🔍 Groups mapping - No Group SIDs found`);
            }
            const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
            console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);
            if (!username) {
                console.log('❌ Username not found in SAML attributes');
                return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
            }
            console.log('\n🔍 Mapped Values:');
            console.log(`   Username: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   First Name: ${firstName}`);
            console.log(`   Last Name: ${lastName}`);
            console.log(`   Department: ${department}`);
            console.log(`   Groups: ${JSON.stringify(groupsArray)}`);
            const userProfile = {
                nameID: profile.nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups: groupsArray,
            };
            console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
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
            const redirect_url = `${config_1.default.FRONTEND_URL}/auth/callback?token=${token}`;
            console.log(`🔄 Redirecting to: ${redirect_url}`);
            return res.redirect(redirect_url);
        }
        catch (e) {
            console.log(`❌ Error processing SAML attributes: ${e}`);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(e.message)}`);
        }
    })(req, res, next);
});
router.get('/saml/callback', (req, res, next) => {
    passport_1.default.authenticate('saml', async (err, profile, info) => {
        if (err || !profile) {
            console.log('❌ SAML Authentication failed:', err);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
        }
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPLETE SAML DATA ANALYSIS (GET)');
        console.log('='.repeat(80));
        console.log(`📋 NameID: ${profile.nameID}`);
        console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
        console.log(`📋 Session Index: ${profile.sessionIndex}`);
        const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
        console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
        console.log('📊 All SAML Attributes:');
        for (const [key, value] of Object.entries(samlAttributes)) {
            console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
        }
        console.log('\n📄 Raw Profile Object:');
        console.log(JSON.stringify(profile, null, 2));
        console.log('='.repeat(80));
        console.log('🔍 END SAML DATA ANALYSIS (GET)');
        console.log('='.repeat(80) + '\n');
        try {
            console.log('\n🔍 Raw SAML Attributes:');
            for (const [key, value] of Object.entries(samlAttributes)) {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
            const getAttr = (keyArr, fallback) => {
                for (const key of keyArr) {
                    if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
                        if (key === 'http://schemas.xmlsoap.org/claims/Group') {
                            return samlAttributes[key];
                        }
                        return samlAttributes[key][0];
                    }
                    if (samlAttributes[key] && !Array.isArray(samlAttributes[key])) {
                        return samlAttributes[key];
                    }
                }
                return fallback;
            };
            const username = (getAttr(['User.Userrname']) ||
                getAttr(['User.Username']) ||
                getAttr(['username']) ||
                getAttr(['uid']));
            const email = (getAttr(['User.Email']) ||
                getAttr(['email']) ||
                getAttr(['mail']));
            const firstName = (getAttr(['first_name']) ||
                getAttr(['firstname']) ||
                getAttr(['givenName']));
            const lastName = (getAttr(['last_name']) ||
                getAttr(['lastname']) ||
                getAttr(['sn']));
            const department = (getAttr(['depart_name']) ||
                getAttr(['department']) ||
                getAttr(['organizationalUnit']));
            let groups = [];
            const groupsAttr = getAttr(['Groups']);
            const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']);
            console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
            console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
            if (groupSids && Array.isArray(groupSids)) {
                groups = groupSids;
                console.log(`🔍 Groups mapping - Using Group SIDs array: ${JSON.stringify(groupSids)}`);
            }
            else if (groupSids && !Array.isArray(groupSids)) {
                groups = [groupSids];
                console.log(`🔍 Groups mapping - Using Group SIDs single: ${groupSids}`);
            }
            else {
                groups = [];
                console.log(`🔍 Groups mapping - No Group SIDs found`);
            }
            const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
            console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);
            if (!username) {
                console.log('❌ Username not found in SAML attributes');
                return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
            }
            console.log('\n🔍 Mapped Values:');
            console.log(`   Username: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   First Name: ${firstName}`);
            console.log(`   Last Name: ${lastName}`);
            console.log(`   Department: ${department}`);
            console.log(`   Groups: ${JSON.stringify(groupsArray)}`);
            const userProfile = {
                nameID: profile.nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups: groupsArray,
            };
            console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
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
            const redirect_url = `${config_1.default.FRONTEND_URL}/auth/callback?token=${token}`;
            console.log(`🔄 Redirecting to: ${redirect_url}`);
            return res.redirect(redirect_url);
        }
        catch (e) {
            console.log(`❌ Error processing SAML attributes: ${e}`);
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
    const { name_id, session_index } = req.query;
    console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
});
router.get('/logout/saml/manual', (req, res) => {
    console.log('Manual return from SAML logout');
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true&manual=true`);
});
router.post('/logout/saml/callback', (req, res) => {
    console.log('SAML logout callback received (POST)');
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
});
router.get('/logout/saml/callback', (req, res) => {
    console.log('SAML logout callback received (GET)');
    const { SAMLResponse, SAMLRequest, RelayState } = req.query;
    console.log(`GET request - SAMLResponse: ${SAMLResponse ? 'present' : 'not present'}`);
    console.log(`GET request - SAMLRequest: ${SAMLRequest ? 'present' : 'not present'}`);
    console.log(`GET request - RelayState: ${RelayState}`);
    if (!SAMLResponse && !SAMLRequest) {
        console.log('No SAML data in GET request, redirecting to login');
        return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
    }
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
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