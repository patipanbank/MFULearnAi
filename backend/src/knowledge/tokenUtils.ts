import jwt from 'jsonwebtoken';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { LoggerService } from '../services/LoggerService';

const PRIVATE_KEY_PATH = process.env.JWT_PRIVATE_KEY_PATH || '/run/secrets/jwt_private_key';
const SERVICE_ID = 'service:knowledge';

export class TokenUtil {
    private static privateKey: Buffer;

    private static getPrivateKey(): Buffer {
        if (!this.privateKey) {
            try {
                this.privateKey = fs.readFileSync(PRIVATE_KEY_PATH);
            } catch (e: any) {
                LoggerService.error('token_util_private_key_read_failed', { error: e.message });
                throw new Error('Internal Auth Configuration Error');
            }
        }
        return this.privateKey;
    }

    static mint(targetAudience: 'mfu-bedrock-service' | 'mfu-orchestrator-service'): string {
        const key = this.getPrivateKey();

        return jwt.sign(
            {
                iss: 'mfu-knowledge-service',
                sub: SERVICE_ID,
                aud: targetAudience,
                scope: 'internal:read', // Default scope
                typ: 'internal-jwt',
                jti: randomUUID()
            },
            key,
            { expiresIn: '60s', algorithm: 'RS256' }
        );
    }
}
