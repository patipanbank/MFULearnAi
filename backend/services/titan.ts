import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

/**
 * TitanEmbedService converts text chunks into 512-dimensional vectors using
 * the amazon.titan-embed-text-v2:0 model via AWS Bedrock.
 */
export class TitanEmbedService {
  private client: BedrockRuntimeClient;
  private modelId: string = "amazon.titan-embed-text-v2:0";

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
   * Embeds the provided text into a vector using the Titan model.
   *
   * @param inputText - The text to be embedded.
   * @param dimensions - (Optional) The output dimensions (defaults to 512).
   * @param normalize - (Optional) Whether to normalize the embedding (defaults to true).
   * @returns A Promise resolving to an array of numbers representing the embedding.
   */
  async embedText(inputText: string, dimensions: number = 512, normalize: boolean = true): Promise<number[]> {
    const payload = {
      inputText,
      dimensions,
      normalize,
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: "application/json",
      accept: "*/*",
      body: JSON.stringify(payload)
    });

    try {
      const response = await this.client.send(command);
      if (!response.body) {
        throw new Error("Empty response body");
      }
      // Convert the streaming response body into a string
      const responseText = await this.streamToString(response.body);
      console.log("Titan embedding response:", responseText);
      const result = JSON.parse(responseText);
      if (!result.embedding) {
        throw new Error("No embedding field in the response");
      }
      return result.embedding;
    } catch (error) {
      console.error("Error invoking Titan model:", error);
      throw error;
    }
  }

  /**
   * Helper function to convert a stream into a string.
   */
  private streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }
}

export const titanEmbedService = new TitanEmbedService(); 