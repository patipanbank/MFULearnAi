import { Strategy as SamlStrategy, SamlConfig } from 'passport-saml';
import config from '../config/config';

export interface SamlUserProfile {
  nameID: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  groups: string[];
}

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

class SamlService {
  /**
   * แปลง SAML profile เป็น user profile ที่ใช้ในระบบ
   */
  mapSamlProfile(profile: any): SamlUserProfile {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SAML Profile Mapping');
    console.log('='.repeat(80));
    console.log(`📋 NameID: ${profile.nameID}`);
    console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
    console.log(`📋 Session Index: ${profile.sessionIndex}`);

    // Get SAML attributes
    const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
    console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);

    for (const [key, value] of Object.entries(samlAttributes)) {
      console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
    }

    // Helper function สำหรับดึง attribute
    const getAttr = (keyArr: string[], fallback?: any) => {
      for (const key of keyArr) {
        if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
          // สำหรับ Group SIDs ให้ส่งคืน array ทั้งหมด
          if (key === 'http://schemas.xmlsoap.org/claims/Group') {
            return samlAttributes[key];
          }
          return samlAttributes[key][0];
        }
        if (samlAttributes[key] && !Array.isArray(samlAttributes[key])) {
          return samlAttributes[key];
        }
      }
      return fallback;
    };

    // Map attributes
    const username = (
      getAttr(['User.Userrname']) ||
      getAttr(['User.Username']) ||
      getAttr(['username']) ||
      getAttr(['uid'])
    );

    if (!username) {
      throw new Error('Username not found in SAML attributes');
    }

    const email = (
      getAttr(['User.Email']) ||
      getAttr(['email']) ||
      getAttr(['mail'])
    );

    const firstName = (
      getAttr(['first_name']) ||
      getAttr(['firstname']) ||
      getAttr(['givenName'])
    );

    const lastName = (
      getAttr(['last_name']) ||
      getAttr(['lastname']) ||
      getAttr(['sn'])
    );

    const department = (
      getAttr(['depart_name']) ||
      getAttr(['department']) ||
      getAttr(['organizationalUnit'])
    );

    // Map groups
    const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']);
    let groups: string[] = [];

    console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);

    if (groupSids && Array.isArray(groupSids)) {
      groups = groupSids;
    } else if (groupSids && !Array.isArray(groupSids)) {
      groups = [groupSids];
    }

    console.log(`🔍 Groups mapping - Final groups: ${JSON.stringify(groups)}`);

    const userProfile: SamlUserProfile = {
      nameID: profile.nameID,
      username,
      email,
      firstName,
      lastName,
      department,
      groups,
    };

    console.log('\n👤 Mapped Profile:', JSON.stringify(userProfile, null, 2));
    console.log('='.repeat(80) + '\n');

    return userProfile;
  }
}

export const samlService = new SamlService(); 