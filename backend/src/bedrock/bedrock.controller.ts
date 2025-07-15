import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { BedrockService } from './bedrock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bedrock')
@UseGuards(JwtAuthGuard)
export class BedrockController {
  constructor(private bedrockService: BedrockService) {}

  @Post('chat')
  async chat(@Body() body: any, @Request() req: any): Promise<any> {
    try {
      const { messages, systemPrompt, modelId, temperature, topP } = body;
      const userId = req.user.id;

      if (!messages || !Array.isArray(messages)) {
        throw new HttpException('Messages array is required', HttpStatus.BAD_REQUEST);
      }

      const response = await this.bedrockService.converseStream(
        modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        messages,
        systemPrompt || '',
        undefined,
        temperature || 0.7,
        topP || 0.9,
      );

      return {
        success: true,
        data: response,
        message: 'Chat response generated successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate chat response: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('embedding')
  async createEmbedding(@Body() body: any, @Request() req: any): Promise<any> {
    try {
      const { text, modelId } = body;
      const userId = req.user.id;

      if (!text) {
        throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
      }

      const embedding = await this.bedrockService.createTextEmbedding(text);

      return {
        success: true,
        data: { embedding },
        message: 'Embedding created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('batch-embedding')
  async createBatchEmbeddings(@Body() body: any, @Request() req: any): Promise<any> {
    try {
      const { texts, modelId } = body;
      const userId = req.user.id;

      if (!texts || !Array.isArray(texts)) {
        throw new HttpException('Texts array is required', HttpStatus.BAD_REQUEST);
      }

      const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);

      return {
        success: true,
        data: { embeddings },
        message: 'Batch embeddings created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create batch embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('image-generation')
  async generateImage(@Body() body: any, @Request() req: any): Promise<any> {
    try {
      const { prompt } = body;
      const userId = req.user.id;

      if (!prompt) {
        throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
      }

      const image = await this.bedrockService.generateImage(prompt);

      return {
        success: true,
        data: { image },
        message: 'Image generated successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('agent/invoke')
  async invokeAgent(@Body() body: any, @Request() req: any): Promise<any> {
    try {
      const { agentId, agentAliasId, sessionId, input } = body;
      const userId = req.user.id;

      if (!agentId || !agentAliasId || !sessionId || !input?.text) {
        throw new HttpException('Agent ID, alias ID, session ID, and input text are required', HttpStatus.BAD_REQUEST);
      }

      const response = await this.bedrockService.invokeAgent(
        agentId,
        agentAliasId,
        sessionId,
        input,
      );

      return {
        success: true,
        data: response,
        message: 'Agent invoked successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to invoke agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 