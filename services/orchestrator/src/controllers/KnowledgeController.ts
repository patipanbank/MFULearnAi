import { Request, Response } from 'express';
import { KnowledgeService } from '../services/KnowledgeService';
import { LoggerService } from '../services/LoggerService';

export class KnowledgeController {
    static async view(req: Request, res: Response) {
        const { id } = req.params;
        const userContext = (req as any).userContext;

        try {
            const result = await KnowledgeService.view(id, userContext);
            res.json(result);
        } catch (error: any) {
            LoggerService.error('knowledge_view_proxy_error', { id, error: error.message }, userContext.userId);
            res.status(error.response?.status || 500).json({
                error: error.response?.data?.error || 'Failed to retrieve view URL'
            });
        }
    }
}
