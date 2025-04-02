import { WebSocket } from 'ws';
import { usageService } from './usageService';
import { chatPersistenceService } from './chatPersistenceService';
import { ragService, Source, ContextResult } from './ragService';
import { bedrockInteractionService } from './bedrockInteractionService';
import { chatConfig } from '../config/chatConfig';
import { ChatMessage } from '../types/chat'; // Assuming this defines the core message structure

// Type for the structure expected by the WebSocket handler
// This defines the complete payload received over WS
interface WebSocketInputMessage {
  messages: ChatMessage[]; // Array of message history + new message
  chatId?: string;
  modelId?: string;
  // Add other fields sent from client if necessary
  isImageGeneration?: boolean; // Keep if sent directly
  path?: string; 
  type?: string; // e.g., 'message', 'regenerate'
  // Removed extends ChatMessage
}

// Type for WebSocket communication
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  chatId?: string;
}

class ChatService {

  // Core method called by WebSocket handler
  async processMessage(ws: ExtendedWebSocket, data: WebSocketInputMessage): Promise<void> {
    const userId = ws.userId;
    if (!userId) {
      console.error('WebSocket connection missing userId.');
      ws.send(JSON.stringify({ type: 'error', error: 'Authentication error.' }));
      return;
    }

    const { messages, modelId, chatId, isImageGeneration, path } = data;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format.' }));
        return;
    }
    
    if (!modelId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing modelId.' }));
        return;
    }

