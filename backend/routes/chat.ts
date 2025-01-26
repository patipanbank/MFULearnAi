import express from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { VectorStoreManager } from '../lib/vectorStore';
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import KnowledgeBase from '../models/KnowledgeBase';

const router = express.Router();

type ChatBody = { message: string, knowledgeBaseId: string };

const chatHandler: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { message, knowledgeBaseId } = req.body as ChatBody;
    if (!knowledgeBaseId) {
      res.status(400).json({ message: 'Knowledge base ID is required' });
      return;
    }

    // Get knowledge base and model info
    const kb = await KnowledgeBase.findById(knowledgeBaseId).populate('baseModelId');
    if (!kb) {
      res.status(404).json({ message: 'Knowledge base not found' });
      return;
    }

    const model = kb.baseModelId as any;

    // Create embeddings
    const embeddings = new OllamaEmbeddings({
      model: model.modelType,
      baseUrl: "http://ollama:11434"
    });
    const queryEmbedding = await embeddings.embedQuery(message);

    // Get relevant documents
    const vectorStore = await VectorStoreManager.getInstance().getStore(knowledgeBaseId);
    const results = await vectorStore.similaritySearch(message, 3);

    // Create prompt with context
    const context = results.map(doc => doc.pageContent).join('\n\n');
    const prompt = `Context information is below:
    ${context}

    Using the above context, please answer the following question. If the context doesn't contain relevant information, please say so.
    Question: ${message}`;

    // Get response from LLM
    const response = await fetch('http://ollama:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.modelType,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response from model');
    }

    const data = await response.json();
    
    res.json({
      response: data.response,
      model: {
        name: model.displayName,
        description: model.description
      },
      knowledgeBase: {
        name: kb.displayName,
        description: kb.description
      },
      context: results.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
};

router.post('/', chatHandler);

export default router;
