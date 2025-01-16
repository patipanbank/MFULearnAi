import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class LlamaService {
  private static instance: LlamaService;
  private llamaProcess: any;

  private constructor() {
    this.startLlamaProcess();
  }

  public static getInstance(): LlamaService {
    if (!LlamaService.instance) {
      LlamaService.instance = new LlamaService();
    }
    return LlamaService.instance;
  }

  private startLlamaProcess() {
    try {
      const modelPath = '/home/mfulearnai/MFULearnAi/ai_service/models/llama-2-7b.Q4_K_M.gguf';
      const llamaPath = '/home/mfulearnai/MFULearnAi/ai_service/llama.cpp/build/bin/main';
      
      // ตรวจสอบว่าไฟล์มีอยู่จริง
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model not found at: ${modelPath}`);
      }
      if (!fs.existsSync(llamaPath)) {
        throw new Error(`LLaMA executable not found at: ${llamaPath}`);
      }

      console.log('Starting LLaMA process...');
      console.log('Model path:', modelPath);
      console.log('LLaMA path:', llamaPath);

      this.llamaProcess = spawn(llamaPath, [
        '-m', modelPath,
        '--ctx_size', '2048',
        '-t', '4',
        '-ngl', '0'
      ]);

      // Log process events
      this.llamaProcess.on('error', (err: Error) => {
        console.error('LLaMA process error:', err);
      });

      this.llamaProcess.on('exit', (code: number | null) => {
        console.log('LLaMA process exited with code:', code);
      });

      this.llamaProcess.stdout.on('data', (data: Buffer) => {
        console.log(`LLaMA output: ${data}`);
      });

      this.llamaProcess.stderr.on('data', (data: Buffer) => {
        console.error(`LLaMA error: ${data}`);
      });
    } catch (error) {
      console.error('Error starting LLaMA:', error);
      throw error;
    }
  }

  public async generateResponse(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.llamaProcess.stdin.write(prompt + '\n');
        
        let response = '';
        const timeoutId = setTimeout(() => {
          resolve(response || 'Sorry, could not generate response in time');
        }, 30000);

        const onData = (data: Buffer) => {
          response += data.toString();
          if (response.includes('[end]')) {
            clearTimeout(timeoutId);
            this.llamaProcess.stdout.removeListener('data', onData);
            resolve(response.split('[end]')[0].trim());
          }
        };

        this.llamaProcess.stdout.on('data', onData);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default LlamaService;
