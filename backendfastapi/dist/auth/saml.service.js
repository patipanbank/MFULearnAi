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
var SAMLService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMLService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const saml2 = require("saml2-js");
let SAMLService = SAMLService_1 = class SAMLService {
    configService;
    logger = new common_1.Logger(SAMLService_1.name);
    sp;
    idp;
    constructor(configService) {
        this.configService = configService;
        this.initializeSAML();
    }
    initializeSAML() {
        try {
            const spOptions = {
                entity_id: this.configService.get('SAML_ENTITY_ID') || 'http://localhost:3000',
                private_key: this.configService.get('SAML_PRIVATE_KEY') || '',
                certificate: this.configService.get('SAML_CERTIFICATE') || '',
                assert_endpoint: this.configService.get('SAML_ASSERT_ENDPOINT') || 'http://localhost:3000/auth/saml/callback',
                force_authn: true,
                auth_context: {
                    comparison: 'exact',
                    class_refs: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport']
                },
                nameid_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                sign_get_request: false,
                allow_unencrypted_assertion: true
            };
            const idpOptions = {
                sso_login_url: this.configService.get('SAML_SSO_LOGIN_URL') || '',
                sso_logout_url: this.configService.get('SAML_SSO_LOGOUT_URL') || '',
                certificates: [this.configService.get('SAML_IDP_CERTIFICATE') || ''],
                force_authn: true,
                sign_get_request: false,
                allow_unencrypted_assertion: true
            };
            this.sp = new saml2.ServiceProvider(spOptions);
            this.idp = new saml2.IdentityProvider(idpOptions);
            this.logger.log('✅ SAML Service Provider and Identity Provider initialized');
        }
        catch (error) {
            this.logger.error(`❌ Failed to initialize SAML: ${error.message}`);
            throw new Error(`SAML initialization failed: ${error.message}`);
        }
    }
    async generateLoginRequest() {
        try {
            this.logger.log('🔐 Generating SAML login request');
            return new Promise((resolve, reject) => {
                this.sp.create_login_request_url(this.idp, {}, (err, loginUrl, requestId) => {
                    if (err) {
                        this.logger.error(`Error generating login request: ${err.message}`);
                        reject(new Error(`Failed to generate login request: ${err.message}`));
                        return;
                    }
                    this.logger.log(`✅ Generated SAML login request with ID: ${requestId}`);
                    resolve({ redirectUrl: loginUrl, requestId });
                });
            });
        }
        catch (error) {
            this.logger.error(`Error in generateLoginRequest: ${error.message}`);
            throw error;
        }
    }
    async processResponse(samlResponse) {
        try {
            this.logger.log('🔐 Processing SAML response');
            return new Promise((resolve, reject) => {
                this.sp.post_assert(this.idp, { SAMLResponse: samlResponse }, (err, samlAssertion) => {
                    if (err) {
                        this.logger.error(`Error processing SAML response: ${err.message}`);
                        reject(new Error(`Failed to process SAML response: ${err.message}`));
                        return;
                    }
                    if (!samlAssertion) {
                        reject(new Error('No SAML assertion received'));
                        return;
                    }
                    const user = {
                        nameID: samlAssertion.user.name_id,
                        sessionIndex: samlAssertion.user.session_index,
                        attributes: samlAssertion.user.attributes || {}
                    };
                    this.logger.log(`✅ Successfully processed SAML response for user: ${user.nameID}`);
                    resolve(user);
                });
            });
        }
        catch (error) {
            this.logger.error(`Error in processResponse: ${error.message}`);
            throw error;
        }
    }
    async generateLogoutRequest(nameID, sessionIndex) {
        try {
            this.logger.log('🔐 Generating SAML logout request');
            return new Promise((resolve, reject) => {
                this.sp.create_logout_request_url(this.idp, {
                    name_id: nameID,
                    session_index: sessionIndex
                }, (err, logoutUrl, requestId) => {
                    if (err) {
                        this.logger.error(`Error generating logout request: ${err.message}`);
                        reject(new Error(`Failed to generate logout request: ${err.message}`));
                        return;
                    }
                    this.logger.log(`✅ Generated SAML logout request with ID: ${requestId}`);
                    resolve({ redirectUrl: logoutUrl, requestId });
                });
            });
        }
        catch (error) {
            this.logger.error(`Error in generateLogoutRequest: ${error.message}`);
            throw error;
        }
    }
    async processLogoutResponse(samlResponse) {
        try {
            this.logger.log('🔐 Processing SAML logout response');
            return new Promise((resolve, reject) => {
                this.sp.post_assert(this.idp, { SAMLResponse: samlResponse }, (err, samlAssertion) => {
                    if (err) {
                        this.logger.error(`Error processing SAML logout response: ${err.message}`);
                        reject(new Error(`Failed to process SAML logout response: ${err.message}`));
                        return;
                    }
                    this.logger.log('✅ Successfully processed SAML logout response');
                    resolve(true);
                });
            });
        }
        catch (error) {
            this.logger.error(`Error in processLogoutResponse: ${error.message}`);
            throw error;
        }
    }
    validateConfiguration() {
        const errors = [];
        if (!this.configService.get('SAML_ENTITY_ID')) {
            errors.push('SAML_ENTITY_ID is required');
        }
        if (!this.configService.get('SAML_SSO_LOGIN_URL')) {
            errors.push('SAML_SSO_LOGIN_URL is required');
        }
        if (!this.configService.get('SAML_IDP_CERTIFICATE')) {
            errors.push('SAML_IDP_CERTIFICATE is required');
        }
        if (!this.configService.get('SAML_PRIVATE_KEY')) {
            errors.push('SAML_PRIVATE_KEY is required');
        }
        if (!this.configService.get('SAML_CERTIFICATE')) {
            errors.push('SAML_CERTIFICATE is required');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async getMetadata() {
        try {
            return new Promise((resolve, reject) => {
                this.sp.create_metadata(this.configService.get('SAML_ENTITY_ID') || 'http://localhost:3000', (err, metadata) => {
                    if (err) {
                        reject(new Error(`Failed to generate metadata: ${err.message}`));
                        return;
                    }
                    resolve(metadata);
                });
            });
        }
        catch (error) {
            this.logger.error(`Error generating metadata: ${error.message}`);
            throw error;
        }
    }
    extractUserAttributes(samlUser) {
        const attributes = samlUser.attributes;
        return {
            email: this.getAttributeValue(attributes, 'email', 'mail', 'Email') || samlUser.nameID,
            username: this.getAttributeValue(attributes, 'username', 'User.Userrname', 'uid') || samlUser.nameID,
            firstName: this.getAttributeValue(attributes, 'firstName', 'givenName', 'User.FirstName') || '',
            lastName: this.getAttributeValue(attributes, 'lastName', 'sn', 'User.LastName') || '',
            displayName: this.getAttributeValue(attributes, 'displayName', 'cn', 'User.DisplayName') ||
                `${this.getAttributeValue(attributes, 'firstName', 'givenName', 'User.FirstName') || ''} ${this.getAttributeValue(attributes, 'lastName', 'sn', 'User.LastName') || ''}`.trim()
        };
    }
    getAttributeValue(attributes, ...keys) {
        for (const key of keys) {
            if (attributes[key] && attributes[key].length > 0) {
                return attributes[key][0];
            }
        }
        return '';
    }
    async getLoginUrl(relayState) {
        try {
            const result = await this.generateLoginRequest();
            return result.redirectUrl;
        }
        catch (error) {
            this.logger.error(`Error getting login URL: ${error.message}`);
            throw error;
        }
    }
    async processCallback(req) {
        try {
            const samlResponse = req.body.SAMLResponse;
            if (!samlResponse) {
                throw new Error('No SAML response received');
            }
            const samlUser = await this.processResponse(samlResponse);
            const userProfile = this.extractUserAttributes(samlUser);
            return {
                success: true,
                user: userProfile,
            };
        }
        catch (error) {
            this.logger.error(`SAML callback processing error: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }
};
exports.SAMLService = SAMLService;
exports.SAMLService = SAMLService = SAMLService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], SAMLService);
//# sourceMappingURL=saml.service.js.map