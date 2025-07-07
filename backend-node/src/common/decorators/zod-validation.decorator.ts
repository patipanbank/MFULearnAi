import { UsePipes } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../zod-validation.pipe';

export const ZodValidation = (schema: ZodSchema) => {
  return UsePipes(new ZodValidationPipe(schema));
}; 