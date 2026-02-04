import { CanonicalIR } from '../shared/types';

export interface BaseAdapter {
    canHandle(mimeType: string, extension: string, buffer: Buffer): boolean;
    parse(buffer: Buffer, originalName: string): Promise<CanonicalIR>;
}
