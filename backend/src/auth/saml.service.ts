import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as saml2 from 'saml2-js';

export interface SAMLUser {
  nameID: string;
  sessionIndex: string;
  attributes: Record<string, string[]>;
}

@Injectable()
export class SAMLService {
  private readonly logger = new Logger(SAMLService.name);
  private sp: saml2.ServiceProvider;
  private idp: saml2.IdentityProvider;

  constructor(private configService: ConfigService) {
    this.initializeSAML();
  }

  private initializeSAML() {
    try {
      // Service Provider configuration
      const spOptions = {
        entity_id: this.configService.get('SAML_SP_ENTITY_ID') || 'http://localhost:3000',
        private_key: this.configService.get('SAML_PRIVATE_KEY') || undefined,
        certificate: this.configService.get('SAML_CERTIFICATE') || '',
        assert_endpoint: this.configService.get('SAML_SP_ACS_URL') || 'http://localhost:3000/auth/saml/callback',
        force_authn: true,
        auth_context: {
          comparison: 'exact',
          class_refs: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport']
        },
        nameid_format: this.configService.get('SAML_IDENTIFIER_FORMAT') || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        sign_get_request: false,
        allow_unencrypted_assertion: true
      };

      // Identity Provider configuration
      const idpOptions = {
        sso_login_url: this.configService.get('SAML_IDP_SSO_URL') || '',
        sso_logout_url: this.configService.get('SAML_IDP_SLO_URL') || '',
        certificates: [this.configService.get('SAML_CERTIFICATE') || ''],
        force_authn: true,
        sign_get_request: false,
        allow_unencrypted_assertion: true
      };

      this.sp = new saml2.ServiceProvider(spOptions);
      this.idp = new saml2.IdentityProvider(idpOptions);

      this.logger.log('✅ SAML Service Provider and Identity Provider initialized');
    } catch (error) {
      this.logger.error(`❌ Failed to initialize SAML: ${error.message}`);
      throw new Error(`SAML initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate SAML login request
   */
  async generateLoginRequest(): Promise<{ redirectUrl: string; requestId: string }> {
    try {
      // Validate SAML configuration before proceeding
      const configValidation = this.validateConfiguration();
      if (!configValidation.isValid) {
        const errorMessage = `SAML configuration is invalid: ${configValidation.errors.join(', ')}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      this.logger.log('🔐 Generating SAML login request');

      return new Promise((resolve, reject) => {
        this.sp.create_login_request_url(this.idp, {}, (err, loginUrl, requestId) => {
          if (err) {
            this.logger.error(`Error generating login request: ${err.message}`);
            reject(new Error(`Failed to generate login request: ${err.message}`));
            return;
          }

          this.logger.log(`✅ Generated SAML login request with ID: ${requestId}`);
          resolve({ redirectUrl: loginUrl, requestId });
        });
      });
    } catch (error) {
      this.logger.error(`Error in generateLoginRequest: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process SAML response
   */
  async processResponse(samlResponse: string): Promise<SAMLUser> {
    try {
      this.logger.log('🔐 Processing SAML response');

      return new Promise((resolve, reject) => {
        this.sp.post_assert(this.idp, { SAMLResponse: samlResponse }, (err, samlAssertion) => {
          if (err) {
            this.logger.error(`Error processing SAML response: ${err.message}`);
            reject(new Error(`Failed to process SAML response: ${err.message}`));
            return;
          }

          if (!samlAssertion) {
            reject(new Error('No SAML assertion received'));
            return;
          }

          const user: SAMLUser = {
            nameID: samlAssertion.user.name_id,
            sessionIndex: samlAssertion.user.session_index,
            attributes: samlAssertion.user.attributes || {}
          };

          this.logger.log(`✅ Successfully processed SAML response for user: ${user.nameID}`);
          resolve(user);
        });
      });
    } catch (error) {
      this.logger.error(`Error in processResponse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate SAML logout request
   */
  async generateLogoutRequest(nameID: string, sessionIndex: string): Promise<{ redirectUrl: string; requestId: string }> {
    try {
      this.logger.log('🔐 Generating SAML logout request');

      return new Promise((resolve, reject) => {
        this.sp.create_logout_request_url(this.idp, {
          name_id: nameID,
          session_index: sessionIndex
        }, (err, logoutUrl, requestId) => {
          if (err) {
            this.logger.error(`Error generating logout request: ${err.message}`);
            reject(new Error(`Failed to generate logout request: ${err.message}`));
            return;
          }

          this.logger.log(`✅ Generated SAML logout request with ID: ${requestId}`);
          resolve({ redirectUrl: logoutUrl, requestId });
        });
      });
    } catch (error) {
      this.logger.error(`Error in generateLogoutRequest: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process SAML logout response
   */
  async processLogoutResponse(samlResponse: string): Promise<boolean> {
    try {
      this.logger.log('🔐 Processing SAML logout response');

      return new Promise((resolve, reject) => {
        this.sp.post_assert(this.idp, { SAMLResponse: samlResponse }, (err, samlAssertion) => {
          if (err) {
            this.logger.error(`Error processing SAML logout response: ${err.message}`);
            reject(new Error(`Failed to process SAML logout response: ${err.message}`));
            return;
          }

          this.logger.log('✅ Successfully processed SAML logout response');
          resolve(true);
        });
      });
    } catch (error) {
      this.logger.error(`Error in processLogoutResponse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate SAML configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required configuration
    if (!this.configService.get('SAML_SP_ENTITY_ID')) {
      errors.push('SAML_SP_ENTITY_ID is required');
    }

    if (!this.configService.get('SAML_IDP_SSO_URL')) {
      errors.push('SAML_IDP_SSO_URL is required');
    }

    if (!this.configService.get('SAML_CERTIFICATE')) {
      errors.push('SAML_CERTIFICATE is required');
    }

    // Note: SAML_PRIVATE_KEY is optional for ADFS configurations

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get SAML metadata
   */
  async getMetadata(): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        this.sp.create_metadata(this.configService.get('SAML_SP_ENTITY_ID') || 'http://localhost:3000', (err, metadata) => {
          if (err) {
            reject(new Error(`Failed to generate metadata: ${err.message}`));
            return;
          }
          resolve(metadata);
        });
      });
    } catch (error) {
      this.logger.error(`Error generating metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract user attributes from SAML response
   */
  extractUserAttributes(samlUser: SAMLUser): {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName: string;
  } {
    const attributes = samlUser.attributes;

    return {
      email: this.getAttributeValue(attributes, 'email', 'mail', 'Email') || samlUser.nameID,
      username: this.getAttributeValue(attributes, 'username', 'User.Userrname', 'uid') || samlUser.nameID,
      firstName: this.getAttributeValue(attributes, 'firstName', 'givenName', 'User.FirstName') || '',
      lastName: this.getAttributeValue(attributes, 'lastName', 'sn', 'User.LastName') || '',
      displayName: this.getAttributeValue(attributes, 'displayName', 'cn', 'User.DisplayName') || 
                  `${this.getAttributeValue(attributes, 'firstName', 'givenName', 'User.FirstName') || ''} ${this.getAttributeValue(attributes, 'lastName', 'sn', 'User.LastName') || ''}`.trim()
    };
  }

  private getAttributeValue(attributes: Record<string, string[]>, ...keys: string[]): string {
    for (const key of keys) {
      if (attributes[key] && attributes[key].length > 0) {
        return attributes[key][0];
      }
    }
    return '';
  }

  /**
   * Get login URL (alias for generateLoginRequest)
   */
  async getLoginUrl(relayState?: string): Promise<string> {
    try {
      // Validate SAML configuration before proceeding
      const configValidation = this.validateConfiguration();
      if (!configValidation.isValid) {
        const errorMessage = `SAML configuration is invalid: ${configValidation.errors.join(', ')}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      const result = await this.generateLoginRequest();
      return result.redirectUrl;
    } catch (error) {
      this.logger.error(`Error getting login URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process callback (alias for processResponse)
   */
  async processCallback(req: any): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      this.logger.log('🔐 Processing SAML callback');
      this.logger.log(`Request method: ${req.method}`);
      this.logger.log(`Request headers: ${JSON.stringify(req.headers)}`);
      this.logger.log(`Request body keys: ${Object.keys(req.body || {})}`);
      this.logger.log(`Request query keys: ${Object.keys(req.query || {})}`);

      // ADFS might send SAML response in different ways
      let samlResponse = req.body?.SAMLResponse || req.query?.SAMLResponse || req.body?.SAMLResponse;
      
      // If still not found, check for base64 encoded response in body
      if (!samlResponse && req.body) {
        // Look for any field that might contain the SAML response
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string' && value.length > 100) {
            this.logger.log(`Found potential SAML response in field: ${key}`);
            samlResponse = value;
            break;
          }
        }
      }

      if (!samlResponse) {
        this.logger.error('No SAML response found in request');
        this.logger.error(`Body: ${JSON.stringify(req.body)}`);
        this.logger.error(`Query: ${JSON.stringify(req.query)}`);
        throw new Error('No SAML response received');
      }

      this.logger.log(`Found SAML response, length: ${samlResponse.length}`);
      
      const samlUser = await this.processResponse(samlResponse);
      const userProfile = this.extractUserAttributes(samlUser);
      
      this.logger.log(`✅ Successfully processed SAML callback for user: ${userProfile.email}`);
      
      return {
        success: true,
        user: userProfile,
      };
    } catch (error) {
      this.logger.error(`SAML callback processing error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
} 