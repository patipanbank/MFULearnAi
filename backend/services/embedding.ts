import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export class EmbeddingService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  /**
   * Returns the embedding for a given input text using the Titan embed-text model.
   *
   * @param inputText - The text you want to embed.
   * @param dimensions - (Optional) The dimensions for the output embedding (defaults to 512).
   * @param normalize - (Optional) Whether to normalize the output embedding (defaults to true).
   *
   * @returns A Promise resolving to the embedding result.
   */
  async embedText(inputText: string, dimensions = 512, normalize = true): Promise<any> {
    const modelId = "amazon.titan-embed-text-v2:0";
    const payload = {
      inputText,
      dimensions,
      normalize
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "*/*",
      body: JSON.stringify(payload)
    });

    try {
      const response = await this.client.send(command);
      // Convert the streaming response body into a string
      const responseBody = await this.streamToString(response.body);
      // Parse and return the embedding result
      return JSON.parse(responseBody);
    } catch (error) {
      console.error("Error embedding text:", error);
      throw error;
    }
  }

  // Helper function to convert a stream into a string.
  private streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }
}

export const embeddingService = new EmbeddingService();
