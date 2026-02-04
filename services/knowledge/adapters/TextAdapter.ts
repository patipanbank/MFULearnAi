import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR } from '../../../shared/types';
import * as chardet from 'chardet';

export class TextAdapter implements BaseAdapter {
    canHandle(mimeType: string, extension: string, buffer: Buffer): boolean {
        return mimeType.startsWith('text/') ||
            ['txt', 'md', 'py', 'js', 'ts', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'php', 'rb', 'sh'].includes(extension);
    }

    async parse(buffer: Buffer, originalName: string): Promise<CanonicalIR> {
        // Detect encoding if possible, default to utf-8
        // For simplicity, assuming utf-8 or ascii. 
        // Real implementation might use chardet.
        const encoding = chardet.detect(buffer) || 'utf-8';
        const decoder = new TextDecoder(encoding as string);
        const text = decoder.decode(buffer);

        const isCode = !originalName.endsWith('.txt') && !originalName.endsWith('.md');
        const lang = originalName.split('.').pop() || 'text';

        return {
            file_type: isCode ? 'code' : 'document',
            blocks: [{
                type: isCode ? 'code' : 'text',
                content: text,
                metadata: {
                    title: originalName,
                    language: lang,
                    confidence: 1.0,
                    source: 'text_layer'
                }
            }],
            metadata: {
                total_tokens: text.length / 4, // Rough estimate
                detected_language: lang
            }
        };
    }
}
