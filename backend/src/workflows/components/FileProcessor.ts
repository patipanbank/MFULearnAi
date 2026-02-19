import { KnowledgeService } from '../../services/KnowledgeService';
import { ChatAttachmentService } from '../../services/ChatAttachmentService';
import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, FileJobResult, NativeDocBlock, ExtractedTextBlock } from '../types/AgentTypes';
import { queueService, ocrQueueEvents } from '../../services/QueueService';
import * as crypto from 'crypto';

// Max size for Bedrock native document attachment (before base64 encoding)
const MAX_NATIVE_DOC_SIZE = 4.5 * 1024 * 1024;

// File types that need OCR/parser processing (not suitable for Bedrock native doc block)
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff']);
const OCR_REQUIRED_EXTENSIONS = new Set(['pdf', ...IMAGE_EXTENSIONS]);

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

        const totalFiles = files.length;
        const uploadPromises: Promise<any>[] = [];
        let needsAsyncProcessing = false;

        for (let fi = 0; fi < files.length; fi++) {
            const file = files[fi];
            const fileName = file.originalname || file.name || 'file';
            const fileSize = file.buffer?.length || 0;
            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
            const ext = fileName.split('.').pop()?.toLowerCase() || '';

            const emitProgress = (stage: string, percent: number, detail?: string) => {
                emit(AGENT_EVENTS.FILE_PROGRESS, {
                    fileName, fileIndex: fi, totalFiles, stage, percent, detail: detail || ''
                });
            };

            emitProgress('preparing', 5, `${fileSizeMB} MB`);

            if (!file.buffer || fileSize === 0) {
                emitProgress('error', 0, 'ไม่พบข้อมูลไฟล์');
                LoggerService.warn('file_empty_buffer', { fileName, fileIndex: fi }, userId);
                continue;
            }

            // Upload to MinIO in background (all file types)
            uploadPromises.push(
                ChatAttachmentService.uploadFile(
                    file.buffer, fileName, file.mediaType || 'application/octet-stream', userId
                )
                    .then(meta => {
                        emit(AGENT_EVENTS.FILE_UPLOADED, { fileName, metadata: meta });
                        return { ...meta, fileType: ext };
                    })
                    .catch(e => {
                        LoggerService.error('file_upload_error', { fileName, error: e.message }, userId);
                        return null;
                    })
            );

            // Decision: Native text/code vs OCR/Parser required
            const needsOcr = OCR_REQUIRED_EXTENSIONS.has(ext) || fileSize >= MAX_NATIVE_DOC_SIZE;

            if (!needsOcr) {
                // Small text/code/markdown files — encode directly for Bedrock
                emitProgress('encoding', 50, 'Processing locally...');
                const sanitizedName = this.sanitizeFileName(fileName);
                result.nativeDocBlocks.push({
                    type: 'document',
                    format: ext || 'txt',
                    name: sanitizedName,
                    data: Buffer.from(file.buffer).toString('base64')
                });
                emitProgress('done', 100, 'Ready');
            } else {
                // PDF, images, or large files — send to OCR queue
                needsAsyncProcessing = true;
                emitProgress('queued', 20, 'Sending to OCR Worker...');

                LoggerService.info('ocr_queue_add_start', { fileName, ext, fileSize }, userId);
                const jobId = await queueService.addOcrJob({
                    buffer: file.buffer.toString('base64'),
                    fileName,
                    fileType: ext,
                    userId
                });
                LoggerService.info('ocr_queue_add_complete', { jobId, fileName }, userId);

                // Track last job ID for waitForJob — batched multi-file OCR is a future enhancement
                result.jobId = jobId;
            }
        }

        // Wait for all MinIO uploads to complete
        try {
            LoggerService.info('upload_batch_wait_start', { count: uploadPromises.length }, userId);
            const uploaded = await Promise.all(uploadPromises);
            result.attachments = uploaded.filter(u => u !== null);
            LoggerService.info('upload_batch_wait_complete', {
                total: uploadPromises.length,
                successful: result.attachments.length
            }, userId);
        } catch (e: any) {
            LoggerService.warn('upload_batch_partial_failure', { error: e.message }, userId);
        }

        if (needsAsyncProcessing) {
            result.status = 'pending';
        }

        return result;
    }

    static async waitForJob(
        jobId: string,
        emit: (type: string, payload: any) => void,
        timeoutMs: number = 60000
    ): Promise<FileJobResult> {
        // Poll Queue or Redis for result
        // For BullMQ, getting the job result:
        const job = await queueService.ocrQueue.getJob(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);

        const progressListener = ({ jobId: id, data }: { jobId: string; data: any }) => {
            if (id === jobId) {
                const percent = typeof data === 'number' ? data : 0;
                emit(AGENT_EVENTS.FILE_PROGRESS, {
                    fileName: 'Processing...', // We might not have filename here easily without passing it or querying job
                    fileIndex: 0,
                    totalFiles: 1,
                    stage: 'processing',
                    percent: 20 + (percent * 0.8), // Scale 0-100 to 20-100 range
                    detail: `OCR Processing: ${percent}%`
                });
            }
        };
        // @ts-ignore - JobProgress type mismatch with simplified listener
        ocrQueueEvents.on('progress', progressListener);

        try {
            const output = await job.waitUntilFinished(ocrQueueEvents, timeoutMs);

            if (!output || !output.blocks) {
                LoggerService.warn('OCR Job Returned No Blocks', { jobId, output });
                return {
                    status: 'done', // Or partial?
                    jobId,
                    nativeDocBlocks: [],
                    extractedTextBlocks: [],
                    attachments: []
                };
            }

            return {
                status: 'done',
                jobId,
                nativeDocBlocks: [],
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
        } finally {
            // @ts-ignore
            ocrQueueEvents.off('progress', progressListener);
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
