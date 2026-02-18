const fs = require('fs');

// Explicitly add backend/node_modules to search path to fix resolution issues
if (module.paths) {
    const nodeModulesPath = path.join(__dirname, '../../node_modules');
    module.paths.push(nodeModulesPath);
}

const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

// Manually load environment variables to avoid dotenv dependency issues
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from: ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
} else {
    console.log(`Env file not found at: ${envPath}`);
}


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
