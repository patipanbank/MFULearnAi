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
function getBaseUrl() {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') {
        return process.env.FRONTEND_URL || 'https://mfulearnai.mfu.ac.th';
    }
    else {
        const backendHost = process.env.BACKEND_HOST || 'localhost';
        const backendPort = process.env.BACKEND_PORT || '5000';
        if (process.env.DOCKER_ENV === 'true') {
            return process.env.FRONTEND_URL || 'http://localhost';
        }
        return `http://${backendHost}:${backendPort}`;
    }
}
function samlConfig() {
    const baseUrl = getBaseUrl();
    const cert = stripCert(process.env.SAML_CERTIFICATE);
    const env = process.env.NODE_ENV || 'development';
    const baseConfig = {
        issuer: process.env.SAML_SP_ENTITY_ID || 'mfulearnai',
        entryPoint: process.env.SAML_IDP_SSO_URL,
        logoutUrl: process.env.SAML_IDP_SLO_URL,
        callbackUrl: `${baseUrl}/api/auth/saml/callback`,
        logoutCallbackUrl: `${baseUrl}/api/auth/logout/saml/callback`,
        identifierFormat: null,
        disableRequestedAuthnContext: true,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        wantAssertionsSigned: true,
    };
    const envConfig = env === 'development' ? {
        skipRequestCompression: true,
        disableRequestedAuthnContext: true,
        forceAuthn: false,
        wantAssertionsSigned: false,
    } : {
        wantAssertionsSigned: true,
        forceAuthn: true,
        skipRequestCompression: false,
    };
    const config = {
        ...baseConfig,
        ...envConfig,
        ...(cert && { cert }),
    };
    if (env === 'development') {
        console.log('🔐 SAML Configuration:', {
            issuer: config.issuer,
            entryPoint: config.entryPoint,
            callbackUrl: config.callbackUrl,
            logoutUrl: config.logoutUrl,
            logoutCallbackUrl: config.logoutCallbackUrl,
            baseUrl,
            env,
            hasCert: !!cert,
        });
    }
    return config;
}
let SamlStrategy = class SamlStrategy extends (0, passport_1.PassportStrategy)(passport_saml_1.Strategy, 'saml') {
    constructor() {
        super(samlConfig());
    }
    validate(profile, done) {
        try {
            const user = {
                id: profile.nameID || profile.id,
                email: profile.email || profile.emailAddress,
                name: profile.displayName || profile.name,
                firstName: profile.givenName || profile.firstName,
                lastName: profile.surname || profile.lastName,
                department: profile.department,
                role: profile.role || 'user',
                attributes: profile,
            };
            if (process.env.NODE_ENV === 'development') {
                console.log('🔐 SAML User Profile:', user);
            }
            done(null, user);
        }
        catch (error) {
            console.error('🚨 SAML Profile Validation Error:', error);
            done(error, null);
        }
    }
};
exports.SamlStrategy = SamlStrategy;
exports.SamlStrategy = SamlStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SamlStrategy);
//# sourceMappingURL=saml.strategy.js.map