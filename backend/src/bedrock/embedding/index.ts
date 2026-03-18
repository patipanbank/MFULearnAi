import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "../client";
import { LoggerService } from "../../services/LoggerService";

/**
 * Titan Embed Text v2 — Multilingual embedding model.
 * Upgrade from v1: 100+ languages (incl. Thai), configurable dimensions, L2 normalization.
 * Dimensions: 256 | 512 | 1024 (default 1024 — good balance of quality vs storage).
 *
 * ⚠ IMPORTANT: v2 produces embeddings in a DIFFERENT vector space than v1.
 *   Changing this model requires re-embedding ALL existing data in Chroma.
 */
const TITAN_EMBED_MODEL = "amazon.titan-embed-text-v2:0";
const TITAN_EMBED_DIMENSIONS = 1024;
const TITAN_EMBED_NORMALIZE = true;

export { TITAN_EMBED_DIMENSIONS };

export class BedrockEmbeddingService {
    static async getEmbedding(text: string): Promise<number[]> {
        if (!text) throw new Error("Text is required");

        try {
            const command = new InvokeModelCommand({
                modelId: TITAN_EMBED_MODEL,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    inputText: text,
                    dimensions: TITAN_EMBED_DIMENSIONS,
                    normalize: TITAN_EMBED_NORMALIZE,
                })
            });

            const response = await bedrockClient.send(command);
            const decoded = new TextDecoder().decode(response.body);
            const data = JSON.parse(decoded);

            if (!data.embedding) throw new Error("No embedding generated");

            return data.embedding;

        } catch (error: any) {
            LoggerService.error('bedrock_embedding_error', { error: error.message, model: TITAN_EMBED_MODEL });
            throw error;
        }
    }
}
