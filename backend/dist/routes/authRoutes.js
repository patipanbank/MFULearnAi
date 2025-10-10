"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_saml_1 = require("passport-saml");
const samlService_1 = require("../services/samlService");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
passport_1.default.use('saml', new passport_saml_1.Strategy((0, samlService_1.getSamlConfig)(), (profile, done) => {
    return done(null, profile || undefined);
}));
router.get('/login/saml', authController_1.authController.samlLogin);
router.post('/saml/callback', authController_1.authController.samlCallback);
router.get('/saml/callback', authController_1.authController.samlCallback);
router.get('/metadata', authController_1.authController.samlMetadata);
router.get('/logout/saml', authController_1.authController.samlLogout);
router.get('/logout/saml/manual', authController_1.authController.samlLogoutManual);
router.post('/logout/saml/callback', authController_1.authController.samlLogoutCallbackPost);
router.get('/logout/saml/callback', authController_1.authController.samlLogoutCallbackGet);
router.post('/admin/login', authController_1.authController.adminLogin);
router.get('/me', auth_1.authenticateJWT, auth_1.requireAnyRole, authController_1.authController.getCurrentUser);
router.post('/refresh', auth_1.authenticateJWT, auth_1.requireAnyRole, authController_1.authController.refreshToken);
router.get('/logout', authController_1.authController.logout);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map