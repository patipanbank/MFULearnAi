import { Request, Response } from 'express';
export declare class AgentController {
    static getAllAgents(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static getAgentById(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static createAgent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateAgent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteAgent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static getAgentTemplates(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static searchAgents(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static getPopularAgents(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static incrementUsageCount(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateAgentRating(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=agentController.d.ts.map