import jwt from 'jsonwebtoken';
import fs from 'fs';

const PRIVATE_KEY_PATH = process.env.JWT_PRIVATE_KEY_PATH || '/run/secrets/jwt_private_key';
const ORCHESTRATOR_ID = 'orchestrator-001';

export class TokenService {
    private static privateKey: Buffer;

    private static getPrivateKey(): Buffer {
        if (!this.privateKey) {
            // In dev mode without secrets, we might want a fallback or fail fast?
            // If path doesn't exist, maybe fallback to INTERNAL_JWT_SECRET for dev compat
            // But User explicitly wants File Keys. 
            // Let's assume file exists if configured, or throw.
            try {
                this.privateKey = fs.readFileSync(PRIVATE_KEY_PATH);
            } catch (e) {
                console.warn(`[TokenService] Failed to read private key from ${PRIVATE_KEY_PATH}. Using fallback secret for DEV only.`);
                // Fallback for local testing if file missing (optional, but strictly RS256 requires key)
                // For now, let's just fail or use HS256 fallback if no file (but that breaks downstream verify RS256)
                throw new Error(`Missing Private Key at ${PRIVATE_KEY_PATH}`);
            }
        }
        return this.privateKey;
    }

    static mint(targetService: 'knowledge' | 'bedrock' | 'identity', scope: 'read' | 'write' | 'full' = 'read'): string {
        const key = this.getPrivateKey();
        return jwt.sign(
            {
                iss: ORCHESTRATOR_ID,
                aud: targetService,
                scope: `internal:${scope}`
            },
            key,
            { expiresIn: '5m', algorithm: 'RS256' }
        );
    }
}
