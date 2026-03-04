import dotenv from 'dotenv';
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

dotenv.config();

import { MODELS, BEDROCK_MODELS, AVAILABLE_MODELS, ModelConfig } from '../../config/models';

dotenv.config();

// Re-export for backward compatibility if needed, though direct import is better
export { MODELS, AVAILABLE_MODELS, ModelConfig };

const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// --- Enhancement 3: Guardrails Config ---
export const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID || '';
export const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT';

// --- Enhancement 1: Prompt Caching (OPT-IN) ---
// Enabled by default for Claude models — reduces cost by ~90% on cache hits.
// NOTE: Only Claude 3.5 Haiku, 3.7 Sonnet, Sonnet 4+, Opus 4+ support caching.
//       Claude 3.5 Sonnet v1 (20240620) and Claude 3 Haiku do NOT support it.
export const ENABLE_PROMPT_CACHE = process.env.BEDROCK_ENABLE_CACHE !== 'false';
export const CACHE_SUPPORTED_MODELS = [
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'anthropic.claude-3-7-sonnet-20250219-v1:0',
    'anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-opus-4-20250514-v1:0',
];

export const validateModel = (modelId: string): string => {
    // Check if model exists in our config
    const isValid = AVAILABLE_MODELS.some(m => m.id === modelId);

    if (ENV_TYPE === 'PROD') {
        // In PROD, could add extra checks here restricted models if needed
        // For now, if it's in AVAILABLE_MODELS, it's allowed
        if (!isValid) {
            console.warn(`[Bedrock Text] Invalid or block model ${modelId} in PROD`);
            return MODELS.PRIMARY;
        }
    }

    return isValid ? modelId : MODELS.PRIMARY;
};

export const normalizeMessages = (messages: any[]) => {
    if (!messages || messages.length === 0) return [];

    // Filter out any system messages
    const filtered = messages.filter(m => m && m.role !== 'system');
    if (filtered.length === 0) return [];

    const normalized: any[] = [];

    // 1. Ensure it starts with 'user'
    let startIndex = filtered.findIndex(m => m.role === 'user');
    if (startIndex === -1) {
        normalized.push({ role: 'user', content: [{ text: '...' }] });
        startIndex = 0;
    }

    // Process messages from the first valid starting point
    for (let i = startIndex; i < filtered.length; i++) {
        const msg = filtered[i];
        const role = msg.role === 'user' ? 'user' : 'assistant';
        const content: any[] = [];

        // Handle different content types
        if (typeof msg.content === 'string' && msg.content.trim()) {
            content.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            msg.content.forEach((block: any) => {
                if (block.type === 'text') content.push({ text: block.text });
                else if (block.type === 'image') {
                    const imgSource = block.source;
                    // Ensure bytes area Buffer (AWS SDK v3 expects Buffer/Uint8Array)
                    if (imgSource?.source?.bytes && typeof imgSource.source.bytes === 'string') {
                        imgSource.source.bytes = Buffer.from(imgSource.source.bytes, 'base64');
                    }
                    content.push({ image: imgSource });
                }
                // Enhancement 2: Native Document Support
                else if (block.type === 'document') {
                    const docBytes = typeof block.data === 'string'
                        ? Buffer.from(block.data, 'base64')
                        : block.data;
                    // console.log(`[Bedrock Text] Document block found: name="${block.name}", format="${block.format}", dataSize=${docBytes?.length || 0} bytes`);
                    content.push({
                        document: {
                            format: block.format || 'pdf',
                            name: block.name || 'document',
                            source: { bytes: docBytes }
                        }
                    });
                }
                else if (block.type === 'tool_use') {
                    content.push({
                        toolUse: {
                            toolUseId: block.id || block.toolUseId,
                            name: block.name,
                            input: block.input
                        }
                    });
                }
                else if (block.type === 'tool_result') {
                    content.push({
                        toolResult: {
                            toolUseId: block.toolUseId,
                            content: block.content // Expects [{ json: ... }]
                        }
                    });
                }
            });
        }
        else if (msg.content && typeof msg.content === 'object' && msg.content.text) {
            // Handle raw object case
            content.push({ text: msg.content.text });
        }

        // Add image content if present as property (legacy)
        if (msg.images) {
            msg.images.forEach((img: any) => {
                content.push({
                    image: { format: img.mediaType.split('/')[1], source: { bytes: Buffer.from(img.data, 'base64') } }
                });
            });
        }

        // Enhancement 5: Rich Multi-modal History - Native file attachments
        if (msg.native_files) {
            msg.native_files.forEach((file: any) => {
                content.push({
                    document: {
                        format: file.format || 'pdf',
                        name: file.name || 'document',
                        source: {
                            bytes: typeof file.data === 'string'
                                ? Buffer.from(file.data, 'base64')
                                : file.data
                        }
                    }
                });
            });
        }

        if (content.length === 0) continue;

        // Merge consecutive messages logic (Converse requires strict alternation)
        if (normalized.length > 0 && normalized[normalized.length - 1].role === role) {
            normalized[normalized.length - 1].content.push(...content);
        } else {
            normalized.push({ role, content });
        }
    }

    return normalized;
};
