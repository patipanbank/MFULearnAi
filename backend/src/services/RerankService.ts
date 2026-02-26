/**
 * RerankService — Two-stage retrieval reranker using Cohere Rerank on AWS Bedrock.
 *
 * Best Practice Architecture:
 *   1. Bi-encoder (embedding) retrieves broad Top-K from ChromaDB (fast, scalable)
 *   2. Cross-encoder (Cohere Rerank) re-scores and re-orders Top-K → Top-N (accurate)
 *
 * This service handles Stage 2. It is called by KnowledgeService.search() after
 * the initial ChromaDB retrieval, and can be enabled/disabled via environment config.
 *
 * Model: cohere.rerank-v3-5:0 (Bedrock native, no self-hosting required)
 */

import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../bedrock/client';
import { SYSTEM_MODELS } from '../config/models';
import { LoggerService } from './LoggerService';

// ─── Configuration (via environment variables) ─────────────────────────────────

export interface RerankConfig {
    /** Enable/disable reranker globally. Default: true */
    enabled: boolean;
    /** Model ID to use. Default: SYSTEM_MODELS.COHERE_RERANK */
    modelId: string;
    /** Maximum number of results to return after reranking. Default: 5 */
    topN: number;
    /** Minimum relevance score (0-1) to keep after reranking. Default: 0.1 */
    minRelevanceScore: number;
    /** Timeout in milliseconds. Default: 5000 */
    timeoutMs: number;
    /** Whether to use original cosine scores as fallback on error. Default: true */
    fallbackOnError: boolean;
}

/** Load reranker config from environment variables with sensible defaults */
export function getRerankConfig(): RerankConfig {
    return {
        enabled: process.env.RERANKER_ENABLED !== 'false', // Enabled by default
        modelId: process.env.RERANKER_MODEL_ID || SYSTEM_MODELS.COHERE_RERANK,
        topN: parseInt(process.env.RERANKER_TOP_N || '5', 10),
        minRelevanceScore: parseFloat(process.env.RERANKER_MIN_SCORE || '0.1'),
        timeoutMs: parseInt(process.env.RERANKER_TIMEOUT_MS || '5000', 10),
        fallbackOnError: process.env.RERANKER_FALLBACK_ON_ERROR !== 'false', // Enabled by default
    };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A document hit from ChromaDB Stage-1 retrieval */
export interface RerankHit {
    id: string;
    content: string;
    metadata: any;
    /** Original cosine similarity score from ChromaDB */
    score: number;
}

/** A reranked hit with both original and rerank scores */
export interface RerankedHit extends RerankHit {
    /** Cross-encoder relevance score from Cohere Rerank (0-1) */
    rerankScore: number;
}

/** Cohere Rerank API result item */
interface CohereRerankResult {
    index: number;
    relevance_score: number;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class RerankService {

    /**
     * Rerank a list of document hits using Cohere Rerank cross-encoder.
     *
     * @param query - The user's search query
     * @param hits - Candidate hits from Stage-1 (ChromaDB cosine similarity)
     * @param configOverride - Optional config overrides for this call
     * @returns Reranked and filtered hits, sorted by relevance_score descending
     */
    static async rerank(
        query: string,
        hits: RerankHit[],
        configOverride?: Partial<RerankConfig>
    ): Promise<RerankedHit[]> {
        const config = { ...getRerankConfig(), ...configOverride };

        // Skip if disabled or no hits
        if (!config.enabled || hits.length === 0) {
            return hits.map(h => ({ ...h, rerankScore: h.score }));
        }

        // Skip if only 1 hit — no need to rerank
        if (hits.length === 1) {
            return hits.map(h => ({ ...h, rerankScore: h.score }));
        }

        const startTime = Date.now();

        try {
            // Prepare Cohere Rerank payload
            const payload = {
                api_version: 2,
                query,
                documents: hits.map(h => h.content),
                top_n: Math.min(config.topN, hits.length),
            };

            const command = new InvokeModelCommand({
                modelId: config.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(payload),
            });

            // Invoke with timeout
            const response = await Promise.race([
                bedrockClient.send(command),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Reranker timeout')), config.timeoutMs)
                )
            ]);

            const result = JSON.parse(new TextDecoder().decode((response as any).body));
            const latencyMs = Date.now() - startTime;

            if (!result.results || !Array.isArray(result.results)) {
                throw new Error('Invalid rerank response: missing results array');
            }

            // Map rerank scores back to original hits
            const rerankedHits: RerankedHit[] = (result.results as CohereRerankResult[])
                .filter(r => r.relevance_score >= config.minRelevanceScore)
                .map(r => ({
                    ...hits[r.index],
                    rerankScore: r.relevance_score,
                }));

            // Sort by rerank score descending (Cohere returns sorted, but ensure it)
            rerankedHits.sort((a, b) => b.rerankScore - a.rerankScore);

            LoggerService.info('reranker_success', {
                query: query.substring(0, 100),
                inputCount: hits.length,
                outputCount: rerankedHits.length,
                topScore: rerankedHits[0]?.rerankScore?.toFixed(4),
                latencyMs,
                model: config.modelId,
            });

            return rerankedHits;

        } catch (error: any) {
            const latencyMs = Date.now() - startTime;

            LoggerService.error('reranker_failed', {
                error: error.message,
                query: query.substring(0, 100),
                hitCount: hits.length,
                latencyMs,
                model: config.modelId,
            });

            // Fallback: return original hits with cosine scores as rerankScore
            if (config.fallbackOnError) {
                LoggerService.warn('reranker_fallback', {
                    reason: error.message,
                    hitCount: hits.length,
                });
                return hits
                    .map(h => ({ ...h, rerankScore: h.score }))
                    .sort((a, b) => b.rerankScore - a.rerankScore)
                    .slice(0, config.topN);
            }

            throw error;
        }
    }
}
