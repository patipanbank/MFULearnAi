import { Request, Response, NextFunction } from 'express';

/**
 * Content Validation Middleware — Sanitizes and limits chat messages.
 *
 * Protections:
 *  1. Max message size (default 32KB of text content)
 *  2. Max messages per session (default 2000)
 *  3. Basic XSS/HTML tag stripping for content rendered in browser
 *  4. Null byte removal
 *  5. Max image count per message
 *  6. Max file count per message
 */

const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH || '32768', 10); // 32KB
const MAX_MESSAGES_PER_SESSION = parseInt(process.env.MAX_MESSAGES_PER_SESSION || '2000', 10);
const MAX_IMAGES_PER_MESSAGE = parseInt(process.env.MAX_IMAGES_PER_MESSAGE || '5', 10);
const MAX_FILES_PER_MESSAGE = parseInt(process.env.MAX_FILES_PER_MESSAGE || '10', 10);

// Matches <script>, <iframe>, <object>, <embed>, <form>, <input> tags and event handlers
const DANGEROUS_HTML_RE = /<\s*(script|iframe|object|embed|form|input|link|style|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|form|input|link|style|meta|base)\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_RE = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const NULL_BYTE_RE = /\0/g;

/**
 * Sanitize a string: remove null bytes and dangerous HTML.
 * Preserves markdown formatting and safe HTML.
 */
export function sanitizeContent(content: string): string {
    if (!content || typeof content !== 'string') return content;

    return content
        .replace(NULL_BYTE_RE, '')               // Remove null bytes
        .replace(DANGEROUS_HTML_RE, '[removed]') // Strip dangerous tags
        .replace(EVENT_HANDLER_RE, '');           // Strip event handlers
}

/**
 * Express middleware to validate and sanitize chat input.
 * Applied to POST /api/chat before the main handler.
 */
export function validateChatContent(req: Request, res: Response, next: NextFunction): void {
    // Works with both JSON body and parsed multipart
    const message = req.body?.message;
    const images = req.body?.images;
    const files = req.body?.files;

    // 1. Message length check
    if (message && typeof message === 'string') {
        if (message.length > MAX_MESSAGE_LENGTH) {
            res.status(413).json({
                error: `Message too long (${message.length} chars). Maximum: ${MAX_MESSAGE_LENGTH} chars.`
            });
            return;
        }
        // Sanitize content
        req.body.message = sanitizeContent(message);
    }

    // 2. Image count check
    if (images && Array.isArray(images)) {
        if (images.length > MAX_IMAGES_PER_MESSAGE) {
            res.status(413).json({
                error: `Too many images (${images.length}). Maximum: ${MAX_IMAGES_PER_MESSAGE} per message.`
            });
            return;
        }
    }

    // 3. File count check
    if (files && Array.isArray(files)) {
        if (files.length > MAX_FILES_PER_MESSAGE) {
            res.status(413).json({
                error: `Too many files (${files.length}). Maximum: ${MAX_FILES_PER_MESSAGE} per message.`
            });
            return;
        }
    }

    next();
}

/**
 * Validate session message count before adding new messages.
 * Call this in the workflow before persisting.
 */
export async function checkSessionMessageLimit(
    getMessageCount: () => Promise<number>
): Promise<{ allowed: boolean; count: number; limit: number }> {
    const count = await getMessageCount();
    return {
        allowed: count < MAX_MESSAGES_PER_SESSION,
        count,
        limit: MAX_MESSAGES_PER_SESSION
    };
}

export const CONTENT_LIMITS = {
    MAX_MESSAGE_LENGTH,
    MAX_MESSAGES_PER_SESSION,
    MAX_IMAGES_PER_MESSAGE,
    MAX_FILES_PER_MESSAGE,
} as const;
