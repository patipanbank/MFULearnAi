import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust path if needed, assuming backend/.env

const client = new BedrockClient({
    region: process.env.AWS_REGION || "ap-southeast-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

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
