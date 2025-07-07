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

export const authConfig = (): AuthConfig => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'mfu-learnai',
    audience: process.env.JWT_AUDIENCE || 'mfu-learnai-users',
  },
  saml: {
    enabled: process.env.SAML_ENABLED === 'true',
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER,
    cert: process.env.SAML_CERT,
    privateKey: process.env.SAML_PRIVATE_KEY,
    logoutUrl: process.env.SAML_LOGOUT_URL,
    logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL,
    identifierFormat: process.env.SAML_IDENTIFIER_FORMAT || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    authnRequestBinding: process.env.SAML_AUTHN_REQUEST_BINDING || 'HTTP-POST',
    wantAssertionsSigned: process.env.SAML_WANT_ASSERTIONS_SIGNED === 'true',
    wantResponseSigned: process.env.SAML_WANT_RESPONSE_SIGNED === 'true',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'fallback-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
}); 