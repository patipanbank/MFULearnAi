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
   * Helper function to convert a response stream into a string.
   * It now checks for various types such as Buffer, ArrayBuffer, typed arrays,
   * an SDK-specific transform method, the web stream API (getReader),
   * and async iterable streams.
   */
  private async streamToString(stream: any): Promise<string> {
    // If stream is already a string, return it.
    if (typeof stream === 'string') {
      return stream;
    }
    // If stream is a Buffer.
    if (Buffer.isBuffer(stream)) {
      return stream.toString('utf8');
    }
    // If stream is an ArrayBuffer.
    if (stream instanceof ArrayBuffer) {
      return Buffer.from(new Uint8Array(stream)).toString('utf8');
    }
    // If stream is a typed array (e.g. Uint8Array).
    if (ArrayBuffer.isView(stream)) {
      return Buffer.from(new Uint8Array(stream.buffer, stream.byteOffset, stream.byteLength)).toString("utf8");
    }
    // If stream has an SDK-specific method to transform to byte array.
    if (typeof stream.transformToByteArray === "function") {
      const data = await stream.transformToByteArray();
      return Buffer.from(data).toString("utf8");
    }
    // If stream supports the web stream API.
    if (typeof stream.getReader === "function") {
      let result = "";
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += typeof value === "string" ? value : Buffer.from(value).toString("utf8");
      }
      return result;
    }
    // If stream is async iterable.
    if (Symbol.asyncIterator in stream) {
      let result = "";
      for await (const chunk of stream) {
        result += typeof chunk === "string" 
          ? chunk 
          : (Buffer.isBuffer(chunk) ? chunk.toString("utf8") : Buffer.from(chunk).toString("utf8"));
      }
      return result;
    }
    
    throw new Error("Stream is not async iterable, not a web stream, nor a Buffer or string");
  }
}

export const titanEmbedService = new TitanEmbedService(); 