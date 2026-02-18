const path = require('path');

// Explicitly add backend/node_modules to search path to fix resolution issues
if (module.paths) {
    module.paths.push(path.join(__dirname, '../../node_modules'));
}

const dotenv = require('dotenv');
const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const region = process.env.AWS_REGION || 'ap-southeast-1';
console.log(`Using AWS Region: ${region}`);

const clientConfig = { region };

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
} else {
    console.log('AWS credentials not found in environment variables. Attempting to use default credential provider chain (e.g. ~/.aws/credentials)...');
}

const client = new BedrockClient(clientConfig);

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
