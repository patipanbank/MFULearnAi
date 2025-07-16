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
exports.ConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ConfigService = class ConfigService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    get mongoUri() {
        return this.configService.get('MONGODB_URI') || 'mongodb://localhost:27017/nestjs-chat';
    }
    get redisHost() {
        return this.configService.get('REDIS_HOST') || 'localhost';
    }
    get redisPort() {
        return parseInt(this.configService.get('REDIS_PORT') || '6379', 10);
    }
    get jwtSecret() {
        return this.configService.get('JWT_SECRET') || 'your-secret-key';
    }
    get jwtExpiresIn() {
        return this.configService.get('JWT_EXPIRES_IN') || '1h';
    }
    get port() {
        return parseInt(this.configService.get('PORT') || '3001', 10);
    }
    get nodeEnv() {
        return this.configService.get('NODE_ENV') || 'development';
    }
    get corsOrigin() {
        return this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    }
    get awsAccessKeyId() {
        return this.configService.get('AWS_ACCESS_KEY_ID') || '';
    }
    get awsSecretAccessKey() {
        return this.configService.get('AWS_SECRET_ACCESS_KEY') || '';
    }
    get awsRegion() {
        return this.configService.get('AWS_REGION') || 'us-east-1';
    }
    get awsS3Bucket() {
        return this.configService.get('AWS_S3_BUCKET') || '';
    }
    get googleClientId() {
        return this.configService.get('GOOGLE_CLIENT_ID') || '';
    }
    get googleClientSecret() {
        return this.configService.get('GOOGLE_CLIENT_SECRET') || '';
    }
    get chromaUrl() {
        return this.configService.get('CHROMA_URL') || 'http://localhost:8000';
    }
    get chromaApiKey() {
        return this.configService.get('CHROMA_API_KEY') || '';
    }
    get samlSpEntityId() {
        return this.configService.get('SAML_SP_ENTITY_ID') || '';
    }
    get samlSpAcsUrl() {
        return this.configService.get('SAML_SP_ACS_URL') || '';
    }
    get samlIdpSsoUrl() {
        return this.configService.get('SAML_IDP_SSO_URL') || '';
    }
    get samlIdpSloUrl() {
        return this.configService.get('SAML_IDP_SLO_URL') || '';
    }
    get samlIdpEntityId() {
        return this.configService.get('SAML_IDP_ENTITY_ID') || '';
    }
    get samlCertificate() {
        return this.configService.get('SAML_CERTIFICATE') || '';
    }
    get samlIdentifierFormat() {
        return this.configService.get('SAML_IDENTIFIER_FORMAT') || '';
    }
    get frontendUrl() {
        return this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    }
    get s3Endpoint() {
        return this.configService.get('S3_ENDPOINT') || 'http://minio:9000';
    }
    get s3AccessKey() {
        return this.configService.get('S3_ACCESS_KEY') || 'minioadmin';
    }
    get s3SecretKey() {
        return this.configService.get('S3_SECRET_KEY') || 'minioadmin123';
    }
    get s3Bucket() {
        return this.configService.get('S3_BUCKET') || 'uploads';
    }
    get s3Region() {
        return this.configService.get('S3_REGION') || 'us-east-1';
    }
    get s3PublicEndpoint() {
        return this.configService.get('S3_PUBLIC_ENDPOINT') || this.s3Endpoint;
    }
    get(key) {
        return this.configService.get(key);
    }
};
exports.ConfigService = ConfigService;
exports.ConfigService = ConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ConfigService);
//# sourceMappingURL=config.service.js.map