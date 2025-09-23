import { Request, Response } from 'express';
export declare class ModernSystemIntegration {
    private isEnabled;
    constructor();
    handleChatMessage(req: Request, res: Response): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        system: string;
        components: Record<string, boolean>;
        details: Record<string, any>;
    }>;
    runBenchmark(): Promise<{
        system: string;
        tests: Record<string, any>;
        summary: {
            totalTime: number;
            avgResponseTime: number;
            successRate: number;
        };
    }>;
    testKnowledgeRetrieval(query: string, collectionNames: string[]): Promise<{
        query: string;
        collections: string[];
        results: Record<string, any>;
        success: boolean;
        totalTime: number;
    }>;
    setEnabled(enabled: boolean): void;
    getStatus(): {
        enabled: boolean;
        system: string;
        timestamp: string;
    };
}
export declare const modernSystemIntegration: ModernSystemIntegration;
//# sourceMappingURL=modernSystemIntegration.d.ts.map