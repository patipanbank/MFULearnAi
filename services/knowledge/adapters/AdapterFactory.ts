import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR } from '../shared/types';
import { PdfAdapter } from './PdfAdapter';
import { OfficeAdapter } from './OfficeAdapter';
import { TextAdapter } from './TextAdapter';
// import fileType from 'file-type'; // Need to install if not present, or use simple magic bytes

export class AdapterFactory {
    private adapters: BaseAdapter[] = [];

    constructor() {
        // Register Adapters
        this.adapters.push(new PdfAdapter());
        this.adapters.push(new OfficeAdapter());
        this.adapters.push(new TextAdapter());
    }

    async getAdapter(buffer: Buffer, originalName: string, mimeType: string): Promise<BaseAdapter> {
        // 1. Magic Bytes Check (Robust)
        // const fileTypeResult = await fileType.fromBuffer(buffer); 
        // const detectedMime = fileTypeResult?.mime || mimeType;

        const ext = originalName.split('.').pop()?.toLowerCase() || '';

        for (const adapter of this.adapters) {
            if (adapter.canHandle(mimeType, ext, buffer)) {
                return adapter;
            }
        }

        throw new Error(`No adapter found for file: ${originalName} (${mimeType})`);
    }
}
