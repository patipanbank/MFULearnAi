/**
 * OpenAI-Compatible Chat Completions Controller
 *
 * Implements the OpenAI Chat Completions API specification.
 * Supports both synchronous and SSE streaming responses.
 *
 * Endpoint: POST /v1/chat/completions
 * Auth:     Bearer sk_model_xxx
 *
 * Compatible with: openai Python/JS SDK, LangChain, Cursor, Continue, etc.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { validateModel } from '../bedrock/text/utils';
import { resolveModelId, getOpenAIModelName, isModelAvailable } from './modelMapping';
import { ApiKeyUsageService } from '../services/ApiKeyUsageService';
import { getCostWeight, computeWeightedTokens } from '../config/models';
import type {
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChunk,
    OpenAIMessage,
    OpenAIUsage,
    OpenAIError,
} from './types';

/**
 * Convert OpenAI messages format to Bedrock's ChatMessage format.
 */
function convertMessages(messages: OpenAIMessage[]): { system?: string; chatMessages: any[] } {
    let system: string | undefined;
    const chatMessages: any[] = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            // Concatenate multiple system messages
            const text = typeof msg.content === 'string'
                ? msg.content
                : Array.isArray(msg.content)
                    ? msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
                    : '';
            system = system ? `${system}\n${text}` : text;
            continue;
        }

        // Convert content to string for Bedrock
        let content: string;
        if (typeof msg.content === 'string') {
            content = msg.content;
        } else if (Array.isArray(msg.content)) {
            content = msg.content.filter(p => p.type === 'text').map(p => p.text).join('');
        } else {
            content = msg.content || '';
        }

        chatMessages.push({
            role: msg.role === 'tool' ? 'user' : msg.role,
            content,
        });
    }

    return { system, chatMessages };
}

/**
 * Map Bedrock stop reason to OpenAI finish_reason.
 */
function mapStopReason(bedrockReason?: string): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    if (!bedrockReason) return null;
    switch (bedrockReason) {
        case 'end_turn': return 'stop';
        case 'stop_sequence': return 'stop';
        case 'max_tokens': return 'length';
        case 'tool_use': return 'tool_calls';
        case 'guardrail_intervened': return 'content_filter';
        default: return 'stop';
    }
}

/**
 * Create an OpenAI-format error response.
 */
function errorResponse(res: Response, status: number, message: string, type: string = 'invalid_request_error', code?: string): void {
    const body: OpenAIError = {
        error: {
            message,
            type,
            param: null,
            code: code || null,
        },
    };
    res.status(status).json(body);
}

export class OpenAIChatController {

