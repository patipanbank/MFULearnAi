import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";

const client = new BedrockClient({ region: "ap-southeast-1" });

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
