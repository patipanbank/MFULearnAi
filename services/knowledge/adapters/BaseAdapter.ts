import { CanonicalIR } from '../../../shared/types'; // Relative import assuming workspace structure

export interface BaseAdapter {
    canHandle(mimeType: string, extension: string, buffer: Buffer): boolean;
    parse(buffer: Buffer, originalName: string): Promise<CanonicalIR>;
}