    // --- Usage Check ---
    const hasRemaining = await usageService.checkUserLimit(userId);
    if (!hasRemaining) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'You have used all your quota for today. Please wait until tomorrow.'
      }));
      return;
    }
    
    let currentChatId = chatId;
    let currentMessages: ChatMessage[] = messages; // Use input messages as the base history

    try {
        // --- Chat Persistence (Create or Load) ---
        if (!currentChatId) {
            // Create a new chat
            // Map input messages to the format expected by persistence service
             const initialMessages: any[] = messages.map(m => ({ 
                role: m.role,
                content: m.content,
                images: m.images,
                files: m.files,
                isImageGeneration: m.isImageGeneration,
                // Persistence service expects plain objects, not Mongoose docs here
            }));

            const savedChat = await chatPersistenceService.saveChat(userId, modelId, initialMessages);
            currentChatId = savedChat._id.toString();
            // Update currentMessages if needed, but input `messages` should reflect latest state
            currentMessages = savedChat.messages as ChatMessage[]; // Use messages from saved chat
            ws.chatId = currentChatId; // Associate chatId with WS connection
            ws.send(JSON.stringify({ type: 'chat_created', chatId: currentChatId }));
        } else {
             // Ensure the chat exists and user has access (optional, depends on trust model)
             const existingChat = await chatPersistenceService.getChat(currentChatId, userId);
             if (!existingChat) {
                 ws.send(JSON.stringify({ type: 'error', error: 'Chat not found or access denied.' }));
                 return;
             }
             // Use the input `messages` array, assuming it contains the full relevant history for this turn
        }
        
        // --- RAG Context Retrieval ---
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;
        // Handle potential images/files in the last message for RAG
        const imageBase64 = lastMessage.images?.[0]?.data; 
        // TODO: Add file content extraction/processing if needed for RAG context
        // const fileContentContext = await processFilesForRAG(lastMessage.files);
        
        // Use modelId for collection lookup in ragService
        const { contextString, sources, promptTemplate } = await ragService.getContext(userQuery, modelId, imageBase64);

        // --- AI Response Generation ---
        const systemPromptContent = await chatPersistenceService.getSystemPrompt() || chatConfig.DEFAULT_SYSTEM_PROMPT;

        let fullResponse = '';
        // Placeholder for token count - Bedrock might provide this in the stream later
        let inputTokens = 0; 
        let outputTokens = 0; 

        const stream = bedrockInteractionService.generateAiStream(
            currentMessages, 
            systemPromptContent, 
            contextString, 
            sources
        );

        for await (const chunk of stream) {
            try {
                const parsedChunk = JSON.parse(chunk);
                if (parsedChunk.type === 'error') {
                    console.error('Error chunk received from AI stream:', parsedChunk.error);
                     if (ws.readyState === WebSocket.OPEN) {
                         ws.send(JSON.stringify(parsedChunk));
                     }
                    // Stop processing on error chunk
                    return; 
                } else if (parsedChunk.type === 'content_block_delta') {
                    const textChunk = parsedChunk.delta?.text || '';
                    fullResponse += textChunk;
                     if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'chunk', chatId: currentChatId, content: textChunk }));
                     }
                } else if (parsedChunk.type === 'message_delta') {
                    // Potentially get usage delta from here if Bedrock provides it
                    outputTokens += parsedChunk.usage?.output_tokens || 0;
                } else if (parsedChunk.type === 'message_start') {
                    // Potentially get input tokens from here
                    inputTokens = parsedChunk.message?.usage?.input_tokens || 0;
                }
            } catch(parseError) {
                // Assume raw text chunk if JSON parsing fails
                fullResponse += chunk;
                 if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'chunk', chatId: currentChatId, content: chunk }));
                 }
            }
        }

        // --- Post-Response Processing ---
        if (fullResponse && currentChatId) {
             if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'completed', chatId: currentChatId, sources: sources }));
             }

            // Save assistant message
            const assistantMessage: any = { // Use 'any' or define a specific Input type
                role: 'assistant',
                content: fullResponse,
                sources: sources, // Save sources with the message
                isComplete: true
            };
            await chatPersistenceService.addMessageToChat(currentChatId, assistantMessage);

            // --- Update Usage Stats ---
            // Estimate tokens if not provided by Bedrock stream
            // Simple estimation: 1 token ~= 4 chars (very rough)
            const estimatedInputTokens = inputTokens || Math.ceil((systemPromptContent + messages.map(m => m.content || '').join('') + contextString).length / 4);
            const estimatedOutputTokens = outputTokens || Math.ceil(fullResponse.length / 4);
            const totalTokens = estimatedInputTokens + estimatedOutputTokens;
            
            console.log(`[Usage Estimation] Input: ${estimatedInputTokens}, Output: ${estimatedOutputTokens}, Total: ${totalTokens}`);
            // Call the correct usage service method with estimated total tokens
            await usageService.updateTokenUsage(userId, totalTokens); 
        } else {
            console.warn(`No full response generated or chat ID missing for chat ${currentChatId}`);
             if (ws.readyState === WebSocket.OPEN && !fullResponse) {
                 ws.send(JSON.stringify({ type: 'error', chatId: currentChatId, error: 'AI failed to generate a response.' }));
             }
        }

    } catch (error: any) {
        console.error(`Error processing message for chat ${currentChatId || '(new)'}:`, error);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                chatId: currentChatId,
                error: `An internal error occurred: ${error.message || 'Unknown error'}`
             }));
        }
    }
  }

  // --- Other Chat Operations (Delegate to Persistence Service) ---

  async getChats(userId: string, page: number, limit: number) {
    // Directly delegate
    return chatPersistenceService.getChats(userId, page, limit);
  }

  async getChatById(chatId: string, userId: string) {
    // Directly delegate
    return chatPersistenceService.getChat(chatId, userId);
  }

  // Note: saveChat is primarily handled within processMessage for new chats
  // This might be used by a direct HTTP POST to create chat with first message
  async saveInitialChat(userId: string, modelId: string, messages: ChatMessage[], title?: string) {
    // Map input messages to the format expected by persistence service
    const initialMessages: any[] = messages.map(m => ({ 
        role: m.role,
        content: m.content,
        images: m.images,
        files: m.files,
        isImageGeneration: m.isImageGeneration,
    }));
    return chatPersistenceService.saveChat(userId, modelId, initialMessages, title);
  }
  
  async addMessage(chatId: string, message: ChatMessage) {
      // This could be for user messages added via HTTP PUT/POST
      // Map input message to the format expected by persistence service
      const messageInput: any = { 
        role: message.role,
        content: message.content,
        images: message.images,
        files: message.files,
        isImageGeneration: message.isImageGeneration,
      };
      return chatPersistenceService.addMessageToChat(chatId, messageInput);
  }

  async updateChat(chatId: string, userId: string, updateData: any) {
    // Validate and prepare update data before delegating
    const validUpdateData: Partial<Pick<any, 'chatname' | 'modelId' | 'isPinned'>> = {};
    if (updateData.chatname !== undefined) validUpdateData.chatname = updateData.chatname;
    if (updateData.modelId !== undefined) validUpdateData.modelId = updateData.modelId;
    if (updateData.isPinned !== undefined) validUpdateData.isPinned = updateData.isPinned;
    
    // Only call update if there's something valid to update
    if (Object.keys(validUpdateData).length > 0) {
        return chatPersistenceService.updateChat(chatId, userId, validUpdateData);
    } else {
        // Optionally return the existing chat or null/error if no valid fields
        return chatPersistenceService.getChat(chatId, userId); 
    }
  }

  async deleteChat(chatId: string, userId: string) {
    // Directly delegate
    return chatPersistenceService.deleteChat(chatId, userId);
  }
  
  async editMessage(chatId: string, userId: string, messageId: string, newContent: string) {
      // Directly delegate
      return chatPersistenceService.editMessage(chatId, userId, messageId, newContent);
  }
  
  async recordFeedback(chatId: string, userId: string, messageId: string, feedback: 'like' | 'dislike') {
      // Directly delegate
      return chatPersistenceService.recordFeedback(chatId, userId, messageId, feedback);
  }

  async togglePinChat(chatId: string, userId: string) {
    // Directly delegate
    return chatPersistenceService.togglePinChat(chatId, userId);
  }

  // TODO: Refactor regenerateResponse to handle WS context properly
  async regenerateResponse(chatId: string, userId: string): Promise<{ fullResponse: string, sources: Source[] } | null> {
      const chat = await chatPersistenceService.getChat(chatId, userId);
      if (!chat || chat.messages.length < 1) {
          console.error(`Regen failed: Chat ${chatId} not found or empty for user ${userId}.`);
          return null; // Or throw?
      }

      let lastUserMessageIndex = -1;
      for(let i = chat.messages.length - 1; i >= 0; i--) {
          if (chat.messages[i].role === 'user') {
              lastUserMessageIndex = i;
              break;
          }
      }

      if (lastUserMessageIndex === -1) {
           console.error(`Regen failed: No user message found in chat ${chatId}.`);
           return null; // Or throw?
      }
      
      const historyForRegeneration = chat.messages.slice(0, lastUserMessageIndex + 1) as ChatMessage[];
      const lastUserMessage = historyForRegeneration[historyForRegeneration.length - 1];
      
      try {
          // --- RAG ---
          const { contextString, sources, promptTemplate } = await ragService.getContext(
              lastUserMessage.content || '', // Ensure content is string
              chat.modelId, 
              lastUserMessage.images?.[0]?.data
          );
          
          // --- AI Response ---
          const systemPromptContent = await chatPersistenceService.getSystemPrompt() || chatConfig.DEFAULT_SYSTEM_PROMPT;
          const stream = bedrockInteractionService.generateAiStream(
              historyForRegeneration, 
              systemPromptContent, 
              contextString, 
              sources
          );
           
          let fullResponse = '';
          let outputTokens = 0;
          for await (const chunk of stream) {
              try {
                  const parsedChunk = JSON.parse(chunk);
                  if (parsedChunk.type === 'error') {
                      console.error('AI stream error during regeneration:', parsedChunk.error);
                      throw new Error(parsedChunk.error || 'AI stream error during regeneration');
                  } else if (parsedChunk.type === 'content_block_delta') {
                      fullResponse += parsedChunk.delta?.text || '';
                  } else if (parsedChunk.type === 'message_delta') {
                      outputTokens += parsedChunk.usage?.output_tokens || 0;
                  }
              } catch { 
                  fullResponse += chunk; // Assume raw text chunk
              }
          }
           
          if (!fullResponse) {
              throw new Error('AI failed to generate a regenerated response.');
          }
           
          // --- Persistence (Replace last assistant message or add new one) ---
          let messageToReplaceIndex = -1;
          if (lastUserMessageIndex < chat.messages.length - 1 && chat.messages[lastUserMessageIndex + 1].role === 'assistant') {
              messageToReplaceIndex = lastUserMessageIndex + 1;
          }
           
          const newAssistantMessage: any = {
              role: 'assistant',
              content: fullResponse,
              sources: sources,
              isComplete: true
          };
           
          const updatedChat = await chatPersistenceService.getChat(chatId, userId); // Re-fetch fresh chat
          if (!updatedChat) throw new Error('Chat disappeared during regeneration');

          if (messageToReplaceIndex !== -1) {
              // Overwrite the existing assistant message
              updatedChat.messages[messageToReplaceIndex] = newAssistantMessage;
              updatedChat.markModified('messages');
          } else {
              // Add the new assistant message
              updatedChat.messages.push(newAssistantMessage);
          }
          updatedChat.updatedAt = new Date();
          await updatedChat.save();
           
          // --- Update Usage --- (Estimate tokens for now)
          const estimatedOutputTokens = outputTokens || Math.ceil(fullResponse.length / 4);
          // TODO: Estimate input tokens more accurately if needed
          await usageService.updateTokenUsage(userId, estimatedOutputTokens); 
          
          console.log(`Regeneration successful for chat ${chatId}`);
          return { fullResponse, sources };

      } catch (error: any) {
            console.error(`Error during regeneration for chat ${chatId}:`, error);
            // Depending on how this is called, might need to throw or return error indicator
            return null; 
      }
  }

  // --- Admin Operations (Delegate to Persistence Service) ---

  async getAllChatsAdmin(page: number, limit: number) {
    return chatPersistenceService.getAllChatsAdmin(page, limit);
  }

  async getChatByIdAdmin(chatId: string) {
    return chatPersistenceService.getChatByIdAdmin(chatId);
  }

  async deleteChatAdmin(chatId: string) {
    return chatPersistenceService.deleteChatAdmin(chatId);
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

