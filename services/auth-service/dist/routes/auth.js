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
// SAML Strategy
passport_1.default.use('saml', new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (profile, done) => {
    return done(null, profile || undefined);
}));
// SAML Login
router.get('/login/saml', passport_1.default.authenticate('saml', { failureRedirect: '/login', failureFlash: true }));
// SAML Callback (mapping, JWT, redirect, error handling)
router.post('/saml/callback', (req, res, next) => {
    passport_1.default.authenticate('saml', async (err, profile, info) => {
        if (err || !profile) {
            console.log('❌ SAML Authentication failed:', err);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
        }
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPLETE SAML DATA ANALYSIS');
        console.log('='.repeat(80));
        // 1. Basic SAML info
        console.log(`📋 NameID: ${profile.nameID}`);
        console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
        console.log(`📋 Session Index: ${profile.sessionIndex}`);
        // 2. Get all attributes
        const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
        console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
        console.log('📊 All SAML Attributes:');
        for (const [key, value] of Object.entries(samlAttributes)) {
            console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
        }
        // 3. Raw profile analysis
        console.log('\n📄 Raw Profile Object:');
        console.log(JSON.stringify(profile, null, 2));
        console.log('='.repeat(80));
        console.log('🔍 END SAML DATA ANALYSIS');
        console.log('='.repeat(80) + '\n');
        try {
            // === Enhanced SAML attributes mapping เหมือน Python ===
            console.log('\n🔍 Raw SAML Attributes:');
            for (const [key, value] of Object.entries(samlAttributes)) {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
            const getAttr = (keyArr, fallback) => {
                for (const key of keyArr) {
                    if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
                        // สำหรับ Group SIDs ให้ส่งคืน array ทั้งหมด
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
            // Try different common SAML attribute formats, including the one with typo
            const username = (getAttr(['User.Userrname']) || // Note: This is the actual attribute name with typo
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
            // ปรับปรุง groups mapping ให้ตรงกับ backend-legacy
            let groups = [];
            const groupsAttr = getAttr(['Groups']); // ใช้ Groups string attribute
            const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']); // ใช้ Group SIDs array
            console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
            console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
            // ใช้ Group SIDs เป็นหลัก เหมือน backend-legacy
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
            // Ensure groups is always an array
            const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
            console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);
            if (!username) {
                console.log('❌ Username not found in SAML attributes');
                return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
            }
            // Print mapped values for debugging
            console.log('\n🔍 Mapped Values:');
            console.log(`   Username: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   First Name: ${firstName}`);
            console.log(`   Last Name: ${lastName}`);
            console.log(`   Department: ${department}`);
            console.log(`   Groups: ${JSON.stringify(groupsArray)}`);
            // === สร้าง user profile และ save ลง DB ===
            const userProfile = {
                nameID: profile.nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups: groupsArray, // เก็บ SID array
            };
            console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
            // ใช้ userService จริง
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
            // === สร้าง JWT payload ===
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
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
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
// SAML Callback GET route (for compatibility)
router.get('/saml/callback', (req, res, next) => {
    passport_1.default.authenticate('saml', async (err, profile, info) => {
        if (err || !profile) {
            console.log('❌ SAML Authentication failed:', err);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
        }
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPLETE SAML DATA ANALYSIS (GET)');
        console.log('='.repeat(80));
        // 1. Basic SAML info
        console.log(`📋 NameID: ${profile.nameID}`);
        console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
        console.log(`📋 Session Index: ${profile.sessionIndex}`);
        // 2. Get all attributes
        const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
        console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
        console.log('📊 All SAML Attributes:');
        for (const [key, value] of Object.entries(samlAttributes)) {
            console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
        }
        // 3. Raw profile analysis
        console.log('\n📄 Raw Profile Object:');
        console.log(JSON.stringify(profile, null, 2));
        console.log('='.repeat(80));
        console.log('🔍 END SAML DATA ANALYSIS (GET)');
        console.log('='.repeat(80) + '\n');
        try {
            // === Enhanced SAML attributes mapping เหมือน Python ===
            console.log('\n🔍 Raw SAML Attributes:');
            for (const [key, value] of Object.entries(samlAttributes)) {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
            const getAttr = (keyArr, fallback) => {
                for (const key of keyArr) {
                    if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
                        // สำหรับ Group SIDs ให้ส่งคืน array ทั้งหมด
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
            // Try different common SAML attribute formats, including the one with typo
            const username = (getAttr(['User.Userrname']) || // Note: This is the actual attribute name with typo
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
            // ปรับปรุง groups mapping ให้ตรงกับ backend-legacy
            let groups = [];
            const groupsAttr = getAttr(['Groups']); // ใช้ Groups string attribute
            const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']); // ใช้ Group SIDs array
            console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
            console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
            // ใช้ Group SIDs เป็นหลัก เหมือน backend-legacy
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
            // Ensure groups is always an array
            const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
            console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);
            if (!username) {
                console.log('❌ Username not found in SAML attributes');
                return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
            }
            // Print mapped values for debugging
            console.log('\n🔍 Mapped Values:');
            console.log(`   Username: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   First Name: ${firstName}`);
            console.log(`   Last Name: ${lastName}`);
            console.log(`   Department: ${department}`);
            console.log(`   Groups: ${JSON.stringify(groupsArray)}`);
            // === สร้าง user profile และ save ลง DB ===
            const userProfile = {
                nameID: profile.nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups: groupsArray, // เก็บ SID array
            };
            console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
            // ใช้ userService จริง
            const user = await userService_1.userService.find_or_create_saml_user(userProfile);
            console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
            // === สร้าง JWT payload ===
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
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
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
// SAML Metadata
router.get('/metadata', (req, res) => {
    const samlStrategy = new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (() => { }));
    res.type('application/xml');
    const cert = config_1.default.SAML_CERTIFICATE ? config_1.default.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim() : undefined;
    let metadata = '';
    if (cert) {
        metadata = samlStrategy.generateServiceProviderMetadata(cert);
    }
    else {
        metadata = samlStrategy.generateServiceProviderMetadata(null);
    }
    // Fix: Replace relative callback URL with absolute URL
    const baseUrl = (config_1.default.FRONTEND_URL || '').replace('http://', 'https://');
    console.log('🔧 baseUrl:', baseUrl);
    console.log('🔧 metadata BEFORE:', metadata.substring(0, 600));
    metadata = metadata.replace(/Location="\/api\/auth\/saml\/callback"/g, `Location="${baseUrl}/api/auth/saml/callback"`);
    console.log('🔧 metadata AFTER:', metadata.substring(0, 600));
    res.send(metadata);
});
// SAML Logout (redirect/logout SAML)
router.get('/logout/saml', (req, res) => {
    const { name_id, session_index } = req.query;
    console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
    // For now, redirect to simple logout
    // TODO: Implement proper SAML SLO when needed
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
});
// SAML Logout Manual Return
router.get('/logout/saml/manual', (req, res) => {
    console.log('Manual return from SAML logout');
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true&manual=true`);
});
// SAML Logout Callback
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
    // If no SAML data, just redirect to login
    if (!SAMLResponse && !SAMLRequest) {
        console.log('No SAML data in GET request, redirecting to login');
        return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
    }
    // For now, assume logout succeeded
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
});
// Admin Login (JWT) - เหมือน FastAPI /admin/login
router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // ใช้ userService จริง
    const user = await userService_1.userService.find_admin_by_username(username);
    if (!user || !user.password) {
        return res.status(401).json({ detail: 'User account not found or password not set' });
    }
    const isMatch = await userService_1.userService.verify_admin_password(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ detail: 'Password is incorrect' });
    }
    // สร้าง JWT payload เหมือน Python
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
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 1 วัน
    };
    const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
    return res.json({ token, user: { ...user.toObject(), password: undefined } });
});
// Get Current User Info (JWT) - เหมือน FastAPI /me
router.get('/me', auth_1.authenticateJWT, auth_1.requireAnyRole, (req, res) => {
    // user ถูก decode จาก JWT แล้วใน middleware
    const user = req.user;
    // Format user data to match frontend expectations
    const userResponse = {
        _id: { $oid: user.sub || user._id },
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        role: user.role,
        groups: user.groups || [],
        tokenQuota: user.tokenQuota || 100000,
        dailyTokenLimit: user.dailyTokenLimit || 50000,
        created: user.created || new Date(),
        updated: user.updated || new Date()
    };
    return res.json(userResponse);
});
// Refresh Token (JWT) - เหมือน FastAPI /refresh
router.post('/refresh', auth_1.authenticateJWT, auth_1.requireAnyRole, (req, res) => {
    const user = req.user;
    // สร้าง token ใหม่ (7 วัน) เหมือน Python
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
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
    };
    const newToken = jsonwebtoken_1.default.sign(newTokenPayload, config_1.default.JWT_SECRET, { algorithm: config_1.default.JWT_ALGORITHM });
    return res.json({ token: newToken });
});
// Simple Logout - เหมือน FastAPI /logout
router.get('/logout', (req, res) => {
    return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
});
exports.default = router;
//# sourceMappingURL=auth.js.map