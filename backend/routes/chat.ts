import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';
import { CollectionModel, CollectionPermission, CollectionDocument } from '../models/Collection';
import { WebSocket, WebSocketServer } from 'ws';
import { UserRole } from '../models/User';
import { ChatHistory } from '../models/ChatHistory';

interface ChatHistoryDocument {
  _id: string;
  userId: string;
  modelId: string;
  collectionName: string;
  chatname: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    images?: Array<{
      data: string;
      mediaType: string;
    }>;
    sources?: Array<{
      modelId: string;
      collectionName: string;
      filename: string;
      similarity: number;
    }>;
    isImageGeneration?: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const router = Router();
const HEARTBEAT_INTERVAL = 30000;
const CLIENT_TIMEOUT = 35000;

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
}

// Middleware to verify token
const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(verifyToken);

const wss = new WebSocketServer({ 
  port: 5001,
  path: '/ws',
  clientTracking: true,
  verifyClient: (info, cb) => {
    try {
      // Get token from URL parameters
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
      console.log('Incoming WebSocket connection URL:', info.req.url);
      
      const token = url.searchParams.get('token');
      console.log('Token from URL params:', token ? 'Present' : 'Not present');
      
      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        cb(false, 401, 'Unauthorized');
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        (info.req as any).user = decoded;
        console.log('WebSocket connection authorized for user:', decoded.username);
        cb(true);
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        cb(false, 401, 'Invalid token');
        return;
      }
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      cb(false, 401, 'Unauthorized');
    }
  }
});

function heartbeat(this: WebSocket) {
  (this as ExtendedWebSocket).isAlive = true;
}

const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (!extWs.isAlive) {
      console.log(`Terminating inactive connection for user: ${extWs.userId}`);
      return ws.terminate();
    }
    extWs.isAlive = false;
    extWs.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(interval);
});

