import { Router, Request, Response, NextFunction } from 'express';
import { searchService } from '../services/searchService';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// ตรวจสอบ token เหมือนกับ route อื่น ๆ
const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(verifyToken);

/**
 * @route POST /api/search
 * @desc Search the web using SearchXNG
 * @access Private
 */
router.post('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin']), async (req: Request, res: Response) => {
  try {
    const { query, language = 'th' } = req.body;
    
    if (!query) {
      res.status(400).json({ error: 'Please enter a search query' });
    }
    
    const results = await searchService.search(query, language);
    res.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An error occurred during search'
    });
  }
});

/**
 * @route POST /api/search/content
 * @desc Search and fetch content from the top result
 * @access Private
 */
router.post('/content', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin']), async (req: Request, res: Response) => {
  try {
    const { query, language = 'th' } = req.body;
    
    if (!query) {
      res.status(400).json({ error: 'Please enter a search query' });
    }
    
    const content = await searchService.searchAndFetchContent(query, language);
    res.json({ content });
  } catch (error) {
    console.error('Error in search content API:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An error occurred during search and fetching content'
    });
  }
});

export default router; 