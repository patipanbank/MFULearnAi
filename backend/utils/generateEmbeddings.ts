import { pipeline } from '@xenova/transformers';

export async function generateEmbeddings(text: string): Promise<number[]> {
  const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true
  });
  return Array.from(output.data);
} 