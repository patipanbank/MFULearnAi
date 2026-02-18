import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import dotenv from 'dotenv';
import path from 'path';

// Try loading env from multiple locations
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../infrastructure/compose/.env') });

const config: any = {
    region: process.env.AWS_REGION || "ap-southeast-1"
};

// Only add credentials if explicitly provided, otherwise rely on default chain
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}

const client = new BedrockClient(config);

async function listModels() {
    try {
        const command = new ListFoundationModelsCommand({ byProvider: "anthropic" });
        const response = await client.send(command);

        console.log("Available Anthropic Models in ap-southeast-1:");
        response.modelSummaries?.forEach(model => {
            console.log(`- ${model.modelId} (${model.modelName}) [${model.inferenceTypesSupported?.join(', ')}]`);
        });
    } catch (err) {
        console.error("Error listing models:", err);
    }
}

listModels();
