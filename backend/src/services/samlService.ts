import { Strategy as SamlStrategy, SamlConfig } from 'passport-saml';
import { config } from '../config/config';

export function getSamlConfig(): SamlConfig {
  let cert = config.SAML_CERTIFICATE || '';
  cert = cert.replace('-----BEGIN CERTIFICATE-----', '')
             .replace('-----END CERTIFICATE-----', '')
             .replace(/\n/g, '')
             .trim();

  const baseUrl = (config.FRONTEND_URL || '').replace('http://', 'https://');

  return {
    entryPoint: config.SAML_IDP_SSO_URL!,
    logoutUrl: config.SAML_IDP_SLO_URL!,
    issuer: config.SAML_SP_ENTITY_ID!,
    callbackUrl: `${baseUrl}/api/auth/saml/callback`,
    cert,
    identifierFormat: config.SAML_IDENTIFIER_FORMAT,
    disableRequestedAuthnContext: false,
    wantAssertionsSigned: true,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    validateInResponseTo: false,
    acceptedClockSkewMs: 5000,
  };
} 