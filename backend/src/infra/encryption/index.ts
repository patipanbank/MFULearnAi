import crypto from 'crypto';

/**
 * Field-Level Encryption (FLE) for sensitive chat data at rest.
 *
 * Uses AES-256-GCM authenticated encryption. The encryption key is derived
 * from `CHAT_ENCRYPTION_KEY` env var via HKDF (or used directly if 32 bytes).
 *
 * Encrypts: message content, file names, SmartContext canonical text.
 * Does NOT encrypt: role, timestamps, metadata (needed for queries/indexes).
 *
 * When `CHAT_ENCRYPTION_KEY` is not set, encryption is disabled (passthrough)
 * to maintain backward compatibility with existing unencrypted data.
 *
 * Format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_PREFIX = 'enc:v1:';

let _encryptionKey: Buffer | null = null;
let _initialized = false;

/**
 * Initialize the encryption module. Safe to call multiple times.
 */
export function initEncryption(): void {
    if (_initialized) return;

    const keyEnv = process.env.CHAT_ENCRYPTION_KEY;
    if (!keyEnv) {
        console.log('[Encryption] CHAT_ENCRYPTION_KEY not set — field-level encryption DISABLED (passthrough mode)');
        _initialized = true;
        return;
    }

    // If key is 64 hex chars (32 bytes), use directly; otherwise derive via HKDF
    if (/^[0-9a-fA-F]{64}$/.test(keyEnv)) {
        _encryptionKey = Buffer.from(keyEnv, 'hex');
    } else {
        _encryptionKey = crypto.createHash('sha256').update(keyEnv).digest();
    }

    _initialized = true;
    console.log('[Encryption] Field-level encryption ENABLED (AES-256-GCM)');
}

/**
 * Returns true if encryption is active (key is configured).
 */
export function isEncryptionEnabled(): boolean {
    if (!_initialized) initEncryption();
    return _encryptionKey !== null;
}

/**
 * Encrypt a plaintext string. Returns the ciphertext with embedded IV and auth tag.
 * If encryption is disabled, returns the original string unchanged.
 */
export function encryptField(plaintext: string): string {
    if (!_initialized) initEncryption();
    if (!_encryptionKey || !plaintext) return plaintext;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, _encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string. If the string is not encrypted (no prefix),
 * returns it unchanged (backward compatibility with pre-encryption data).
 */
export function decryptField(ciphertext: string): string {
    if (!_initialized) initEncryption();
    if (!_encryptionKey || !ciphertext) return ciphertext;

    // Passthrough for unencrypted data (backward compatibility)
    if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) return ciphertext;

    try {
        const payload = ciphertext.slice(ENCRYPTION_PREFIX.length);
        const [ivHex, authTagHex, encryptedHex] = payload.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, _encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        // If decryption fails, return original (may be legacy unencrypted data)
        console.error('[Encryption] Decryption failed — returning raw value:', (err as Error).message);
        return ciphertext;
    }
}

/**
 * Encrypt a ChatMessage's sensitive fields in-place.
 */
export function encryptMessage(msg: any): any {
    if (!isEncryptionEnabled() || !msg) return msg;

    const encrypted = { ...msg };
    if (encrypted.content) encrypted.content = encryptField(encrypted.content);

    if (encrypted.files?.length) {
        encrypted.files = encrypted.files.map((f: any) => ({
            ...f,
            name: f.name ? encryptField(f.name) : f.name,
            content: f.content ? encryptField(f.content) : f.content
        }));
    }

    return encrypted;
}

/**
 * Decrypt a ChatMessage's sensitive fields in-place.
 */
export function decryptMessage(msg: any): any {
    if (!isEncryptionEnabled() || !msg) return msg;

    const decrypted = { ...msg };
    if (decrypted.content) decrypted.content = decryptField(decrypted.content);

    if (decrypted.files?.length) {
        decrypted.files = decrypted.files.map((f: any) => ({
            ...f,
            name: f.name ? decryptField(f.name) : f.name,
            content: f.content ? decryptField(f.content) : f.content
        }));
    }

    return decrypted;
}

/**
 * Encrypt SmartContext canonical field.
 */
export function encryptSmartContext(ctx: any): any {
    if (!isEncryptionEnabled() || !ctx) return ctx;
    return {
        ...ctx,
        canonical: ctx.canonical ? encryptField(ctx.canonical) : ctx.canonical
    };
}

/**
 * Decrypt SmartContext canonical field.
 */
export function decryptSmartContext(ctx: any): any {
    if (!isEncryptionEnabled() || !ctx) return ctx;
    return {
        ...ctx,
        canonical: ctx.canonical ? decryptField(ctx.canonical) : ctx.canonical
    };
}