    /**
     * POST /v1/chat/completions
     * OpenAI-compatible chat completions endpoint.
     */
    static async chatCompletions(req: any, res: Response) {
        const requestId = `chatcmpl-${uuidv4().replace(/-/g, '').substring(0, 24)}`;
        const created = Math.floor(Date.now() / 1000);

        try {
            // ── Auth Validation ──
            const userId = req.user?.userId;
            if (!userId) return errorResponse(res, 401, 'Authentication required', 'authentication_error', 'invalid_api_key');

            if (!req.user.isApiKey) {
                return errorResponse(res, 403, 'This endpoint requires an API key. Use Bearer sk_model_xxx.', 'invalid_request_error', 'api_key_required');
            }
            if (req.user.apiKeyMode !== 'model') {
                return errorResponse(res, 403, 'This API key is in "agent" mode. Create a "model" mode key for /v1/chat/completions.', 'invalid_request_error', 'wrong_key_mode');
            }

            // ── Parse Request ──
            const body: ChatCompletionRequest = req.body;

            if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
                return errorResponse(res, 400, "'messages' is required and must be a non-empty array.", 'invalid_request_error', 'missing_messages');
            }

            // ── Resolve Model ──
            // Allow model from request body, fall back to key's configured model
            const requestedModel = body.model || req.user.apiKeyModelId;
            if (!requestedModel) {
                return errorResponse(res, 400, "'model' is required.", 'invalid_request_error', 'missing_model');
            }

            const bedrockModelId = resolveModelId(requestedModel);
            if (!bedrockModelId) {
                return errorResponse(res, 400, `Model '${requestedModel}' not found. Use GET /v1/models for available models.`, 'invalid_request_error', 'model_not_found');
            }

            // Check if model is allowed for this key (if key has specific model restriction)
            if (req.user.apiKeyModelId && bedrockModelId !== req.user.apiKeyModelId) {
                // Check if key allows multiple models (allowedModels on apiKey)
                const allowedModels = req.apiKey?.allowedModels || [];
                if (allowedModels.length > 0 && !allowedModels.includes(bedrockModelId)) {
                    return errorResponse(res, 403, `This API key does not have access to model '${requestedModel}'.`, 'invalid_request_error', 'model_not_allowed');
                }
            }

            const finalModelId = validateModel(bedrockModelId);
            const openAIModelName = getOpenAIModelName(finalModelId);

            // ── Extract Parameters ──
            const temperature = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.5;
            const maxTokens = typeof body.max_tokens === 'number' ? Math.min(Math.max(body.max_tokens, 1), 16384) : 4096;

            // ── Convert Messages ──
            const { system, chatMessages } = convertMessages(body.messages);

            // ── Build Tool Config (if tools provided) ──
            let toolConfig: any = undefined;
            if (body.tools && body.tools.length > 0) {
                toolConfig = {
                    tools: body.tools.map(t => ({
                        toolSpec: {
                            name: t.function.name,
                            description: t.function.description || '',
                            inputSchema: {
                                json: t.function.parameters || {},
                            },
                        },
                    })),
                };
                if (body.tool_choice === 'none') {
                    toolConfig.toolChoice = { auto: {} }; // Bedrock doesn't have 'none', use auto
                } else if (body.tool_choice === 'auto') {
                    toolConfig.toolChoice = { auto: {} };
                } else if (typeof body.tool_choice === 'object' && body.tool_choice.function) {
                    toolConfig.toolChoice = { tool: { name: body.tool_choice.function.name } };
                }
            }

            // ── Streaming vs Sync ──
            if (body.stream) {
                return OpenAIChatController.handleStreaming(req, res, {
                    requestId, created, finalModelId, openAIModelName,
                    chatMessages, system, temperature, maxTokens, toolConfig, userId,
                });
            }

            // ── Synchronous Completion ──
            const result = await BedrockService.sendChat(
                finalModelId,
                system ? [{ role: 'system', content: system }, ...chatMessages] : chatMessages,
                undefined, // system already in messages
                temperature,
                toolConfig,
            );

            // ── Build OpenAI Response ──
            const usage: OpenAIUsage = {
                prompt_tokens: result.usage?.input || 0,
                completion_tokens: result.usage?.output || 0,
                total_tokens: result.usage?.total || 0,
            };

            // Check if response contains tool calls
            let toolCalls: any[] | undefined;
            if (result.stopReason === 'tool_use') {
                try {
                    const content = JSON.parse(result.text);
                    toolCalls = content
                        .filter((b: any) => b.toolUse)
                        .map((b: any, i: number) => ({
                            id: `call_${uuidv4().replace(/-/g, '').substring(0, 24)}`,
                            type: 'function',
                            function: {
                                name: b.toolUse.name,
                                arguments: typeof b.toolUse.input === 'string' ? b.toolUse.input : JSON.stringify(b.toolUse.input),
                            },
                        }));
                } catch { /* ignore parse errors */ }
            }

            const responseText = result.stopReason === 'tool_use' ? null : result.text;

            const response: ChatCompletionResponse = {
                id: requestId,
                object: 'chat.completion',
                created,
                model: openAIModelName,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: responseText,
                        ...(toolCalls ? { tool_calls: toolCalls } : {}),
                    },
                    finish_reason: mapStopReason(result.stopReason),
                    logprobs: null,
                }],
                usage,
                system_fingerprint: `fp_${finalModelId.substring(0, 8)}`,
            };

            // ── Track Usage ──
            ApiKeyUsageService.trackUsage(req.apiKey?._id?.toString(), {
                model: finalModelId,
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                weightedTokens: computeWeightedTokens(usage.total_tokens, finalModelId),
                endpoint: '/v1/chat/completions',
                streaming: false,
            }).catch(() => { /* fire and forget */ });

            LoggerService.info('openai_completion', {
                userId, model: finalModelId,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                isApiKey: true, mode: 'model', streaming: false,
            }, userId);

            res.json(response);

        } catch (error: any) {
            LoggerService.error('openai_completion_error', { error: error.message, stack: error.stack });
            if (!res.headersSent) {
                errorResponse(res, 500, error.message || 'Internal server error', 'server_error');
            }
        }
    }

    /**
     * Handle SSE streaming response (OpenAI-compatible).
     */
    private static async handleStreaming(req: any, res: Response, params: {
        requestId: string;
        created: number;
        finalModelId: string;
        openAIModelName: string;
        chatMessages: any[];
        system?: string;
        temperature: number;
        maxTokens: number;
        toolConfig?: any;
        userId: string;
    }) {
        const { requestId, created, finalModelId, openAIModelName, chatMessages, system, temperature, maxTokens, toolConfig, userId } = params;

        // ── Set SSE Headers ──
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering
            'Access-Control-Allow-Origin': '*',
        });

        // Keepalive comment
        const keepaliveInterval = setInterval(() => {
            if (!res.writableEnded) res.write(': keepalive\n\n');
        }, 15000);

        let totalOutputTokens = 0;

        // ── Send initial role chunk ──
        const roleChunk: ChatCompletionChunk = {
            id: requestId,
            object: 'chat.completion.chunk',
            created,
            model: openAIModelName,
            choices: [{
                index: 0,
                delta: { role: 'assistant', content: '' },
                finish_reason: null,
                logprobs: null,
            }],
            system_fingerprint: `fp_${finalModelId.substring(0, 8)}`,
        };
        res.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

        try {
            const messages = system
                ? [{ role: 'system', content: system }, ...chatMessages]
                : chatMessages;

            const result = await BedrockService.streamWithCallback(
                finalModelId,
                messages,
                (delta: string) => {
                    if (res.writableEnded) return;

                    const chunk: ChatCompletionChunk = {
                        id: requestId,
                        object: 'chat.completion.chunk',
                        created,
                        model: openAIModelName,
                        choices: [{
                            index: 0,
                            delta: { content: delta },
                            finish_reason: null,
                            logprobs: null,
                        }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                },
                temperature,
                toolConfig,
            );

            // ── Send finish chunk ──
            const finishChunk: ChatCompletionChunk = {
                id: requestId,
                object: 'chat.completion.chunk',
                created,
                model: openAIModelName,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: mapStopReason(result.stopReason),
                    logprobs: null,
                }],
                usage: {
                    prompt_tokens: result.usage?.input || 0,
                    completion_tokens: result.usage?.output || 0,
                    total_tokens: result.usage?.total || 0,
                },
            };
            res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
            res.write('data: [DONE]\n\n');

            // ── Track Usage ──
            const usage = {
                promptTokens: result.usage?.input || 0,
                completionTokens: result.usage?.output || 0,
                totalTokens: result.usage?.total || 0,
            };
            ApiKeyUsageService.trackUsage(req.apiKey?._id?.toString(), {
                model: finalModelId,
                ...usage,
                weightedTokens: computeWeightedTokens(usage.totalTokens, finalModelId),
                endpoint: '/v1/chat/completions',
                streaming: true,
            }).catch(() => {});

            LoggerService.info('openai_completion_stream', {
                userId, model: finalModelId,
                inputTokens: usage.promptTokens,
                outputTokens: usage.completionTokens,
                isApiKey: true, mode: 'model', streaming: true,
            }, userId);

        } catch (error: any) {
            LoggerService.error('openai_stream_error', { error: error.message });

            if (!res.writableEnded) {
                const errorChunk = {
                    error: {
                        message: error.message || 'Stream error',
                        type: 'server_error',
                    },
                };
                res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
                res.write('data: [DONE]\n\n');
            }
        } finally {
            clearInterval(keepaliveInterval);
            if (!res.writableEnded) res.end();
        }
    }
}
