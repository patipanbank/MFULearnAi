import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "../client";
import { LoggerService } from "../../services/LoggerService";

const TITAN_EMBED_MODEL = "amazon.titan-embed-text-v1";

export class BedrockEmbeddingService {
    static async getEmbedding(text: string): Promise<number[]> {
        if (!text) throw new Error("Text is required");

        try {
            const command = new InvokeModelCommand({
                modelId: TITAN_EMBED_MODEL,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    inputText: text
                })
            });

            const response = await bedrockClient.send(command);
            const decoded = new TextDecoder().decode(response.body);
            const data = JSON.parse(decoded);

            if (!data.embedding) throw new Error("No embedding generated");

            return data.embedding;

        } catch (error: any) {
            LoggerService.error('bedrock_embedding_error', { error: error.message });
            throw error;
        }
    }
}
