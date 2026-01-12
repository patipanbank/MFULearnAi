import { Response } from 'express';
import { Request } from 'express';
import { titanEmbedService } from '../services/titan';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError } from '../errors';

/**
 * POST /api/embed - Generate embedding for text
 */
export const generateEmbedding = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { inputText } = req.body;

  if (!inputText) {
    throw new BadRequestError('inputText is required');
  }

  const embedding = await titanEmbedService.embedText(inputText);
  res.json({ embedding });
});
