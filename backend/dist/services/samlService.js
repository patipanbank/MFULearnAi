"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSamlConfig = getSamlConfig;
const config_1 = __importDefault(require("../config/config"));
function getSamlConfig() {
    let cert = config_1.default.SAML_CERTIFICATE || 'dummy-cert-for-dev';
    cert = cert.replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\n/g, '')
        .trim();
    const baseUrl = (config_1.default.FRONTEND_URL || '').replace('http://', 'https://');
    return {
        entryPoint: config_1.default.SAML_IDP_SSO_URL || 'http://localhost/saml/sso',
        logoutUrl: config_1.default.SAML_IDP_SLO_URL || 'http://localhost/saml/slo',
        issuer: config_1.default.SAML_SP_ENTITY_ID || 'mfu-learn-ai',
        callbackUrl: `${baseUrl}/api/auth/saml/callback`,
        cert,
        identifierFormat: config_1.default.SAML_IDENTIFIER_FORMAT,
        disableRequestedAuthnContext: false,
        wantAssertionsSigned: true,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        validateInResponseTo: false,
        acceptedClockSkewMs: 5000,
    };
}
//# sourceMappingURL=samlService.js.map