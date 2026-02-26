/**
 * Test script: Check if cohere.rerank-v3-5:0 is available on your Bedrock account.
 *
 * Usage:
 *   cd backend
 *   node scripts/testCohereRerank.js
 */

const fs = require('fs');
const path = require('path');

// Add node_modules to search path
if (module.paths) {
    const nodeModulesPath = path.join(__dirname, '../../node_modules');
    module.paths.push(nodeModulesPath);
}

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

// Load .env manually
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
console.log(`Using AWS Region: ${region}\n`);

const clientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}

const client = new BedrockRuntimeClient(clientConfig);

const MODEL_ID = 'cohere.rerank-v3-5:0';

async function testRerank() {
    console.log(`Testing model: ${MODEL_ID}`);
    console.log('─'.repeat(50));

    // Cohere Rerank API payload (api_version is required by Bedrock)
    const payload = {
        api_version: 2,
        query: "What is the university policy on data protection?",
        documents: [
            { text: "The university requires all personal data to be encrypted at rest and in transit." },
            { text: "The cafeteria serves lunch from 11:00 to 14:00 daily." },
            { text: "According to PDPA regulations, data subjects have the right to access their personal data." },
            { text: "The library is open Monday through Saturday from 8:00 to 20:00." },
            { text: "All staff must complete annual data protection training as required by university policy." }
        ],
        top_n: 3
    };

    try {
        const command = new InvokeModelCommand({
            modelId: MODEL_ID,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload)
        });

        const response = await client.send(command);
        const result = JSON.parse(new TextDecoder().decode(response.body));

        console.log(`\n✅ SUCCESS — Model "${MODEL_ID}" is available!\n`);
        console.log('Query:', payload.query);
        console.log('\nReranked results:');
        console.log('─'.repeat(50));

        if (result.results) {
            result.results.forEach((r, i) => {
                const docText = payload.documents[r.index].text;
                console.log(`  #${i + 1} [index=${r.index}] score=${r.relevance_score.toFixed(4)}`);
                console.log(`     "${docText.substring(0, 80)}..."`);
            });
        } else {
            console.log('Response body:', JSON.stringify(result, null, 2));
        }

        console.log('\n─'.repeat(50));
        console.log('Latency: Response received successfully');
        console.log('You can now use this model as a reranker in KnowledgeService.');

    } catch (error) {
        console.log(`\n❌ FAILED: ${error.name} — ${error.message}\n`);

        if (error.name === 'AccessDeniedException') {
            console.log('👉 You need to enable "Cohere Rerank v3.5" in the AWS Bedrock Console:');
            console.log(`   1. Go to https://${region}.console.aws.amazon.com/bedrock/home?region=${region}#/modelaccess`);
            console.log('   2. Click "Manage model access"');
            console.log('   3. Find "Cohere" → enable "Rerank 3.5"');
            console.log('   4. Wait for access to be granted, then re-run this script.');
        } else if (error.name === 'ValidationException') {
            console.log('👉 The model ID might be wrong or not available in your region.');
            console.log(`   Current region: ${region}`);
            console.log('   Try checking available models: node scripts/listBedrockModels.js');
        } else if (error.name === 'ResourceNotFoundException') {
            console.log(`👉 Model "${MODEL_ID}" is not found in region "${region}".`);
            console.log('   Cohere Rerank may not be available in this region.');
            console.log('   Available regions: us-east-1, us-west-2, ap-southeast-1, eu-west-1');
        }
    }
}

testRerank();
