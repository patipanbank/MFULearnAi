import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  InvokeModelCommand,
  Message,
  ToolConfiguration
} from '@aws-sdk/client-bedrock-runtime';

export interface BedrockTool {
  name: string;
  description: string;
  inputSchema: any;
  execute(input: any): Promise<any>;
}

class BedrockService {
  public chatModel: string = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  
  public models = {
    claude35: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    titanImage: 'amazon.titan-image-generator-v1',
    titan: 'amazon.titan-embed-text-v1'
  };

  private bedrockRuntimeClient: BedrockRuntimeClient;
  private readonly AWS_REGION = process.env.AWS_REGION || 'us-east-1';

  constructor() {
    this.bedrockRuntimeClient = new BedrockRuntimeClient({ region: this.AWS_REGION });
  }

  public setChatModel(modelId: string): void {
    if (Object.values(this.models).includes(modelId)) {
        this.chatModel = modelId;
    } else {
        console.warn(`Model ID "${modelId}" is not in the list of available models. Using default.`);
        this.chatModel = this.models.claude35;
    }
  }

  async invokeModelJSON(prompt: string, modelId: string = this.chatModel): Promise<any> {
    const response = await this.bedrockRuntimeClient.send(new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        top_p: 0.9,
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const assistantResponse = responseBody.content.find((c: any) => c.type === 'text')?.text || '';

    try {
      return JSON.parse(assistantResponse);
    } catch (error) {
      console.error("Error parsing JSON from model response:", assistantResponse);
      throw new Error("Failed to parse JSON from model response.");
    }
  }

  async invokeForText(
    prompt: string,
    modelId: string = this.models.claude35,
    max_tokens: number = 2048
    ): Promise<string> {
    const response = await this.bedrockRuntimeClient.send(new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content.find((c: any) => c.type === 'text')?.text || '';
  }

  public async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    const command = new ConverseCommand(input);
    const response = await this.bedrockRuntimeClient.send(command);
    return response;
  }

  async *converseStream(input: ConverseStreamCommandInput): AsyncGenerator<any> {
    const command = new ConverseStreamCommand(input);
    const responseStream = await this.bedrockRuntimeClient.send(command);

    if (responseStream.stream) {
      for await (const chunk of responseStream.stream) {
        yield chunk;
      }
    }
  }
}

export const bedrockService = new BedrockService();