wss.on('connection', (ws: WebSocket, req: Request) => {
  const extWs = ws as ExtendedWebSocket;
  extWs.isAlive = true;
  
  // Try to get token from URL parameters first
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const urlToken = url.searchParams.get('token');
  
  // Then try to get from headers if not in URL
  const headerToken = req.headers['authorization']?.split(' ')[1];
  
  const token = urlToken || headerToken;
  
  console.log('Token sources:', {
    fromUrl: !!urlToken,
    fromHeader: !!headerToken,
    finalToken: !!token
  });
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      extWs.userId = decoded.username;
      console.log(`WebSocket client connected: ${extWs.userId}`);
    } catch (error) {
      console.error('Invalid token in WebSocket connection:', error);
      ws.close(1008, 'Invalid authentication token');
      return;
    }
  } else {
    console.error('No token found in either URL parameters or headers');
    ws.close(1008, 'No authentication token provided');
    return;
  }

  extWs.on('pong', heartbeat);

  extWs.on('error', (error) => {
    console.error(`WebSocket error for user ${extWs.userId}:`, error);
  });

  extWs.on('close', () => {
    console.log(`WebSocket client disconnected: ${extWs.userId}`);
  });

  extWs.on('message', async (message: string) => {
    try {
      console.log(`Raw WebSocket message received from ${extWs.userId}:`, message.toString());
      
      const data = JSON.parse(message.toString());
      const { messages, modelId, isImageGeneration, chatId, chatname } = data;

      if (!messages || !Array.isArray(messages)) {
        throw new Error('Invalid messages format');
      }

      if (!modelId) {
        throw new Error('ModelId is required');
      }

      const query = isImageGeneration
        ? messages[messages.length - 1].content
        : messages.map(msg => msg.content).join('\n');

      try {
        console.log('Starting response generation...');
        let assistantResponse = '';
        
        // Generate response once and collect the content
        for await (const content of chatService.generateResponse(messages, query, modelId)) {
          assistantResponse += content;
          if (extWs.readyState === WebSocket.OPEN) {
            console.log(`Sending content chunk to user ${extWs.userId}:`, content);
            extWs.send(JSON.stringify({ content }));
          } else {
            console.log(`Connection closed for user ${extWs.userId}, stopping response generation`);
            break;
          }
        }

        if (extWs.readyState === WebSocket.OPEN) {
          // Include both user messages and the complete assistant response
          const allMessages = [...messages];
          allMessages.push({
            id: messages.length + 1,
            role: 'assistant',
            content: assistantResponse,
            timestamp: new Date(),
            sources: [],
            isImageGeneration: isImageGeneration || false,
            isComplete: true
          });

          // Save chat history and handle response
          if (extWs.userId) {
            try {
              let savedChat;
              
              if (chatId && chatId !== 'undefined' && chatId !== 'null') {
                // Update existing chat
                try {
                  // Verify chat exists and belongs to user
                  const existingChat = await chatHistoryService.getSpecificChat(extWs.userId, chatId);
                  if (!existingChat) {
                    throw new Error('Chat not found');
                  }

                  // Update existing chat with new messages
                  savedChat = await chatHistoryService.saveChatMessage(
                    extWs.userId,
                    existingChat.modelId || modelId,
                    existingChat.collectionName || '',
                    allMessages,
                    chatId,
                    existingChat.chatname
                  );

                  // Send completion signal with existing chat ID
                  extWs.send(JSON.stringify({ 
                    done: true,
                    chatId: savedChat._id.toString(),
                    isNewChat: false,
                    shouldUpdateList: true,
                    timestamp: new Date().toISOString()
                  }));
                } catch (error) {
                  console.error('Error updating existing chat:', error);
                  extWs.send(JSON.stringify({ 
                    error: error instanceof Error ? error.message : 'Failed to update chat. Please try again.' 
                  }));
                  return;
                }
              } else {
                // Create new chat
                try {
                  savedChat = await chatHistoryService.saveChatMessage(
                    extWs.userId,
                    modelId,
                    '',
                    allMessages,
                    undefined,
                    chatname || messages[0]?.content.substring(0, 50) + "..."
                  );

                  // Send completion signal with new chat ID
                  extWs.send(JSON.stringify({ 
                    done: true,
                    chatId: savedChat._id.toString(),
                    isNewChat: true,
                    shouldUpdateList: true,
                    timestamp: new Date().toISOString()
                  }));

                  // Broadcast to all connected clients of the same user
                  wss.clients.forEach((client: WebSocket) => {
                    const extClient = client as ExtendedWebSocket;
                    if (extClient.userId === extWs.userId && extClient !== extWs) {
                      extClient.send(JSON.stringify({
                        shouldUpdateList: true,
                        timestamp: new Date().toISOString()
                      }));
                    }
                  });
                } catch (error) {
                  console.error('Error creating new chat:', error);
                  extWs.send(JSON.stringify({ 
                    error: error instanceof Error ? error.message : 'Failed to create new chat. Please try again.' 
                  }));
                  return;
                }
              }
              
              console.log(`Chat history updated for user ${extWs.userId}, chatId: ${savedChat?._id}`);
            } catch (error) {
              console.error('Error saving chat history:', error);
              extWs.send(JSON.stringify({ 
                error: 'Failed to save chat history. Please try again.' 
              }));
            }
          }
        }
      } catch (error) {
        console.error(`Error generating response for user ${extWs.userId}:`, error);
        if (extWs.readyState === WebSocket.OPEN) {
          extWs.send(JSON.stringify({ 
            error: 'An error occurred while generating the response. Please try again.' 
          }));
        }
      }
    } catch (error) {
      console.error(`Error processing message from user ${extWs.userId}:`, error);
      if (extWs.readyState === WebSocket.OPEN) {
        extWs.send(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid message format' 
        }));
      }
    }
  });
});

router.post('/', async (req: Request, res: Response) => {
  console.log('Received chat request');

  // 1. ส่ง headers ทันทีก่อนทำอย่างอื่น
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 2. ส่ง initial response เพื่อเริ่ม stream
  res.write(':\n\n');  // Keep-alive ping
  console.log('Sent initial response');

  try {
    const { messages, modelId, collectionName } = req.body;
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

    // 3. ฟังก์ชันสำหรับส่งข้อมูล
    const sendChunk = (content: string) => {
      const data = JSON.stringify({ content });
      res.write(`data: ${data}\n\n`);
    };

    // 4. ส่ง empty chunk เพื่อให้ frontend เริ่มอ่าน stream
    sendChunk('');
    
    console.log('Starting response generation');
    console.log('Starting generateResponse:', {
      modelId,
      collectionName,
      messagesCount: messages.length,
      query
    });

    try {
      for await (const content of chatService.generateResponse(messages, query, modelId)) {
        console.log('Sending chunk:', content);
        sendChunk(content);
      }
    } catch (error) {
      console.error('Error in stream generation:', error);
      sendChunk('\nขออภัย มีข้อผิดพลาดเกิดขึ้นระหว่างการสร้างคำตอบ');
    }

    console.log('Chat response completed');
    res.end();
  } catch (error) {
    console.error('Chat error details:', error);
    
    // ถ้ายังไม่ได้ส่ง headers
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    
    const errorData = JSON.stringify({ content: 'ขออภัย มีข้อผิดพลาดเกิดขึ้น กรุณาลองใหม่อีกครั้ง' });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
});

router.post('/history', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, modelId, collectionName, chatname } = req.body;
    // Get username and groups from user data
    const userId = (req.user as any)?.username || '';
    const userGroups = (req.user as any)?.groups || [];

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid messages format' });
      return;
    }

    if (!modelId) {
      res.status(400).json({ error: 'ModelId is required' });
      return;
    }

    // Process messages with optional images
    const processedMessages = messages.map((msg: any) => ({
      ...msg,
      images: msg.images ? msg.images.map((img: any) => ({
        data: img.data,
        mediaType: img.mediaType
      })) : undefined
    }));

    const history = await chatHistoryService.saveChatMessage(
      userId,
      modelId,
      collectionName,
      processedMessages,
      undefined, // chatId
      chatname // Pass the chatname
    );
    res.json(history);
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

