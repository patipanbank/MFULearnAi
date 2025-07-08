import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, SamlConfig } from 'passport-saml';

function stripCert(cert?: string): string | undefined {
  if (!cert) return undefined;
  return cert
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '')
    .trim();
}

function samlConfig(): SamlConfig {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace('http://', 'https://');
  const cert = stripCert(process.env.SAML_CERTIFICATE);

  return {
    issuer: process.env.SAML_SP_ENTITY_ID as string,
    entryPoint: process.env.SAML_IDP_SSO_URL as string,
    callbackUrl: `${baseUrl}/api/auth/saml/callback`,
    logoutUrl: process.env.SAML_IDP_SLO_URL as string,
    cert,
    identifierFormat: null,
    disableRequestedAuthnContext: true,
    logoutCallbackUrl: `${baseUrl}/api/auth/logout/saml/callback`,
    // security options similar to python config strict mode
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    wantAssertionsSigned: true,
  } as SamlConfig;
}

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor() {
    super(samlConfig());
  }

  validate(profile: any, done: Function) {
    done(null, profile);
  }
} 