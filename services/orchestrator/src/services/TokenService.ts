import jwt from 'jsonwebtoken';
import fs from 'fs';

const PRIVATE_KEY_PATHS = [
    process.env.JWT_PRIVATE_KEY_PATH || '/run/secrets/jwt_private_key',
    process.env.JWT_PREVIOUS_PRIVATE_KEY_PATH || '/run/secrets/jwt_private_key_prev'
];
const ORCHESTRATOR_ID = 'orchestrator-001';

export class TokenService {
    private static privateKey: Buffer;
    private static tokenCache: { [service: string]: { token: string; expiry: number } } = {};

    private static getPrivateKey(): Buffer {
        if (!this.privateKey) {
            for (const path of PRIVATE_KEY_PATHS) {
                try {
                    if (fs.existsSync(path)) {
                        this.privateKey = fs.readFileSync(path);
                        console.info(`[TokenService] Using Private Key from ${path}`);
                        break;
                    }
                } catch (e) { }
            }

            if (!this.privateKey) {
                console.warn(`[TokenService] No private keys found in paths: ${PRIVATE_KEY_PATHS.join(', ')}`);
                throw new Error(`Missing Private Key for RS256`);
            }
        }
        return this.privateKey;
    }

    static mint(targetService: 'knowledge' | 'bedrock' | 'identity', scope: 'read' | 'write' | 'full' = 'read'): string {
        const cacheKey = `${targetService}:${scope}`;
        const now = Math.floor(Date.now() / 1000);

        // 1. Check Cache (Auto-refresh 10s before expiry)
        if (this.tokenCache[cacheKey] && this.tokenCache[cacheKey].expiry > (now + 10)) {
            return this.tokenCache[cacheKey].token;
        }

        const key = this.getPrivateKey();

        // Audience Mapping (Strict Names)
        const AUDIENCE_MAP = {
            'knowledge': 'mfu-knowledge-service',
            'bedrock': 'mfu-bedrock-service',
            'identity': 'mfu-identity-service'
        };

        const token = jwt.sign(
            {
                iss: ORCHESTRATOR_ID,
                sub: 'service:orchestrator',
                aud: AUDIENCE_MAP[targetService],
                scope: `internal:${scope}`,
                typ: 'internal-jwt',
                jti: require('crypto').randomUUID()
            },
            key,
            {
                expiresIn: '60s',
                algorithm: 'RS256',
                header: { kid: 'orch-key-v1', alg: 'RS256', typ: 'JWT' } as any
            }
        );

        // 2. Update Cache
        this.tokenCache[cacheKey] = {
            token,
            expiry: now + 60
        };

        return token;
    }
}
