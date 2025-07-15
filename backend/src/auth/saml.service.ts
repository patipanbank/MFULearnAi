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
        assert_endpoint: this.configService.get('SAML_SP_ACS_URL') || 'http://localhost:3000/api/auth/saml/callback',
        force_authn: false,
        auth_context: {
          comparison: 'minimum',
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
      this.logger.log(`SP Entity ID: ${spOptions.entity_id}`);
      this.logger.log(`SP Assert Endpoint: ${spOptions.assert_endpoint}`);
      this.logger.log(`IDP SSO URL: ${idpOptions.sso_login_url}`);
      this.logger.log(`Certificate length: ${spOptions.certificate.length}`);
      this.logger.log(`Certificate starts with: ${spOptions.certificate.substring(0, 50)}`);
      this.logger.log(`Private key: ${spOptions.private_key ? 'Set' : 'Not set'}`);
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
  async processResponse(samlResponse: string, rawBody?: any): Promise<SAMLUser> {
    try {
      this.logger.log('🔐 Processing SAML response');
      this.logger.log(`SAMLResponse length: ${samlResponse.length}`);
      this.logger.log(`SAMLResponse starts with: ${samlResponse.slice(0, 30)}`);
      this.logger.log(`SAMLResponse ends with: ${samlResponse.slice(-30)}`);

      // For SAML2-js, we should pass the base64 encoded response directly
      // The library will handle the decoding internally
      this.logger.log('Using original base64 SAML response for saml2-js processing');
      
      // Validate that the SAML response looks like base64
      if (!samlResponse || typeof samlResponse !== 'string') {
        throw new Error('Invalid SAML response: must be a string');
      }
      
      // Check if it looks like base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(samlResponse)) {
        this.logger.warn('SAML response does not look like valid base64');
      }

      return new Promise((resolve, reject) => {
        // Try with raw body first if provided
        if (rawBody && Object.keys(rawBody).length > 0) {
          this.logger.log(`Attempting SAML post_assert with raw body...`);
          this.logger.log(`Raw body keys: ${Object.keys(rawBody)}`);
          this.logger.log(`Raw body type: ${typeof rawBody}`);
          this.logger.log(`Raw body SAMLResponse type: ${typeof rawBody.SAMLResponse}`);
          this.logger.log(`Raw body SAMLResponse length: ${rawBody.SAMLResponse ? rawBody.SAMLResponse.length : 'undefined'}`);
          
          // Ensure the request body is properly formatted
          const requestBody = {
            SAMLResponse: rawBody.SAMLResponse
          };
          
          this.logger.log(`Request body for post_assert: ${JSON.stringify(requestBody)}`);
          this.logger.log(`Request body SAMLResponse length: ${requestBody.SAMLResponse.length}`);
          
          // Try with the original rawBody first
          this.logger.log(`Calling post_assert with rawBody: ${JSON.stringify(rawBody)}`);
          
          // Check if the rawBody has the expected structure
          if (!rawBody.SAMLResponse) {
            this.logger.error('rawBody does not contain SAMLResponse');
            reject(new Error('Request body does not contain SAMLResponse'));
            return;
          }
          
          this.sp.post_assert(this.idp, rawBody, (err, samlAssertion) => {
            if (err) {
              this.logger.error(`Error processing SAML response (raw body): ${err.message}`);
              // Fallback to SAMLResponse object
              this.logger.log('Falling back to SAMLResponse object...');
              const requestBody = { SAMLResponse: samlResponse };
              this.logger.log(`Fallback request body: ${JSON.stringify(requestBody)}`);
              this.sp.post_assert(this.idp, requestBody, (err2, samlAssertion2) => {
                if (err2) {
                  this.logger.error(`Error processing SAML response (SAMLResponse object): ${err2.message}`);
                  reject(new Error(`Failed to process SAML response: ${err2.message}`));
                  return;
                }
                if (!samlAssertion2) {
                  reject(new Error('No SAML assertion received (SAMLResponse object)'));
                  return;
                }
                const user: SAMLUser = {
                  nameID: samlAssertion2.user.name_id,
                  sessionIndex: samlAssertion2.user.session_index,
                  attributes: samlAssertion2.user.attributes || {}
                };
                this.logger.log(`✅ Successfully processed SAML response for user (SAMLResponse object): ${user.nameID}`);
                resolve(user);
              });
              return;
            }
            if (!samlAssertion) {
              reject(new Error('No SAML assertion received (raw body)'));
              return;
            }
            const user: SAMLUser = {
              nameID: samlAssertion.user.name_id,
              sessionIndex: samlAssertion.user.session_index,
              attributes: samlAssertion.user.attributes || {}
            };
            this.logger.log(`✅ Successfully processed SAML response for user (raw body): ${user.nameID}`);
            resolve(user);
          });
        } else {
          // Try with { SAMLResponse } object
          const requestBody = { SAMLResponse: samlResponse };
          this.logger.log(`Attempting SAML post_assert with SAMLResponse object...`);
          this.logger.log(`Request body for post_assert: ${JSON.stringify(requestBody)}`);
          this.sp.post_assert(this.idp, requestBody, (err, samlAssertion) => {
            if (err) {
              this.logger.error(`Error processing SAML response (SAMLResponse object): ${err.message}`);
              reject(new Error(`Failed to process SAML response: ${err.message}`));
              return;
            }
            if (!samlAssertion) {
              reject(new Error('No SAML assertion received (SAMLResponse object)'));
              return;
            }
            const user: SAMLUser = {
              nameID: samlAssertion.user.name_id,
              sessionIndex: samlAssertion.user.session_index,
              attributes: samlAssertion.user.attributes || {}
            };
            this.logger.log(`✅ Successfully processed SAML response for user (SAMLResponse object): ${user.nameID}`);
            resolve(user);
          });
        }
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
      this.logger.log(`Request body type: ${typeof req.body}`);
      this.logger.log(`Request body: ${JSON.stringify(req.body)}`);
      this.logger.log(`Request body length: ${typeof req.body === 'string' ? req.body.length : 'N/A'}`);

      // ADFS might send SAML response in different ways
      let samlResponse = req.body?.SAMLResponse || req.query?.SAMLResponse;
      
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

      // If the entire body is a string and looks like a SAML response
      if (!samlResponse && typeof req.body === 'string' && req.body.length > 100) {
        this.logger.log('Found SAML response as raw body string');
        samlResponse = req.body;
      }

      // If SAML response is URL-encoded, decode it
      if (samlResponse && samlResponse.includes('%')) {
        try {
          samlResponse = decodeURIComponent(samlResponse);
          this.logger.log('✅ URL-decoded SAML response');
        } catch (decodeError) {
          this.logger.log('⚠️ Failed to URL-decode SAML response, using as-is');
        }
      }

      if (!samlResponse) {
        this.logger.error('No SAML response found in request');
        this.logger.error(`Body: ${JSON.stringify(req.body)}`);
        this.logger.error(`Query: ${JSON.stringify(req.query)}`);
        throw new Error('No SAML response received');
      }

      this.logger.log(`Found SAML response, length: ${samlResponse.length}`);
      
      // Create a proper request object for saml2-js
      let requestBody = req.body;
      
      // If the body is a string, create a proper object
      if (typeof req.body === 'string') {
        requestBody = { SAMLResponse: samlResponse };
      } else if (req.body && typeof req.body === 'object') {
        // Ensure SAMLResponse is in the body
        requestBody = { ...req.body, SAMLResponse: samlResponse };
      } else {
        requestBody = { SAMLResponse: samlResponse };
      }
      
      this.logger.log(`Final request body for SAML processing: ${JSON.stringify(requestBody)}`);
      
      // Pass the processed request body to processResponse
      const samlUser = await this.processResponse(samlResponse, requestBody);
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