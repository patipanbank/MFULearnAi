"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.samlService = void 0;
exports.getSamlConfig = getSamlConfig;
const config_1 = __importDefault(require("../config/config"));
function getSamlConfig() {
    let cert = config_1.default.SAML_CERTIFICATE || '';
    cert = cert.replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\n/g, '')
        .trim();
    const baseUrl = (config_1.default.FRONTEND_URL || '').replace('http://', 'https://');
    return {
        entryPoint: config_1.default.SAML_IDP_SSO_URL,
        logoutUrl: config_1.default.SAML_IDP_SLO_URL,
        issuer: config_1.default.SAML_SP_ENTITY_ID,
        callbackUrl: `${baseUrl}/api/auth/saml/callback`,
        cert,
        identifierFormat: config_1.default.SAML_IDENTIFIER_FORMAT,
        disableRequestedAuthnContext: false,
        wantAssertionsSigned: true,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        validateInResponseTo: false,
        acceptedClockSkewMs: 5000,
    };
}
class SamlService {
    mapSamlProfile(profile) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 SAML Profile Mapping');
        console.log('='.repeat(80));
        console.log(`📋 NameID: ${profile.nameID}`);
        console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
        console.log(`📋 Session Index: ${profile.sessionIndex}`);
        const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
        console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
        for (const [key, value] of Object.entries(samlAttributes)) {
            console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
        }
        const getAttr = (keyArr, fallback) => {
            for (const key of keyArr) {
                if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
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
        const username = (getAttr(['User.Userrname']) ||
            getAttr(['User.Username']) ||
            getAttr(['username']) ||
            getAttr(['uid']));
        if (!username) {
            throw new Error('Username not found in SAML attributes');
        }
        const email = (getAttr(['User.Email']) ||
            getAttr(['email']) ||
            getAttr(['mail']));
        const firstName = (getAttr(['first_name']) ||
            getAttr(['firstname']) ||
            getAttr(['givenName']));
        const lastName = (getAttr(['last_name']) ||
            getAttr(['lastname']) ||
            getAttr(['sn']));
        const department = (getAttr(['depart_name']) ||
            getAttr(['department']) ||
            getAttr(['organizationalUnit']));
        const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']);
        let groups = [];
        console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
        if (groupSids && Array.isArray(groupSids)) {
            groups = groupSids;
        }
        else if (groupSids && !Array.isArray(groupSids)) {
            groups = [groupSids];
        }
        console.log(`🔍 Groups mapping - Final groups: ${JSON.stringify(groups)}`);
        const userProfile = {
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
exports.samlService = new SamlService();
//# sourceMappingURL=samlService.js.map