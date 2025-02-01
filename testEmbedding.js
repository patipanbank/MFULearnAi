const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
require('dotenv').config();

async function testEmbedding() {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  const modelId = 'amazon.titan-embed-text-v2'; // ชื่อโมเดลที่ใช้
  const text = "This is a test sentence.";

  try {
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ text })
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log("Embedding vector:", responseBody.results[0].embedding); // ปรับตามโครงสร้างของการตอบสนองจริง
  } catch (error) {
    console.error("Error during embedding test:", error);
  }
}

testEmbedding();