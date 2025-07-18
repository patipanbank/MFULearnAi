import express from 'express';
import { bedrockService, ConverseStreamRequest, ImageGenerationRequest } from '../services/bedrockService';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await bedrockService.healthCheck();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ 
      error: 'Health check failed', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// List available models
router.get('/models', async (req, res) => {
  try {
    const models = await bedrockService.listModels();
    res.json({
      models,
      count: models.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list models', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Streaming chat completions
router.post('/converse-stream', async (req, res) => {
  try {
    const request: ConverseStreamRequest = req.body;
    
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create async generator for streaming
    const stream = bedrockService.converseStream(
      request.model_id || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      request.messages,
      request.system_prompt || '',
      request.tool_config,
      request.temperature,
      request.top_p
    );

    // Stream events to client
    for await (const event of stream) {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      res.write(data);
    }

    res.end();
  } catch (error) {
    console.error('Error in converse-stream:', error);
    res.status(500).json({ 
      error: 'Streaming failed', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Text embeddings
router.post('/embeddings/text', async (req, res) => {
  try {
    const { text, model_id } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const embedding = await bedrockService.createTextEmbedding(text, model_id);
    return res.json({ embedding });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to create text embedding', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Batch text embeddings
router.post('/embeddings/text/batch', async (req, res) => {
  try {
    const { texts, model_id } = req.body;
    
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    const embeddings = await bedrockService.createBatchTextEmbeddings(texts, model_id);
    return res.json({ embeddings });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to create batch text embeddings', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Image embeddings
router.post('/embeddings/image', async (req, res) => {
  try {
    const { image_base64, text, model_id } = req.body;
    
    if (!image_base64) {
      return res.status(400).json({ error: 'Image base64 is required' });
    }

    const embedding = await bedrockService.createImageEmbedding(image_base64, text, model_id);
    return res.json({ embedding });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to create image embedding', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Image generation
router.post('/images/generate', async (req, res) => {
  try {
    const request: ImageGenerationRequest = req.body;
    
    if (!request.prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const image = await bedrockService.generateImage(
      request.prompt,
      request.width || 1024,
      request.height || 1024,
      request.quality || 'standard'
    );

    if (!image) {
      return res.status(500).json({ error: 'No image returned from Bedrock' });
    }

    return res.json({ image });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to generate image', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router; 