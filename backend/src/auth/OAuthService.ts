
import axios from 'axios';
import { AuthService } from './AuthService';

const MFU_CLIENT_ID = process.env.MFU_SSO_CLIENT_ID || '382dab5a-4844-407d-8f91-a0ae6d26e5d0';
const MFU_CLIENT_SECRET = process.env.MFU_SSO_CLIENT_SECRET || 'Y97QMKvWqanojhOsQUzUrpDK37fUtrTzlPDw83Oo';
const MFU_AUTH_URL = process.env.MFU_SSO_AUTH_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/authorize';
const MFU_TOKEN_URL = process.env.MFU_SSO_TOKEN_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/token';

export class OAuthService {
    static getRedirectUrl(host: string): string {
        let redirectBase = 'https://mfulearnai.mfu.ac.th';
        // Handle local/dev environments or alternative domains
        if (host.includes('dindinai')) {
            redirectBase = 'https://dindinai.mfu.ac.th';
        } else if (host.includes('localhost')) {
            redirectBase = 'http://localhost:3000';
        }
        return `${redirectBase}/auth-callback`;
    }

    static getAuthUrl(redirectUri: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: MFU_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'openid email profile'
        });
        return `${MFU_AUTH_URL}?${params.toString()}`;
    }

    static async handleCallback(code: string, redirectUri: string) {
        // Exchange Code
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('client_id', MFU_CLIENT_ID);
        tokenParams.append('client_secret', MFU_CLIENT_SECRET);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('code', code);

        const tokenResponse = await axios.post(MFU_TOKEN_URL, tokenParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, id_token } = tokenResponse.data;
        if (!id_token) throw new Error('No id_token received');

        // Decode ID Token
        const profile = this.parseJwt(id_token);
        if (!profile) throw new Error('Failed to decode id_token');

        // Map Profile
        // Map Profile (Match legacy oauth-service exactly)
        const userData = {
            googleId: profile.sub || profile.upn,
            email: profile.email || profile.upn,
            firstName: profile.given_name,
            lastName: profile.family_name,
            username: profile.username || (profile.email ? profile.email.split('@')[0] : 'unknown'),
            role: 'student',
            department: profile.depart_name,
            departmentId: profile.depart_id,
            departName: profile.depart_name, // Backward compatibility
            provider: 'sso'
        };

        if (profile.group === 'Staff' || profile.group === 'Lecturer' ||
            (profile.email && profile.email.includes('@mfu.ac.th') && !profile.email.includes('lamduan'))) {
            userData.role = 'staff';
        }

        // Login/Create
        const internalAuth = await AuthService.handleInternalLogin(userData);

        return {
            ...internalAuth,
            sso_id_token: id_token // Legacy frontend might valid this
        };
    }

    private static parseJwt(token: string) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Failed to parse JWT:', e);
            return null;
        }
    }
}
