
import passport from 'passport';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { AuthService } from './AuthService';

const SAML_SP_ENTITY_ID = process.env.SAML_SP_ENTITY_ID || 'mfu-learn-ai';
const SAML_IDP_SSO_URL = process.env.SAML_IDP_SSO_URL || 'https://idp.mfu.ac.th/sso';
const SAML_CERTIFICATE = process.env.SAML_CERTIFICATE || '';
// Gateway URL should be the public entry point
const GATEWAY_URL = process.env.API_GATEWAY_URL || 'https://mfulearnai.mfu.ac.th';
const SAML_CALLBACK_URL = `${GATEWAY_URL}/auth/saml/callback`;

export const configureSaml = () => {
    if (!SAML_CERTIFICATE) {
        console.warn('[SAML] Skipping configuration: No Certificate Provided');
        return;
    }

    passport.use('saml', new SamlStrategy(
        {
            issuer: SAML_SP_ENTITY_ID,
            callbackUrl: SAML_CALLBACK_URL,
            entryPoint: SAML_IDP_SSO_URL,
            idpCert: SAML_CERTIFICATE,
            disableRequestedAuthnContext: true,
            forceAuthn: false,
            identifierFormat: null,
            wantAssertionsSigned: true,
            acceptedClockSkewMs: -1,
            passReqToCallback: true
        },
        async (req: any, profile: any, done: any) => {
            try {
                console.log('[SAML] Raw Profile:', JSON.stringify(profile, null, 2));

                // 1. Extract Info
                const nameID = profile.nameID || '';
                const username = profile['User.Userrname'] || profile['User.Username'] || nameID;
                const email = profile['User.Email'] || profile.email || '';
                const firstName = profile['first_name'] || profile.givenName || '';
                const lastName = profile['last_name'] || profile.sn || '';
                const department = profile['depart_name'] || 'General';

                // 2. Groups
                const rawGroups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];
                const humanGroups = profile['Groups'] || [];

                // 3. Role Logic
                let role = 'student';
                const groupsArray = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
                const isStudentSID = groupsArray.some((g: string) => g === 'student_all_grp');

                let isStudentName = false;
                if (Array.isArray(humanGroups)) {
                    isStudentName = humanGroups.includes('Students');
                } else if (typeof humanGroups === 'string') {
                    isStudentName = humanGroups.includes('Students');
                }

                if (isStudentSID || isStudentName) {
                    role = 'student';
                } else {
                    const humanGroupsStr = Array.isArray(humanGroups) ? humanGroups.join(' ') : String(humanGroups);
                    if (humanGroupsStr.includes('Staffs') || humanGroupsStr.includes('Employee')) {
                        role = 'staff';
                    } else if (groupsArray.some((x: string) => x && x.includes('superadmin'))) {
                        role = 'superadmin';
                        // } else if (groupsArray.some((x: string) => x && x.includes('admin'))) {
                        //    role = 'admin'; // Legacy sso-service ignores this and falls back to staff
                    } else {
                        role = 'staff';
                    }
                }

                const authResult = await AuthService.handleInternalLogin({
                    nameID, username, email, firstName, lastName, department,
                    groups: groupsArray, role
                });

                return done(null, authResult);

            } catch (err: any) {
                console.error('[SAML] Auth Failed:', err.message);
                return done(err);
            }
        },
        (req: any, profile: any, done: any) => {
            // logoutVerify
            return done(null, profile);
        }
    ) as any);
};
