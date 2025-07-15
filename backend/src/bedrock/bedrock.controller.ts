import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BedrockService } from './bedrock.service';
import { Response } from 'express';

@Controller('bedrock')
@UseGuards(AuthGuard('jwt'))
export class BedrockController {
  constructor(private readonly bedrockService: BedrockService) {}

  @Get('models')
  async getModels(@Request() req) {
    return await this.bedrockService.getModels();
  }

  @Post('invoke')
  async invoke(@Request() req, @Body() body: { modelId: string; prompt: string; parameters?: any }) {
    return await this.bedrockService.invoke(body.modelId, body.prompt, body.parameters);
  }

  @Post('invoke-streaming')
  async invokeWithStreaming(@Request() req, @Body() body: { modelId: string; prompt: string; parameters?: any }) {
    return await this.bedrockService.invokeWithStreaming(body.modelId, body.prompt, body.parameters);
  }

  @Get('models/:id')
  async getModelInfo(@Request() req, @Param('id') id: string) {
    return await this.bedrockService.getModelInfo(id);
  }

  @Post('calculate-cost')
  async calculateCost(@Request() req, @Body() body: { modelId: string; inputTokens: number; outputTokens: number }) {
    return await this.bedrockService.calculateCost(body.modelId, body.inputTokens, body.outputTokens);
  }

  // Conversational Chat Endpoint
  @Post('converse-stream')
  async converseStream(
    @Request() req,
    @Body() body: {
      messages: any[];
      systemPrompt: string;
      modelId?: string;
      tools?: any[];
      temperature?: number;
      maxTokens?: number;
    },
    @Res() res: Response
  ) {
    try {
      const stream = await this.bedrockService.converseStream(
        body.messages,
        body.systemPrompt,
        body.modelId,
        body.tools,
        body.temperature,
        body.maxTokens
      );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of stream) {
        if (chunk.chunk?.bytes) {
          const data = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('Error in converse-stream:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Image Generation Endpoint
  @Post('generate-image')
  async generateImage(
    @Request() req,
    @Body() body: {
      prompt: string;
      modelId?: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      cfgScale?: number;
      seed?: number;
    }
  ) {
    try {
      const imageBase64 = await this.bedrockService.generateImage(
        body.prompt,
        body.modelId,
        body.negativePrompt,
        body.width,
        body.height,
        body.steps,
        body.cfgScale,
        body.seed
      );

      return {
        image: imageBase64,
        format: 'base64',
        modelId: body.modelId || 'stability.stable-diffusion-xl-v1'
      };
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  // Image Generation with Streaming Endpoint
  @Post('generate-image-stream')
  async generateImageStream(
    @Request() req,
    @Body() body: {
      prompt: string;
      modelId?: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      cfgScale?: number;
      seed?: number;
    },
    @Res() res: Response
  ) {
    try {
      const stream = await this.bedrockService.generateImageStream(
        body.prompt,
        body.modelId,
        body.negativePrompt,
        body.width,
        body.height,
        body.steps,
        body.cfgScale,
        body.seed
      );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of stream) {
        if (chunk.chunk?.bytes) {
          const data = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('Error in generate-image-stream:', error);
      res.status(500).json({ error: error.message });
    }
  }
} 