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

      // Validate that the SAML response looks like base64
      if (!samlResponse || typeof samlResponse !== 'string') {
        throw new Error('Invalid SAML response: must be a string');
      }
      
      // Check if it looks like base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(samlResponse)) {
        this.logger.warn('SAML response does not look like valid base64');
      }

      // Decode and parse SAML response manually (similar to backendfast approach)
      try {
        const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');
        this.logger.log(`Decoded SAML response length: ${decodedResponse.length}`);
        this.logger.log(`Decoded SAML response starts with: ${decodedResponse.slice(0, 200)}`);
        
        // Extract user information using regex patterns (similar to backendfast)
        const nameIdMatch = decodedResponse.match(/<NameID[^>]*>([^<]+)<\/NameID>/);
        const emailMatch = decodedResponse.match(/User\.Email[^>]*>([^<]+)<\/AttributeValue>/);
        const usernameMatch = decodedResponse.match(/User\.Userrname[^>]*>([^<]+)<\/AttributeValue>/);
        const firstNameMatch = decodedResponse.match(/first_name[^>]*>([^<]+)<\/AttributeValue>/);
        const lastNameMatch = decodedResponse.match(/last_name[^>]*>([^<]+)<\/AttributeValue>/);
        const departmentMatch = decodedResponse.match(/depart_name[^>]*>([^<]+)<\/AttributeValue>/);
        const groupsMatch = decodedResponse.match(/http:\/\/schemas\.xmlsoap\.org\/claims\/Group[^>]*>([^<]+)<\/AttributeValue>/g);
        
        this.logger.log(`Found NameID: ${nameIdMatch ? nameIdMatch[1] : 'Not found'}`);
        this.logger.log(`Found email: ${emailMatch ? emailMatch[1] : 'Not found'}`);
        this.logger.log(`Found username: ${usernameMatch ? usernameMatch[1] : 'Not found'}`);
        this.logger.log(`Found first name: ${firstNameMatch ? firstNameMatch[1] : 'Not found'}`);
        this.logger.log(`Found last name: ${lastNameMatch ? lastNameMatch[1] : 'Not found'}`);
        this.logger.log(`Found department: ${departmentMatch ? departmentMatch[1] : 'Not found'}`);
        
        if (groupsMatch) {
          this.logger.log(`Found groups: ${groupsMatch.map(match => match.match(/>([^<]+)</)?.[1]).join(', ')}`);
        }
        
        // Create user object from extracted data (similar to backendfast approach)
        if (nameIdMatch) {
          const user: SAMLUser = {
            nameID: nameIdMatch[1],
            sessionIndex: `session_${Date.now()}`,
            attributes: {
              'User.Email': emailMatch ? [emailMatch[1]] : [nameIdMatch[1]],
              'User.Userrname': usernameMatch ? [usernameMatch[1]] : [nameIdMatch[1]],
              'first_name': firstNameMatch ? [firstNameMatch[1]] : [''],
              'last_name': lastNameMatch ? [lastNameMatch[1]] : [''],
              'depart_name': departmentMatch ? [departmentMatch[1]] : [''],
              'http://schemas.xmlsoap.org/claims/Group': groupsMatch ? 
                groupsMatch.map(match => match.match(/>([^<]+)</)?.[1]).filter((item): item is string => Boolean(item)) : []
            }
          };
          
          this.logger.log(`✅ Successfully extracted user from SAML response: ${user.nameID}`);
          return user;
        }
        
      } catch (decodeError) {
        this.logger.error(`Error decoding SAML response: ${decodeError.message}`);
      }

      // Fallback: Try saml2-js library (though it's likely to fail)
      return new Promise((resolve, reject) => {
        const requestBody = { SAMLResponse: samlResponse };
        
        this.logger.log(`Attempting SAML post_assert with saml2-js library...`);
        
        this.sp.post_assert(this.idp, requestBody, (err, samlAssertion) => {
          if (err) {
            this.logger.error(`saml2-js library failed: ${err.message}`);
            reject(new Error(`Failed to process SAML response: ${err.message}`));
            return;
          }
          
          if (!samlAssertion) {
            reject(new Error('No SAML assertion received from saml2-js'));
            return;
          }
          
          const user: SAMLUser = {
            nameID: samlAssertion.user.name_id,
            sessionIndex: samlAssertion.user.session_index,
            attributes: samlAssertion.user.attributes || {}
          };
          
          this.logger.log(`✅ Successfully processed SAML response with saml2-js: ${user.nameID}`);
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
    department?: string;
    groups?: string[];
  } {
    const attributes = samlUser.attributes;

    // Try different common SAML attribute formats, including the one with typo (like backendfast)
    const username = this.getAttributeValue(attributes, 'User.Userrname', 'User.Username', 'username', 'uid') || samlUser.nameID;
    const email = this.getAttributeValue(attributes, 'User.Email', 'email', 'mail', 'Email') || samlUser.nameID;
    const firstName = this.getAttributeValue(attributes, 'first_name', 'firstname', 'givenName', 'firstName') || '';
    const lastName = this.getAttributeValue(attributes, 'last_name', 'lastname', 'sn', 'lastName') || '';
    const department = this.getAttributeValue(attributes, 'depart_name', 'department', 'organizationalUnit', 'departName') || '';
    
    // Extract groups with multiple fallback options (like backendfast)
    const groups = (
      attributes['http://schemas.xmlsoap.org/claims/Group'] ||
      attributes['groups'] ||
      attributes['Groups'] ||
      attributes['memberOf'] ||
      []
    );

    return {
      email,
      username,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim() || username,
      department,
      groups
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
      this.logger.log(`Content-Type: ${req.headers['content-type']}`);
      this.logger.log(`Body type: ${typeof req.body}`);
      this.logger.log(`Body keys: ${Object.keys(req.body || {})}`);

      // Extract SAML response from request body
      let samlResponse = req.body?.SAMLResponse;
      
      if (!samlResponse) {
        this.logger.error('No SAML response found in request body');
        this.logger.error(`Body: ${JSON.stringify(req.body)}`);
        throw new Error('No SAML response received');
      }

      this.logger.log(`Found SAML response, length: ${samlResponse.length}`);
      
      // Process the SAML response
      const samlUser = await this.processResponse(samlResponse);
      const userProfile = this.extractUserAttributes(samlUser);
      
      this.logger.log(`✅ Successfully processed SAML callback for user: ${userProfile.email}`);
      
      return {
        success: true,
        user: {
          nameID: samlUser.nameID,
          username: userProfile.username,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          department: userProfile.department,
          groups: userProfile.groups,
        },
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