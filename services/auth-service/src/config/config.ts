import dotenv from 'dotenv';

dotenv.config();

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
}

const APP_ENV = process.env.APP_ENV || 'development';

const config: Config = {
  PORT: parseInt(process.env.PORT || '3001'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MONGODB_URI: process.env.MONGODB_URI || '',
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '30'),
  FRONTEND_URL: APP_ENV === 'development' ? process.env.DEV_FRONTEND_URL : process.env.PROD_FRONTEND_URL,
  ALLOWED_ORIGINS: APP_ENV === 'development' ? process.env.DEV_ALLOWED_ORIGINS : process.env.PROD_ALLOWED_ORIGINS,
  SAML_SP_ENTITY_ID: process.env.SAML_SP_ENTITY_ID,
  SAML_SP_ACS_URL: process.env.SAML_SP_ACS_URL,
  SAML_IDP_SSO_URL: process.env.SAML_IDP_SSO_URL,
  SAML_IDP_SLO_URL: process.env.SAML_IDP_SLO_URL,
  SAML_IDP_ENTITY_ID: process.env.SAML_IDP_ENTITY_ID,
  SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
  SAML_IDENTIFIER_FORMAT: process.env.SAML_IDENTIFIER_FORMAT,
  APP_ENV,
};

export default config; 