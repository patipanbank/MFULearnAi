import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

console.log(`Starting OCR Worker... Redis: ${REDIS_HOST}:${REDIS_PORT}`);

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD
};

const worker = new Worker('ocr-queue', async (job: Job) => {
    console.log(`Processing Job ${job.id}`);
    const { buffer, fileName, fileType } = job.data;

    if (!buffer) throw new Error('No buffer provided');

    // Save to temp file
    const tempFilePath = path.join(os.tmpdir(), `ocr_${job.id}_${crypto.randomUUID()}.${fileType}`);
    const fileBuffer = Buffer.from(buffer, 'base64');
    fs.writeFileSync(tempFilePath, fileBuffer);

    try {
        const result = await runPythonOcr(tempFilePath, (progress) => {
            job.updateProgress(progress);
        });
        console.log(`Job ${job.id} completed`);
        return result;
    } catch (e) {
        console.error(`Job ${job.id} failed`, e);
        throw e;
    } finally {
        // Cleanup
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}, { connection });

function runPythonOcr(filePath: string, onProgress: (p: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [path.join(__dirname, 'ocr.py'), filePath]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('PROGRESS:')) {
                    const progress = parseInt(line.split(':')[1].trim());
                    if (!isNaN(progress)) {
                        onProgress(progress);
                    }
                } else if (line.trim()) {
                    dataString += line + '\n';
                }
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}: ${errorString}`));
            } else {
                try {
                    // Filter out progress lines from dataString just in case
                    const jsonLines = dataString.trim().split('\n').filter(l => !l.startsWith('PROGRESS:'));
                    const result = JSON.parse(jsonLines.join(''));
                    resolve(result);
                } catch (e) {
                    reject(new Error(`Failed to parse Python output: ${dataString}`));
                }
            }
        });
    });
}
