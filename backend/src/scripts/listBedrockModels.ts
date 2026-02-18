
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const region = process.env.AWS_REGION || 'ap-southeast-1';
console.log(`Using AWS Region: ${region}`);

const client = new BedrockClient({
    region: region,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

async function listModels() {
    try {
        console.log('Fetching available foundation models...');
        const command = new ListFoundationModelsCommand({
            byOutputModality: 'TEXT'
        });
        const response = await client.send(command);

        if (response.modelSummaries) {
            console.log('\nAvailable Text Models:');
            console.log('------------------------');
            response.modelSummaries.forEach(model => {
                console.log(`Name: ${model.modelName}`);
                console.log(`ID: ${model.modelId}`);
                console.log(`Provider: ${model.providerName}`);
                console.log(`Input Modalities: ${model.inputModalities?.join(', ')}`);
                console.log(`Output Modalities: ${model.outputModalities?.join(', ')}`);
                console.log('---');
            });
        } else {
            console.log('No models found.');
        }
    } catch (error) {
        console.error('Error fetching models:', error);
    }
}

listModels();
