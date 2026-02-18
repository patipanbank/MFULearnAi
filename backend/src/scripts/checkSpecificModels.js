
const fs = require('fs');
const path = require('path');

// Explicitly add backend/node_modules to search path
if (module.paths) {
    const nodeModulesPath = path.join(__dirname, '../../node_modules');
    module.paths.push(nodeModulesPath);
}

const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");

// Manually load environment variables
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
}

const region = process.env.AWS_REGION || 'ap-southeast-1';
console.log(`Using AWS Region: ${region}`);

const clientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}

const client = new BedrockRuntimeClient(clientConfig);

const MODELS_TO_CHECK = [
    { name: 'Claude 3.5 Sonnet', id: 'anthropic.claude-3-5-sonnet-20240620-v1:0' },
    { name: 'Claude 3 Haiku', id: 'anthropic.claude-3-haiku-20240307-v1:0' }
];

async function checkModel(model) {
    console.log(`\nChecking access to ${model.name} (${model.id})...`);
    try {
        const command = new ConverseCommand({
            modelId: model.id,
            messages: [{ role: 'user', content: [{ text: 'Hi' }] }],
            inferenceConfig: { maxTokens: 10, temperature: 0 }
        });
        const response = await client.send(command);
        console.log(`✅ SUCCESS: Model responded.`);
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        if (error.name === 'AccessDeniedException') {
            console.log('   (You may need to enable model access in AWS Bedrock Console)');
        }
    }
}

async function runChecks() {
    for (const model of MODELS_TO_CHECK) {
        await checkModel(model);
    }
}

runChecks();
