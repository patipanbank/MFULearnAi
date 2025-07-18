"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSamlConfig = getSamlConfig;
const config_1 = require("../config/config");
function getSamlConfig() {
    let cert = config_1.config.SAML_CERTIFICATE || '';
    cert = cert.replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\n/g, '')
        .trim();
    const baseUrl = (config_1.config.FRONTEND_URL || '').replace('http://', 'https://');
    return {
        entryPoint: config_1.config.SAML_IDP_SSO_URL,
        logoutUrl: config_1.config.SAML_IDP_SLO_URL,
        issuer: config_1.config.SAML_SP_ENTITY_ID,
        callbackUrl: `${baseUrl}/api/auth/saml/callback`,
        cert,
        identifierFormat: config_1.config.SAML_IDENTIFIER_FORMAT,
        disableRequestedAuthnContext: false,
        wantAssertionsSigned: true,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        validateInResponseTo: false,
        acceptedClockSkewMs: 5000,
    };
}
//# sourceMappingURL=samlService.js.map