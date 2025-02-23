import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';
import { CollectionModel, CollectionPermission, CollectionDocument } from '../models/Collection';
import { WebSocket, WebSocketServer } from 'ws';
import { UserRole } from '../models/User';

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
      const data = JSON.parse(message);
      const { messages, modelId, isImageGeneration, chatId } = data;

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
        for await (const content of chatService.generateResponse(messages, query, modelId)) {
          if (extWs.readyState === WebSocket.OPEN) {
            console.log(`Sending content chunk to user ${extWs.userId}:`, content);
            extWs.send(JSON.stringify({ content }));
          } else {
            console.log(`Connection closed for user ${extWs.userId}, stopping response generation`);
            break;
          }
        }

        if (extWs.readyState === WebSocket.OPEN) {
          console.log(`Sending completion signal to user ${extWs.userId}`);
          extWs.send(JSON.stringify({ done: true }));
          
          // Save chat history for both new and existing chats
          if (extWs.userId) {
            try {
              console.log(`Updating chat history for user ${extWs.userId} and chat ${chatId}`);
              
              // Get the accumulated assistant response
              let assistantResponse = '';
              for await (const content of chatService.generateResponse(messages, query, modelId)) {
                assistantResponse += content;
              }
              
              // Include both user messages and the complete assistant response
              const allMessages = [...messages];
              // Add the assistant's complete response with the actual accumulated content
              allMessages.push({
                id: messages.length + 1,
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date(),
                sources: [],
                isImageGeneration: isImageGeneration || false
              });
              
              await chatHistoryService.saveChatMessage(
                extWs.userId,
                modelId,
                '',  // collectionName is optional
                allMessages,
                chatId ? chatId.toString() : undefined // Use chatId if provided
              );
              console.log(`Chat history updated for user ${extWs.userId}`);
            } catch (error) {
              console.error('Error updating chat history:', error);
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
    const { messages, modelId, collectionName } = req.body;
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
      processedMessages
    );
    res.json(history);
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

router.get('/history', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const { folder, search } = req.query;
    
    let history;
    if (search) {
      history = await chatHistoryService.searchChatHistory(userId, search as string);
    } else {
      history = await chatHistoryService.getChatHistory(userId, folder as string);
    }
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// Get specific chat
router.get('/history/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    const chat = await chatHistoryService.getChatById(chatId, userId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json(chat);
  } catch (error) {
    console.error('Error getting specific chat:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Rename chat
router.put('/history/:chatId/rename', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    const { newName } = req.body;
    
    if (!newName) {
      res.status(400).json({ error: 'New name is required' });
      return;
    }
    
    const chat = await chatHistoryService.renameChatHistory(chatId, userId, newName);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json(chat);
  } catch (error) {
    console.error('Error renaming chat:', error);
    res.status(500).json({ error: 'Failed to rename chat' });
  }
});

// Delete specific chat
router.delete('/history/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    
    const result = await chatHistoryService.deleteChatHistory(chatId, userId);
    if (!result) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Update chat folder
router.put('/history/:chatId/folder', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    const { folder } = req.body;
    
    if (!folder) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }
    
    const chat = await chatHistoryService.updateChatFolder(chatId, userId, folder);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat folder:', error);
    res.status(500).json({ error: 'Failed to update chat folder' });
  }
});

// Update chat tags
router.put('/history/:chatId/tags', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    const { tags } = req.body;
    
    if (!Array.isArray(tags)) {
      res.status(400).json({ error: 'Tags must be an array' });
      return;
    }
    
    const chat = await chatHistoryService.updateChatTags(chatId, userId, tags);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat tags:', error);
    res.status(500).json({ error: 'Failed to update chat tags' });
  }
});

// Toggle pin chat
router.put('/history/:chatId/toggle-pin', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    
    const chat = await chatHistoryService.togglePinChat(chatId, userId);
    res.json(chat);
  } catch (error) {
    console.error('Error toggling chat pin:', error);
    res.status(500).json({ error: 'Failed to toggle chat pin' });
  }
});

// Export chat
router.get('/history/:chatId/export', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const { chatId } = req.params;
    
    const exportData = await chatHistoryService.exportChatHistory(userId, chatId);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting chat:', error);
    res.status(500).json({ error: 'Failed to export chat' });
  }
});

// Import chat
router.post('/history/import', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatData = req.body;
    
    const importedChat = await chatHistoryService.importChatHistory(userId, chatData);
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

    const result = await chatHistoryService.clearChatHistory(user.username);
    res.json(result);
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

export default router;