/**
 * สร้าง prompt template สำหรับ agent (เหมือน backend-legacy/agents/prompt_factory.py)
 * - รองรับ message placeholder, system prompt, user/assistant message
 * - ใช้ LangChain PromptTemplate
 * - เพิ่ม tool instructions แบบ legacy
 */
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatPromptTemplate } from '@langchain/core/prompts';
export declare function createPromptTemplate(systemPrompt: string, useHistory?: boolean): (messages: {
    role: string;
    content: string;
}[], scratchpad?: string[]) => string;
/**
 * สร้าง LangChain PromptTemplate สำหรับ agent
 * - ใช้ LangChain PromptTemplate แทนการสร้าง prompt string เอง
 * - รองรับ system prompt, history, และ scratchpad
 */
export declare function createLangChainPromptTemplate(systemPrompt: string, useHistory?: boolean): PromptTemplate;
/**
 * สร้าง prompt template สำหรับ LangChain Agent (เหมือน Legacy)
 * - ใช้ format ที่เหมาะสมกับ LangChain Agent
 * - เพิ่ม tool instructions แบบ legacy
 */
export declare function createAgentPromptTemplate(systemPrompt: string): PromptTemplate;
/**
 * สร้าง system prompt แบบ legacy (เหมือน backend-legacy)
 * - รวม tool instructions
 * - รองรับ hybrid memory management
 */
export declare function createLegacySystemPrompt(basePrompt?: string): string;
/**
 * สร้าง ChatPromptTemplate สำหรับ LangChain Agent (เหมือน Legacy)
 * - ใช้ format ที่เหมาะสมกับ LangChain Agent
 * - รองรับ hybrid memory management
 */
export declare function createLegacyChatPromptTemplate(systemPrompt?: string): ChatPromptTemplate;
//# sourceMappingURL=promptFactory.d.ts.map