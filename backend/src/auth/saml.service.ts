import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SAML, SamlConfig } from '@node-saml/node-saml';
import { Request, Response } from 'express';

export interface SamlUser {
  nameID: string;
  nameIDFormat: string;
  sessionIndex: string;
  attributes: Record<string, string[]>;
}

@Injectable()
export class SamlService {
  private samlConfig: SamlConfig;
  private saml: SAML;

  constructor(private configService: ConfigService) {
    this.samlConfig = this.createSamlConfig();
    this.saml = new SAML(this.samlConfig);
  }

  private createSamlConfig(): SamlConfig {
    const baseUrl = this.configService.get('BASE_URL') || 'http://localhost:3001';
    
    return {
      // Service Provider (SP) Settings
      issuer: this.configService.samlSpEntityId || 'http://localhost:3001',
      callbackUrl: this.configService.samlSpAcsUrl || `${baseUrl}/api/auth/saml/callback`,
      logoutCallbackUrl: `${baseUrl}/api/auth/logout/saml/callback`,
      
      // Identity Provider (IdP) Settings
      entryPoint: this.configService.samlIdpSsoUrl || 'http://localhost:8080/sso',
      logoutUrl: this.configService.samlIdpSloUrl || 'http://localhost:8080/slo',
      
      // Certificates
      idpCert: this.configService.samlCertificate || 'mock-certificate',
      
      // Protocol Settings
      identifierFormat: this.configService.samlIdentifierFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
      
      // Security Settings
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      authnRequestBinding: 'HTTP-Redirect',
      
      // Additional Settings
      additionalParams: {},
      additionalAuthorizeParams: {},
      acceptedClockSkewMs: 0,
      attributeConsumingServiceIndex: '0',
      disableRequestedAuthnContext: false,
      forceAuthn: false,
      skipRequestCompression: false,
      authnContext: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'],
      
      // Logout Settings
      additionalLogoutParams: {},
    };
  }

  async getLoginUrl(relayState?: string): Promise<string> {
    try {
      // TODO: Use actual SAML library method when library version is compatible
      const config = this.samlConfig;
      const baseUrl = config.entryPoint || 'http://localhost:8080/sso';
      const params = new URLSearchParams({
        SAMLRequest: 'placeholder_request',
        RelayState: relayState || '',
        SigAlg: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
      });
      
      return `${baseUrl}?${params.toString()}`;
    } catch (error) {
      console.error('Error generating SAML login URL:', error);
      throw error;
    }
  }

  async validatePostResponse(body: any): Promise<SamlUser> {
    try {
      // TODO: Use actual SAML library method when library version is compatible
      console.log('Validating SAML response:', body);
      
      // Mock response for development
      return {
        nameID: 'mock_user_id',
        nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        sessionIndex: 'mock_session_index',
        attributes: {
          'User.Userrname': ['mock_user'],  // NOTE: typo preserved for IdP compatibility
          'User.Email': ['mock@example.com'],
          'User.FirstName': ['Mock'],
          'User.LastName': ['User'],
          'depart_name': ['IT Department'],
          'Groups': ['student', 'staff']
        }
      };
    } catch (error) {
      console.error('Error validating SAML response:', error);
      throw error;
    }
  }

  async getLogoutUrl(nameID: string, sessionIndex: string, relayState?: string): Promise<string> {
    try {
      // TODO: Use actual SAML library method when library version is compatible
      const config = this.samlConfig;
      const baseUrl = config.logoutUrl || 'http://localhost:8080/slo';
      const params = new URLSearchParams({
        SAMLRequest: 'placeholder_logout_request',
        RelayState: relayState || '',
        SigAlg: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
      });
      
      return `${baseUrl}?${params.toString()}`;
    } catch (error) {
      console.error('Error generating SAML logout URL:', error);
      throw error;
    }
  }

  async validateLogoutResponse(body: any): Promise<boolean> {
    try {
      // TODO: Use actual SAML library method when library version is compatible
      console.log('Validating SAML logout response:', body);
      return true;
    } catch (error) {
      console.error('Error validating SAML logout response:', error);
      throw error;
    }
  }

  async getMetadata(): Promise<string> {
    try {
      // Generate basic SP metadata
      const config = this.samlConfig;
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="${config.issuer}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${config.callbackUrl}"
      index="0" />
    <md:SingleLogoutService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${config.logoutCallbackUrl}" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
      
      return metadata;
    } catch (error) {
      console.error('Error generating SAML metadata:', error);
      throw error;
    }
  }

  // Helper method to extract user profile from SAML attributes
  extractUserProfile(samlUser: SamlUser): any {
    const attributes = samlUser.attributes;
    
    // CRITICAL: รองรับ attribute "User.Userrname" (typo ที่มีอยู่ใน IdP)
    // ห้ามเปลี่ยนแปลง typo นี้เพราะ IdP มีอยู่แล้ว
    const username = (
      attributes['User.Userrname']?.[0] ||  // NOTE: นี่คือ typo ที่ IdP ใช้จริง
      attributes['User.Username']?.[0] ||
      attributes['username']?.[0] ||
      attributes['uid']?.[0] ||
      null
    );

    const email = (
      attributes['User.Email']?.[0] ||
      attributes['email']?.[0] ||
      attributes['mail']?.[0] ||
      null
    );

    const firstName = (
      attributes['User.FirstName']?.[0] ||
      attributes['first_name']?.[0] ||
      attributes['firstname']?.[0] ||
      attributes['givenName']?.[0] ||
      null
    );

    const lastName = (
      attributes['User.LastName']?.[0] ||
      attributes['last_name']?.[0] ||
      attributes['lastname']?.[0] ||
      attributes['sn']?.[0] ||
      null
    );

    const department = (
      attributes['depart_name']?.[0] ||
      attributes['department']?.[0] ||
      attributes['organizationalUnit']?.[0] ||
      null
    );

    const groups = (
      attributes['http://schemas.xmlsoap.org/claims/Group'] ||
      attributes['groups'] ||
      attributes['Groups'] ||
      attributes['memberOf'] ||
      []
    );

    return {
      nameID: samlUser.nameID,
      nameIDFormat: samlUser.nameIDFormat,
      sessionIndex: samlUser.sessionIndex,
      username,
      email,
      firstName,
      lastName,
      department,
      groups
    };
  }
} 