export interface ImageBlock {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}
export interface TextBlock {
    type: 'text';
    text: string;
}
export type ContentBlock = TextBlock | ImageBlock;
export interface LLMOptions {
    streaming?: boolean;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    model_kwargs?: Record<string, any>;
    systemPrompt?: string;
    [key: string]: any;
}
export declare class LLM {
    private client;
    private modelId;
    private options;
    private langchainModel;
    constructor(modelId: string, options?: LLMOptions);
    /**
     * สร้าง multimodal messages สำหรับ Bedrock API
     * รองรับทั้งข้อความและรูปภาพ
     */
    private buildMultimodalMessages;
    /**
     * Generate text from prompt using LangChain Bedrock LLM
     * - ใช้ LangChain ChatBedrock แทนการ implement เอง
     * - รองรับ system prompt และ message format
     * - เพิ่มการรองรับ multimodal (รูปภาพ)
     */
    generate(prompt: string, images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>): Promise<string>;
    /**
     * ใช้ Bedrock Multimodal API สำหรับโมเดลที่รองรับ (เช่น Claude 3.5)
     */
    private generateWithBedrockMultimodal;
    /**
     * Fallback method ใช้ Bedrock API โดยตรง (เหมือนเดิม)
     */
    private generateWithBedrockAPI;
    /**
     * Streaming generation using LangChain streaming
     * - ใช้ LangChain streaming แทนการ implement เอง
     * - เพิ่มการรองรับ multimodal
     */
    stream(prompt: string, images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>): AsyncGenerator<string, void, unknown>;
    /**
     * Streaming สำหรับ multimodal
     */
    private streamWithBedrockMultimodal;
    /**
     * Fallback streaming method ใช้ Bedrock API โดยตรง (เหมือนเดิม)
     */
    private streamWithBedrockAPI;
}
/**
 * getLLM: Return a Bedrock LLM instance for the requested modelId and options
 * - Compatible with backend-legacy/agents/llm_factory.py
 * - ใช้ LangChain เป็นหลัก แต่มี fallback ไปใช้ Bedrock API โดยตรง
 * - เพิ่มการรองรับ multimodal
 */
export declare function getLLM(modelId: string, options?: LLMOptions): LLM;
//# sourceMappingURL=llmFactory.d.ts.map