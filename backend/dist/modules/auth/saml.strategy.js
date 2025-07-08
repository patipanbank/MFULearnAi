"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamlStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_saml_1 = require("passport-saml");
function stripCert(cert) {
    if (!cert)
        return undefined;
    return cert
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\n/g, '')
        .trim();
}
function samlConfig() {
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace('http://', 'https://');
    const cert = stripCert(process.env.SAML_CERTIFICATE);
    return {
        issuer: process.env.SAML_SP_ENTITY_ID,
        entryPoint: process.env.SAML_IDP_SSO_URL,
        callbackUrl: `${baseUrl}/api/auth/saml/callback`,
        logoutUrl: process.env.SAML_IDP_SLO_URL,
        cert,
        identifierFormat: null,
        disableRequestedAuthnContext: true,
        logoutCallbackUrl: `${baseUrl}/api/auth/logout/saml/callback`,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        wantAssertionsSigned: true,
    };
}
let SamlStrategy = class SamlStrategy extends (0, passport_1.PassportStrategy)(passport_saml_1.Strategy, 'saml') {
    constructor() {
        super(samlConfig());
    }
    validate(profile, done) {
        done(null, profile);
    }
};
exports.SamlStrategy = SamlStrategy;
exports.SamlStrategy = SamlStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SamlStrategy);
//# sourceMappingURL=saml.strategy.js.map