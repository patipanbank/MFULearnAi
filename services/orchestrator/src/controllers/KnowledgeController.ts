import { Request, Response } from 'express';
import { KnowledgeService } from '../services/KnowledgeService';
import { LoggerService } from '../services/LoggerService';

export class KnowledgeController {
    static async view(req: Request, res: Response) {
        const { id } = req.params;

        // Support token in query for window.open
        let userContext = (req as any).userContext;
        if (!userContext && req.query.token) {
            try {
                const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
                const jwt = require('jsonwebtoken');
                userContext = jwt.verify(req.query.token, JWT_SECRET);
            } catch (e) {
                return res.status(401).json({ error: 'Invalid session token' });
            }
        }

        if (!userContext) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const kbResponse = await KnowledgeService.stream(id, userContext);

            // Forward headers
            res.setHeader('Content-Type', kbResponse.headers['content-type']);
            res.setHeader('Content-Disposition', kbResponse.headers['content-disposition']);

            kbResponse.data.pipe(res);
        } catch (error: any) {
            LoggerService.error('knowledge_view_proxy_error', { id, error: error.message }, userContext.userId);
            if (!res.headersSent) {
                res.status(error.response?.status || 500).json({
                    error: error.response?.data?.error || 'Failed to retrieve file stream'
                });
            }
        }
    }
}
