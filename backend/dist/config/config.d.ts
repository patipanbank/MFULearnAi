export declare const config: {
    port: string | number;
    mongoUri: string | undefined;
    jwtSecret: string;
    redisUrl: string;
    FRONTEND_URL: string | undefined;
    ALLOWED_ORIGINS: string | undefined;
    JWT_SECRET: string;
    JWT_ALGORITHM: string;
    SAML_CERTIFICATE: string | undefined;
    SAML_IDP_SSO_URL: string | undefined;
    SAML_IDP_SLO_URL: string | undefined;
    SAML_SP_ENTITY_ID: string | undefined;
    SAML_IDENTIFIER_FORMAT: string | undefined;
    bedrock: {
        region: string;
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
    };
    saml: {
        entryPoint: string | undefined;
        issuer: string | undefined;
        cert: string | undefined;
    };
    appEnv: string;
};
//# sourceMappingURL=config.d.ts.map