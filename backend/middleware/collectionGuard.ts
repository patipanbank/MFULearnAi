import { Collection } from "mongoose";

import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
  };
}

export const collectionGuard: RequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { collectionName } = req.params;
    const userId = (req as RequestWithUser).user.id;

    const collection = await Collection.findOne({ name: collectionName });
    
    if (!collection) {
      res.status(404).json({ message: 'Collection not found' });
      return;
    }

    // อนุญาตให้เข้าถึงถ้า:
    // 1. collection เป็น public หรือ
    // 2. user เป็นเจ้าของ collection เท่านั้น
    if (collection.isPublic || collection.createdBy === userId) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied to this collection' });
      return;
    }
  } catch (error) {
    console.error('Collection guard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 