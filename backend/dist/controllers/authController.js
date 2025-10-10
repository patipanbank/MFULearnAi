"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const passport_1 = __importDefault(require("passport"));
const authService_1 = require("../services/authService");
const config_1 = __importDefault(require("../config/config"));
class AuthController {
    constructor() {
        this.samlLogin = passport_1.default.authenticate('saml', {
            failureRedirect: '/login',
            failureFlash: true
        });
        this.samlCallback = (req, res, next) => {
            passport_1.default.authenticate('saml', async (err, profile, info) => {
                if (err || !profile) {
                    console.log('❌ SAML Authentication failed:', err);
                    return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
                }
                try {
                    const { token, user } = await authService_1.authService.handleSamlLogin(profile);
                    const redirectUrl = `${config_1.default.FRONTEND_URL}/auth/callback?token=${token}`;
                    console.log(`🔄 Redirecting to: ${redirectUrl}`);
                    return res.redirect(redirectUrl);
                }
                catch (error) {
                    console.log(`❌ Error processing SAML login: ${error.message}`);
                    return res.redirect(`${config_1.default.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(error.message)}`);
                }
            })(req, res, next);
        };
        this.samlMetadata = (req, res) => {
            const passportSaml = require('passport-saml');
            const samlServiceModule = require('../services/samlService');
            const SamlStrategy = passportSaml.Strategy;
            const getSamlConfig = samlServiceModule.getSamlConfig;
            const samlStrategy = new SamlStrategy(getSamlConfig(), (() => { }));
            res.type('application/xml');
            const cert = config_1.default.SAML_CERTIFICATE
                ? config_1.default.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim()
                : undefined;
            if (cert) {
                res.send(samlStrategy.generateServiceProviderMetadata(cert));
            }
            else {
                res.send(samlStrategy.generateServiceProviderMetadata(null));
            }
        };
        this.samlLogout = (req, res) => {
            const { name_id, session_index } = req.query;
            console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
        };
        this.samlLogoutManual = (req, res) => {
            console.log('Manual return from SAML logout');
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true&manual=true`);
        };
        this.samlLogoutCallbackPost = (req, res) => {
            console.log('SAML logout callback received (POST)');
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
        };
        this.samlLogoutCallbackGet = (req, res) => {
            console.log('SAML logout callback received (GET)');
            const { SAMLResponse, SAMLRequest, RelayState } = req.query;
            console.log(`GET request - SAMLResponse: ${SAMLResponse ? 'present' : 'not present'}`);
            console.log(`GET request - SAMLRequest: ${SAMLRequest ? 'present' : 'not present'}`);
            console.log(`GET request - RelayState: ${RelayState}`);
            if (!SAMLResponse && !SAMLRequest) {
                console.log('No SAML data in GET request, redirecting to login');
            }
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?saml_logged_out=true`);
        };
        this.adminLogin = async (req, res) => {
            try {
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ detail: 'Username and password are required' });
                }
                const { token, user } = await authService_1.authService.handleAdminLogin(username, password);
                return res.json({
                    token,
                    user: user.toObject()
                });
            }
            catch (error) {
                console.log(`❌ Admin login failed: ${error.message}`);
                return res.status(401).json({ detail: error.message });
            }
        };
        this.getCurrentUser = (req, res) => {
            const user = req.user;
            const userResponse = authService_1.authService.formatUserResponse(user);
            return res.json(userResponse);
        };
        this.refreshToken = (req, res) => {
            const user = req.user;
            const newToken = authService_1.authService.refreshToken(user);
            return res.json({ token: newToken });
        };
        this.logout = (req, res) => {
            return res.redirect(`${config_1.default.FRONTEND_URL}/login?logged_out=true`);
        };
    }
}
exports.authController = new AuthController();
//# sourceMappingURL=authController.js.map