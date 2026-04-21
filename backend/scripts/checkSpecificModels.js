
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
 
const region = process.env.AWS_REGION || 'us-east-1';
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
    // Amazon Nova 2 (check if available)
    { name: 'Nova 2 Pro',   id: 'amazon.nova-pro-v2:0' },
    { name: 'Nova 2 Lite',  id: 'amazon.nova-lite-v2:0' },
    { name: 'Nova 2 Micro', id: 'amazon.nova-micro-v2:0' },
    // Amazon Nova 1 (currently used)
    { name: 'Nova Pro v1',  id: 'amazon.nova-pro-v1:0' },
    { name: 'Nova Lite v1', id: 'amazon.nova-lite-v1:0' },
    { name: 'Nova Micro v1',id: 'amazon.nova-micro-v1:0' },
    // Third-party (should work on channel account)
    { name: 'Mistral Large 3', id: 'mistral.mistral-large-3-675b-instruct' },
    { name: 'Qwen 3 VL 235B',  id: 'qwen.qwen3-vl-235b-a22b' },
    { name: 'Qwen 3 80B-A3B',  id: 'qwen.qwen3-next-80b-a3b' },
    { name: 'Gemma 3 4B IT',   id: 'google.gemma-3-4b-it' },
    { name: 'Kimi K2',         id: 'moonshot.kimi-k2-thinking' },
    // Anthropic (expected to FAIL on channel account)
    { name: 'Claude Sonnet 4', id: 'anthropic.claude-sonnet-4-6' },
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
