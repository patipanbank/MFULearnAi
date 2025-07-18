"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getEnv(key, fallback) {
    if (process.env.APP_ENV === 'production') {
        const prodKey = `PROD_${key}`;
        if (process.env[prodKey])
            return process.env[prodKey];
    }
    return process.env[key] || fallback;
}
exports.config = {
    port: process.env.PORT || 3000,
    mongoUri: getEnv('MONGO_URI', 'mongodb://root:1234@db:27017/mfu_chatbot?authSource=admin'),
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
    FRONTEND_URL: getEnv('FRONTEND_URL', 'http://localhost:5173'),
    ALLOWED_ORIGINS: getEnv('ALLOWED_ORIGINS', '*'),
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
    SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
    SAML_IDP_SSO_URL: process.env.SAML_IDP_SSO_URL,
    SAML_IDP_SLO_URL: process.env.SAML_IDP_SLO_URL,
    SAML_SP_ENTITY_ID: process.env.SAML_SP_ENTITY_ID,
    SAML_IDENTIFIER_FORMAT: process.env.SAML_IDENTIFIER_FORMAT,
    bedrock: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    saml: {
        entryPoint: process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER,
        cert: process.env.SAML_CERT,
    },
    appEnv: process.env.APP_ENV || 'development',
};
//# sourceMappingURL=config.js.map