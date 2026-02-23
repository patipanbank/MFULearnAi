import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR } from '../../../../shared/types';
import { PdfAdapter } from './PdfAdapter';
import { OfficeAdapter } from './OfficeAdapter';
import { TextAdapter } from './TextAdapter';

export class AdapterFactory {
    private adapters: BaseAdapter[] = [];

    constructor() {
        // Register Adapters in priority order
        this.adapters.push(new PdfAdapter());
        this.adapters.push(new OfficeAdapter());
        this.adapters.push(new TextAdapter());
    }

    async getAdapter(buffer: Buffer, originalName: string, mimeType: string): Promise<BaseAdapter> {
        // CQ-16: Magic bytes detection (file-type) is not currently installed.
        // The system relies on MIME type from the client and file extension as fallback.
        // If spoofed file types become an issue, install the `file-type` package and enable:
        //   const { fileTypeFromBuffer } = await import('file-type');
        //   const detected = await fileTypeFromBuffer(buffer);
        //   const detectedMime = detected?.mime || mimeType;

        const ext = originalName.split('.').pop()?.toLowerCase() || '';

        for (const adapter of this.adapters) {
            if (adapter.canHandle(mimeType, ext, buffer)) {
                return adapter;
            }
        }

        throw new Error(`No adapter found for file: ${originalName} (${mimeType})`);
    }
}
