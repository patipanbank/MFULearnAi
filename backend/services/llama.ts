import { spawn } from 'child_process';
import path from 'path';

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
    // ปรับ path ให้เป็น Linux style
    const modelPath = '/home/mfulearnai/MFULearnAi/ai_service/models/llama-2-7b.Q4_K_M.gguf';
    
    this.llamaProcess = spawn('./build/bin/main', [
      '-m', modelPath,
      '--ctx_size', '2048',
      '-t', '4',
      '-ngl', '0'
    ], {
      cwd: '/home/mfulearnai/MFULearnAi/ai_service/llama.cpp'
    });

    this.llamaProcess.stdout.on('data', (data: Buffer) => {
      console.log(`LLaMA output: ${data}`);
    });

    this.llamaProcess.stderr.on('data', (data: Buffer) => {
      console.error(`LLaMA error: ${data}`);
    });
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
