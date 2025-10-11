import { BaseMessage } from "@langchain/core/messages";
export declare const AgentState: import("@langchain/langgraph").AnnotationRoot<{
    userQuery: import("@langchain/langgraph").LastValue<string>;
    collectionNames: import("@langchain/langgraph").LastValue<string[]>;
    toolsUsed: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    ragResults: import("@langchain/langgraph").LastValue<any[]>;
    webResults: import("@langchain/langgraph").LastValue<any[]>;
    finalAnswer: import("@langchain/langgraph").LastValue<string>;
    metadata: import("@langchain/langgraph").LastValue<{
        confidence: number;
        sources: string[];
        reasoningSteps: string[];
    }>;
    needsRag: import("@langchain/langgraph").LastValue<boolean>;
    needsWeb: import("@langchain/langgraph").LastValue<boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>;
export interface LangGraphAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    collectionNames?: string[];
    sessionId: string;
    tools?: {
        [name: string]: any;
    };
}
export declare function createLangGraphAgent(config: LangGraphAgentConfig): Promise<{
    graph: import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
        userQuery: import("@langchain/langgraph").LastValue<string>;
        collectionNames: import("@langchain/langgraph").LastValue<string[]>;
        toolsUsed: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
        ragResults: import("@langchain/langgraph").LastValue<any[]>;
        webResults: import("@langchain/langgraph").LastValue<any[]>;
        finalAnswer: import("@langchain/langgraph").LastValue<string>;
        metadata: import("@langchain/langgraph").LastValue<{
            confidence: number;
            sources: string[];
            reasoningSteps: string[];
        }>;
        needsRag: import("@langchain/langgraph").LastValue<boolean>;
        needsWeb: import("@langchain/langgraph").LastValue<boolean>;
        messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
    }>, import("@langchain/langgraph").UpdateType<{
        userQuery: import("@langchain/langgraph").LastValue<string>;
        collectionNames: import("@langchain/langgraph").LastValue<string[]>;
        toolsUsed: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
        ragResults: import("@langchain/langgraph").LastValue<any[]>;
        webResults: import("@langchain/langgraph").LastValue<any[]>;
        finalAnswer: import("@langchain/langgraph").LastValue<string>;
        metadata: import("@langchain/langgraph").LastValue<{
            confidence: number;
            sources: string[];
            reasoningSteps: string[];
        }>;
        needsRag: import("@langchain/langgraph").LastValue<boolean>;
        needsWeb: import("@langchain/langgraph").LastValue<boolean>;
        messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
    }>, "router" | "web" | "agent" | "rag" | "__start__", {
        userQuery: import("@langchain/langgraph").LastValue<string>;
        collectionNames: import("@langchain/langgraph").LastValue<string[]>;
        toolsUsed: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
        ragResults: import("@langchain/langgraph").LastValue<any[]>;
        webResults: import("@langchain/langgraph").LastValue<any[]>;
        finalAnswer: import("@langchain/langgraph").LastValue<string>;
        metadata: import("@langchain/langgraph").LastValue<{
            confidence: number;
            sources: string[];
            reasoningSteps: string[];
        }>;
        needsRag: import("@langchain/langgraph").LastValue<boolean>;
        needsWeb: import("@langchain/langgraph").LastValue<boolean>;
        messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
    }, {
        userQuery: import("@langchain/langgraph").LastValue<string>;
        collectionNames: import("@langchain/langgraph").LastValue<string[]>;
        toolsUsed: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
        ragResults: import("@langchain/langgraph").LastValue<any[]>;
        webResults: import("@langchain/langgraph").LastValue<any[]>;
        finalAnswer: import("@langchain/langgraph").LastValue<string>;
        metadata: import("@langchain/langgraph").LastValue<{
            confidence: number;
            sources: string[];
            reasoningSteps: string[];
        }>;
        needsRag: import("@langchain/langgraph").LastValue<boolean>;
        needsWeb: import("@langchain/langgraph").LastValue<boolean>;
        messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
    }, import("@langchain/langgraph").StateDefinition>;
    run(userQuery: string, messages?: BaseMessage[], onChunk?: (chunk: string) => void): Promise<{
        answer: any;
        metadata: any;
        toolsUsed: any;
    }>;
}>;
export type LangGraphAgent = Awaited<ReturnType<typeof createLangGraphAgent>>;
//# sourceMappingURL=langgraphAgent.d.ts.map