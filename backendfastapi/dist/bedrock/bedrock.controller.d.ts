import { BedrockService } from './bedrock.service';
export declare class BedrockController {
    private bedrockService;
    constructor(bedrockService: BedrockService);
    chat(body: any, req: any): Promise<any>;
    createEmbedding(body: any, req: any): Promise<any>;
    createBatchEmbeddings(body: any, req: any): Promise<any>;
    generateImage(body: any, req: any): Promise<any>;
    invokeAgent(body: any, req: any): Promise<any>;
}
