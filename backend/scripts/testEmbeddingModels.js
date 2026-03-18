/**
 * Test script: Check access to Titan Embed v1 vs v2
 * Run from project root:  node backend/scripts/testEmbeddingModels.js
 */

const fs = require('fs');
const path = require('path');

// Add node_modules to resolve path
if (module.paths) {
    module.paths.push(path.join(__dirname, '../../node_modules'));
}

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

// Load .env manually (same pattern as checkSpecificModels.js)
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from: ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value;
        }
    });
} else {
    console.log(`⚠ .env not found at ${envPath}`);
}

const region = process.env.AWS_REGION || 'us-east-1';
console.log(`Region: ${region}\n`);

const clientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}
const client = new BedrockRuntimeClient(clientConfig);

// ── Models to test ──────────────────────────────────────────────

const TEST_TEXT_TH = "มหาวิทยาลัยแม่ฟ้าหลวง ระเบียบการลาป่วย";
const TEST_TEXT_EN = "Mae Fah Luang University sick leave policy";

const EMBEDDING_MODELS = [
    {
        name: 'Titan Embed Text v1 (current)',
        id: 'amazon.titan-embed-text-v1',
        body: (text) => ({ inputText: text }),
    },
    {
        name: 'Titan Embed Text v2 (upgrade candidate)',
        id: 'amazon.titan-embed-text-v2:0',
        body: (text) => ({ inputText: text, dimensions: 1024, normalize: true }),
    },
];

// ── Test function ───────────────────────────────────────────────

async function testModel(model, text, label) {
    const start = Date.now();
    try {
        const command = new InvokeModelCommand({
            modelId: model.id,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(model.body(text)),
        });

        const response = await client.send(command);
        const decoded = new TextDecoder().decode(response.body);
        const data = JSON.parse(decoded);
        const ms = Date.now() - start;

        if (data.embedding) {
            const dim = data.embedding.length;
            const sample = data.embedding.slice(0, 3).map(v => v.toFixed(6));
            console.log(`  ✅ ${label}: ${dim} dims, ${ms}ms  [${sample.join(', ')} ...]`);
            return { success: true, dims: dim, ms };
        } else {
            console.log(`  ❌ ${label}: No embedding in response (${ms}ms)`);
            return { success: false };
        }
    } catch (err) {
        const ms = Date.now() - start;
        console.log(`  ❌ ${label}: ${err.name} — ${err.message} (${ms}ms)`);
        return { success: false, error: err.name };
    }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    console.log('=== Embedding Model Access Test ===\n');

    for (const model of EMBEDDING_MODELS) {
        console.log(`\n── ${model.name} (${model.id}) ──`);
        await testModel(model, TEST_TEXT_TH, 'Thai text');
        await testModel(model, TEST_TEXT_EN, 'English text');
    }

    console.log('\n=== Done ===');
}

main();
