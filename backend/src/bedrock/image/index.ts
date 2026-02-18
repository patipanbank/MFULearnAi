import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "../client";
import { LoggerService } from "../../services/LoggerService";

const TITAN_IMAGE_MODEL = "amazon.titan-image-generator-v1";

export class BedrockImageService {
    static async generateImage(prompt: string): Promise<string> {
        if (!prompt) throw new Error("Prompt is required");

        try {
            const command = new InvokeModelCommand({
                modelId: TITAN_IMAGE_MODEL,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    taskType: "TEXT_IMAGE",
                    textToImageParams: {
                        text: prompt,
                        numberOfImages: 1,
                        imageHeight: 1024,
                        imageWidth: 1024,
                        cfgScale: 8.0,
                        seed: Math.floor(Math.random() * 1000000)
                    },
                    imageGenerationConfig: {
                        numberOfImages: 1,
                        quality: "standard",
                        height: 1024,
                        width: 1024,
                        cfgScale: 8.0
                    }
                })
            });

            const response = await bedrockClient.send(command);
            const decoded = new TextDecoder().decode(response.body);
            const data = JSON.parse(decoded);

            if (!data.images || !data.images[0]) {
                throw new Error("No image generated");
            }

            return data.images[0]; // Base64 string

        } catch (error: any) {
            LoggerService.error('bedrock_image_error', { error: error.message });
            throw error;
        }
    }
}
