const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');
console.log("Loading .env from:", envPath);
if (fs.existsSync(envPath)) {
    console.log(".env file found.");
} else {
    console.error(".env file NOT found!");
}
require('dotenv').config({ path: envPath });

console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "SET" : "MISSING");
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "MISSING");
console.log("AWS_REGION:", process.env.AWS_REGION);

// Mock Environment
const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0';

// Create Client
const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function testImage() {
    try {
        // Create a simple 1x1 pixel red PNG
        const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const imageBuffer = Buffer.from(base64Image, 'base64');

        const messages = [
            {
                role: 'user',
                content: [
                    {
                        text: "What is in this image? Describe it briefly."
                    },
                    {
                        image: {
                            format: 'png',
                            source: {
                                bytes: imageBuffer // AWS SDK v3 accepts Buffer
                            }
                        }
                    }
                ]
            }
        ];

        console.log("Sending request to Bedrock...");
        const command = new ConverseCommand({
            modelId: MODEL_ID,
            messages: messages,
            inferenceConfig: { maxTokens: 100 }
        });

        const response = await client.send(command);
        console.log("Response:");
        console.log(JSON.stringify(response.output, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

testImage();
