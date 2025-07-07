export interface AuthConfig {
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
        issuer: string;
        audience: string;
    };
    saml: {
        enabled: boolean;
        entryPoint?: string;
        issuer?: string;
        cert?: string;
        privateKey?: string;
        logoutUrl?: string;
        logoutCallbackUrl?: string;
        identifierFormat?: string;
        authnRequestBinding?: string;
        wantAssertionsSigned?: boolean;
        wantResponseSigned?: boolean;
    };
    session: {
        secret: string;
        resave: boolean;
        saveUninitialized: boolean;
        cookie: {
            secure: boolean;
            httpOnly: boolean;
            maxAge: number;
            sameSite: 'strict' | 'lax' | 'none';
        };
    };
    rateLimit: {
        windowMs: number;
        max: number;
        message: string;
        standardHeaders: boolean;
        legacyHeaders: boolean;
    };
}
export declare const authConfig: () => AuthConfig;
