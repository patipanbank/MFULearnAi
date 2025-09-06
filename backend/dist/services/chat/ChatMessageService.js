"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatMessageService = exports.ChatMessageService = void 0;
const chat_1 = require("../../models/chat");
const storageService_1 = require("../storageService");
class ChatMessageService {
    constructor() {
        console.log('✅ Chat message service initialized');
    }
    async addMessage(chatId, message) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        const newMessage = {
            id: Math.random().toString(36).substr(2, 9),
            ...message,
            timestamp: new Date()
        };
        chat.messages.push(newMessage);
        chat.updatedAt = new Date();
        await chat.save();
        console.log(`✅ Added message to session ${chatId}`);
        return newMessage;
    }
    async updateMessage(chatId, messageId, updates) {
        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
            $set: Object.fromEntries(Object.entries(updates).map(([key, value]) => [`messages.$.${key}`, value]))
        });
    }
    async getChatMessages(chatId) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        return chat.messages;
    }
    async prepareImagesForMultimodal(images) {
        if (!images || images.length === 0) {
            return [];
        }
        const preparedImages = [];
        for (const image of images) {
            try {
                console.log(`🖼️ Preparing image for multimodal: ${image.url.substring(0, 50)}...`);
                const base64Data = await storageService_1.storageService.getFileAsBase64(image.url);
                if (base64Data) {
                    preparedImages.push({
                        ...image,
                        base64Data: base64Data.data
                    });
                    console.log(`✅ Image prepared successfully: ${base64Data.mediaType}, size: ${Math.round(base64Data.data.length / 1024)}KB`);
                }
                else {
                    console.warn(`⚠️ Failed to prepare image: ${image.url}`);
                    preparedImages.push(image);
                }
            }
            catch (error) {
                console.error(`❌ Error preparing image ${image.url}:`, error);
                preparedImages.push(image);
            }
        }
        return preparedImages;
    }
    enrichMessagesWithImages(messages) {
        return messages.map(msg => {
            let enrichedContent = msg.content;
            if (msg.role === 'user' && Array.isArray(msg.images) && msg.images.length > 0) {
                const imagesDesc = msg.images
                    .map((im, idx) => `#${idx + 1} (${im.mediaType}): ${im.url}`)
                    .join('\n');
                enrichedContent = `${enrichedContent}\n\n[Attached images]\n${imagesDesc}`;
            }
            return {
                role: msg.role,
                content: enrichedContent,
                id: msg.id,
                timestamp: msg.timestamp
            };
        });
    }
}
exports.ChatMessageService = ChatMessageService;
exports.chatMessageService = new ChatMessageService();
//# sourceMappingURL=ChatMessageService.js.map