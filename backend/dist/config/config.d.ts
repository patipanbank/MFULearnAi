export interface Config {
    PORT: number;
    LOG_LEVEL: string;
    MONGODB_URI: string;
    REDIS_URL?: string;
    JWT_SECRET: string;
    JWT_ALGORITHM: string;
    ACCESS_TOKEN_EXPIRE_MINUTES: number;
    FRONTEND_URL?: string;
    ALLOWED_ORIGINS?: string;
    SAML_SP_ENTITY_ID?: string;
    SAML_SP_ACS_URL?: string;
    SAML_IDP_SSO_URL?: string;
    SAML_IDP_SLO_URL?: string;
    SAML_IDP_ENTITY_ID?: string;
    SAML_CERTIFICATE?: string;
    SAML_IDENTIFIER_FORMAT?: string;
    APP_ENV: string;
    AWS_REGION?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    AWS_BEDROCK_MODEL_ID?: string;
}
declare const config: Config;
export default config;
//# sourceMappingURL=config.d.ts.map