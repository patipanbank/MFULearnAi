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

function getBaseUrl(): string {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // Production: Use the actual domain
    return process.env.FRONTEND_URL || 'https://mfulearnai.mfu.ac.th';
  } else {
    // Development: Use localhost with proper port
    // Check if we're running behind nginx proxy
    const backendHost = process.env.BACKEND_HOST || 'localhost';
    const backendPort = process.env.BACKEND_PORT || '5000';
    
    // If running through docker/nginx, use the proxy URL
    if (process.env.DOCKER_ENV === 'true') {
      return process.env.FRONTEND_URL || 'http://localhost';
    }
    
    // Direct development access
    return `http://${backendHost}:${backendPort}`;
  }
}

function samlConfig(): SamlConfig {
  const baseUrl = getBaseUrl();
  const cert = stripCert(process.env.SAML_CERTIFICATE);
  const env = process.env.NODE_ENV || 'development';
  
  // Base configuration that's always required
  const baseConfig = {
    // Service Provider Configuration
    issuer: process.env.SAML_SP_ENTITY_ID || 'mfulearnai',
    
    // Identity Provider Configuration
    entryPoint: process.env.SAML_IDP_SSO_URL as string,
    logoutUrl: process.env.SAML_IDP_SLO_URL as string,
    
    // Callback URLs - These must match ADFS configuration
    callbackUrl: `${baseUrl}/api/auth/saml/callback`,
    logoutCallbackUrl: `${baseUrl}/api/auth/logout/saml/callback`,
    
    // Security Configuration
    identifierFormat: null,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    wantAssertionsSigned: true,
  };
  
  // Environment-specific settings
  const envConfig = env === 'development' ? {
    // In development, be more lenient with SSL
    skipRequestCompression: true,
    disableRequestedAuthnContext: true,
    forceAuthn: false,
    wantAssertionsSigned: false, // More lenient in development
  } : {
    // In production, enforce strict security
    wantAssertionsSigned: true,
    forceAuthn: true,
    skipRequestCompression: false,
  };
  
  // Combine configurations
  const config = {
    ...baseConfig,
    ...envConfig,
    ...(cert && { cert }),
  } as SamlConfig;
  
  // Log configuration for debugging (only in development)
  if (env === 'development') {
    console.log('🔐 SAML Configuration:', {
      issuer: config.issuer,
      entryPoint: config.entryPoint,
      callbackUrl: config.callbackUrl,
      logoutUrl: config.logoutUrl,
      logoutCallbackUrl: config.logoutCallbackUrl,
      baseUrl,
      env,
      hasCert: !!cert,
    });
  }
  
  return config;
}

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor() {
    super(samlConfig());
  }

  validate(profile: any, done: Function) {
    // Enhanced profile validation
    try {
      // Extract user information from SAML response
      const user = {
        id: profile.nameID || profile.id,
        email: profile.email || profile.emailAddress,
        name: profile.displayName || profile.name,
        firstName: profile.givenName || profile.firstName,
        lastName: profile.surname || profile.lastName,
        department: profile.department,
        role: profile.role || 'user',
        // Add any other attributes you need
        attributes: profile,
      };
      
      // Log user information in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 SAML User Profile:', user);
      }
      
      done(null, user);
    } catch (error) {
      console.error('🚨 SAML Profile Validation Error:', error);
      done(error, null);
    }
  }
} 