router.get('/history', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await chatHistoryService.getChatHistory(userId, page, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get chat history' 
    });
  }
});

router.get('/history/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { chatId } = req.params;
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    res.json(chat);
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') {
      res.status(404).json({ error: 'Chat not found' });
    } else {
      console.error('Error getting specific chat:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get chat' 
      });
    }
  }
});

// Update chat
router.put('/history/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { chatId } = req.params;
    const { messages, modelId } = req.body;
    
    // Update the chat with new data
    const updatedChat = await chatHistoryService.saveChatMessage(
      userId,
      modelId || '',
      '',  // collectionName is optional
      messages,
      chatId
    );
    
    res.json(updatedChat);
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') {
      res.status(404).json({ error: 'Chat not found' });
    } else {
      console.error('Error updating chat:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update chat' 
      });
    }
  }
});

// Delete specific chat
router.delete('/history/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { chatId } = req.params;
    
    // First verify the chat exists and belongs to the user
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    
    // Delete the chat
    await ChatHistory.findByIdAndDelete(chatId);
    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') {
      res.status(404).json({ error: 'Chat not found' });
    } else {
      console.error('Error deleting chat:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete chat' 
      });
    }
  }
});

// Export chat
router.get('/history/:chatId/export', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { chatId } = req.params;
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    res.json(chat);
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') {
      res.status(404).json({ error: 'Chat not found' });
    } else {
      console.error('Error exporting chat:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to export chat' 
      });
    }
  }
});

// Import chat
router.post('/history/import', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const { messages, chatname } = req.body;
    
    const importedChat = await chatHistoryService.saveChatMessage(
      userId,
      '',  // modelId is not stored in ChatHistory
      '',  // collectionName is not stored in ChatHistory
      messages
    );
    
    res.json(importedChat);
  } catch (error) {
    console.error('Error importing chat:', error);
    res.status(500).json({ error: 'Failed to import chat' });
  }
});

router.route('/clear').delete(async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || !user.username) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Delete all chat history for the user using Mongoose model
    await ChatHistory.deleteMany({ userId: user.username });
    res.json({ success: true, message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, modelId } = req.body;
    const text = messages[messages.length - 1].content;
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/collections', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // ดึงข้อมูล collections จาก MongoDB
    const collections = await CollectionModel.find({});
    
    // Admin can access all collections
    if (user.groups.includes('Admin')) {
      res.json(collections.map(c => c.name));
      return;
    }
    
    // กรองตามสิทธิ์
    const accessibleCollections = collections.filter(collection => {
      switch (collection.permission) {
        case CollectionPermission.PUBLIC:
          return true;
        case CollectionPermission.STAFF_ONLY:
          return user.groups.includes('Staffs');
        case CollectionPermission.PRIVATE:
          return collection.createdBy === user.nameID;
        default:
          return false;
      }
    });

    // ส่งเฉพาะชื่อ collection ที่มีสิทธิ์
    res.json(accessibleCollections.map(c => c.name));
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

async function checkCollectionAccess(user: any, collection: any): Promise<boolean> {
  return user.groups.includes('Admin') || 
         user.groups.includes('Staffs') || 
         collection.createdBy === (user.nameID || user.username);
}

// Rename chat
router.put('/history/:chatId/rename', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { chatId } = req.params;
    const { newName } = req.body;

    // First verify the chat exists and belongs to the user
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    
    // Update only the chat name
    const updatedChat = await ChatHistory.findByIdAndUpdate(
      chatId,
      { chatname: newName },
      { new: true, runValidators: true }
    );
    
    if (!updatedChat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    
    res.json(updatedChat);
  } catch (error) {
    console.error('Error renaming chat:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to rename chat' 
    });
  }
});

router.put('/history/:chatId/pin', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username;
    const chatId = req.params.chatId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify chat exists and belongs to user
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Toggle isPinned status
    const updatedChat = await chatHistoryService.togglePinChat(userId, chatId);
    res.json(updatedChat);
  } catch (error) {
    console.error('Error toggling chat pin status:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to toggle chat pin status' 
    });
  }
});

export default router;