import { KnowledgeService } from '../../services/KnowledgeService';
import { ChatAttachmentService } from '../../services/ChatAttachmentService';
import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, FileJobResult, NativeDocBlock, ExtractedTextBlock } from '../types/AgentTypes';
import { queueService, ocrQueueEvents } from '../../services/QueueService';
import * as crypto from 'crypto';

export class FileProcessor {
    static async processFiles(
        files: any[],
        userId: string,
        emit: (type: string, payload: any) => void
    ): Promise<FileJobResult> {
        const result: FileJobResult = {
            status: 'done',
            jobId: crypto.randomUUID(),
            nativeDocBlocks: [],
            extractedTextBlocks: [],
            attachments: []
        };

        if (!files || files.length === 0) return result;

        LoggerService.info('agent_files_received', {
            filesCount: files.length,
            fileDetails: files.map((f: any) => ({
                name: f.originalname || f.name,
                size: f.size,
                hasBuffer: !!f.buffer
            }))
        }, userId);

        const MAX_NATIVE_SIZE = 4.5 * 1024 * 1024;
        const totalFiles = files.length;
        const uploadPromises: Promise<any>[] = [];
        let needsAsyncProcessing = false;

        for (let fi = 0; fi < files.length; fi++) {
            const file = files[fi];
            const fileName = file.originalname || file.name || 'file';
            const fileSizeMB = ((file.buffer?.length || 0) / (1024 * 1024)).toFixed(1);
            const ext = (fileName).split('.').pop()?.toLowerCase() || 'pdf';

            const emitProgress = (stage: string, percent: number, detail?: string) => {
                emit(AGENT_EVENTS.FILE_PROGRESS, {
                    fileName, fileIndex: fi, totalFiles, stage, percent, detail: detail || ''
                });
            };

            emitProgress('preparing', 5, `${fileSizeMB} MB`);

            if (!file.buffer) {
                emitProgress('error', 0, 'ไม่พบข้อมูลไฟล์');
                continue;
            }

            // Upload in background
            uploadPromises.push(
                ChatAttachmentService.uploadFile(file.buffer, fileName, file.mediaType || 'application/pdf', userId)
                    .then(meta => {
                        emit(AGENT_EVENTS.FILE_UPLOADED, { fileName, metadata: meta });
                        return { ...meta, fileType: ext };
                    })
                    .catch(e => null)
            );

            // Decision: Native vs Async OCR
            if (file.buffer.length < MAX_NATIVE_SIZE && ext !== 'pdf' && ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') {
                // Native Text/Code/MD
                emitProgress('encoding', 50, 'Processing locally...');
                const rawName = this.sanitizeFileName(fileName);
                result.nativeDocBlocks.push({
                    type: 'document',
                    format: ext,
                    name: rawName,
                    data: Buffer.from(file.buffer).toString('base64')
                });
                emitProgress('done', 100, 'Ready');
            } else {
                // Heavy File or PDF/Image -> Send to Queue
                needsAsyncProcessing = true;
                emitProgress('queued', 20, 'Sending to OCR Worker...');

                // Add to Queue
                const jobId = await queueService.addOcrJob({
                    buffer: file.buffer.toString('base64'),
                    fileName,
                    fileType: ext,
                    userId
                });

                // For now, we only support one job ID tracking per batch in the result interface.
                // If multiple files need OCR, we really should have a batch job or multiple IDs.
                // For Phase 3 iteration, let's assume one main job tracks the batch or the last one wins,
                // OR better: The AgentWorkflow waits for this specific jobId. 
                // Let's update result.jobId to this real one.
                result.jobId = jobId;
            }
        }

        try {
            const uploaded = await Promise.all(uploadPromises);
            result.attachments = uploaded.filter(u => u !== null);
        } catch (e) {
            LoggerService.warn('upload_failed', e);
        }

        if (needsAsyncProcessing) {
            result.status = 'pending';
        }

        return result;
    }

    static async waitForJob(jobId: string, timeoutMs: number = 60000): Promise<FileJobResult> {
        // Poll Queue or Redis for result
        // For BullMQ, getting the job result:
        const job = await queueService.ocrQueue.getJob(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);

        try {
            await job.waitUntilFinished(ocrQueueEvents, timeoutMs);
            const output = await job.returnvalue; // { blocks: [ExtractedTextBlock], status: 'done' }

            return {
                status: 'done',
                jobId,
                nativeDocBlocks: [], // filled by caller or separate logic? 
                // The worker should return ExtractedTextBlock[]
                extractedTextBlocks: output.blocks || [],
                attachments: [] // attachments are already handled in processFiles
            };
        } catch (e) {
            LoggerService.error('OCR Job Failed', e);
            return {
                status: 'failed',
                jobId,
                nativeDocBlocks: [],
                extractedTextBlocks: [],
                attachments: []
            };
        }
    }

    private static sanitizeFileName(name: string): string {
        return name
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'document';
    }
}
