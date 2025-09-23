/**
 * ConversationMessage Model
 *
 * MongoDB model สำหรับข้อความในระบบ conversation ใหม่
 * ออกแบบให้รองรับ streaming, tool calls และ attachments
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  ConversationMessage as IConversationMessage,
  MessageRole,
  MessageStatus,
  MessageMetadata,
  MessageAttachment,
  ToolCall,
  TokenUsage,
  ErrorDetails
} from '../types';

// ============= SCHEMA DEFINITIONS =============

const TokenUsageSchema = new Schema<TokenUsage>({
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 }
}, { _id: false });

const ErrorDetailsSchema = new Schema<ErrorDetails>({
  code: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  stack: { type: String },
  timestamp: { type: Date, default: Date.now },
  retryable: { type: Boolean, default: false }
}, { _id: false });

const MessageMetadataSchema = new Schema<MessageMetadata>({
  userId: { type: String, required: true },
  agentId: { type: String },
  modelId: { type: String },
  tokenUsage: { type: TokenUsageSchema },
  processingTime: { type: Number },
  retryCount: { type: Number, default: 0 },
  errorDetails: { type: ErrorDetailsSchema },
  sourceNode: { type: String }
}, { _id: false });

const MessageAttachmentSchema = new Schema<MessageAttachment>({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['image', 'document', 'audio', 'video'],
    required: true
  },
  url: { type: String, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed }
}, { _id: false });

const ToolCallSchema = new Schema<ToolCall>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  input: { type: Schema.Types.Mixed, required: true },
  output: { type: Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  error: { type: String }
}, { _id: false });

// ============= MAIN SCHEMA =============

const ConversationMessageSchema = new Schema<IConversationMessage & Document>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: Object.values(MessageRole),
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 100000 // 100KB max content
  },
  status: {
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.PENDING,
    index: true
  },
  metadata: {
    type: MessageMetadataSchema,
    required: true
  },
  attachments: [MessageAttachmentSchema],
  toolCalls: [ToolCallSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'conversation_messages'
});

// ============= INDEXES =============

// Compound indexes for efficient queries
ConversationMessageSchema.index({ conversationId: 1, createdAt: 1 });
ConversationMessageSchema.index({ conversationId: 1, role: 1 });
ConversationMessageSchema.index({ 'metadata.userId': 1, createdAt: -1 });
ConversationMessageSchema.index({ status: 1, createdAt: -1 });

// Text search index for content
ConversationMessageSchema.index({ content: 'text' });

// TTL index for temporary/failed messages
ConversationMessageSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { status: MessageStatus.FAILED }
  }
);

// ============= VIRTUAL FIELDS =============

ConversationMessageSchema.virtual('isCompleted').get(function() {
  return this.status === MessageStatus.COMPLETED;
});

ConversationMessageSchema.virtual('isStreaming').get(function() {
  return this.status === MessageStatus.STREAMING;
});

ConversationMessageSchema.virtual('hasAttachments').get(function() {
  return this.attachments && this.attachments.length > 0;
});

ConversationMessageSchema.virtual('hasToolCalls').get(function() {
  return this.toolCalls && this.toolCalls.length > 0;
});

ConversationMessageSchema.virtual('processingTimeMs').get(function() {
  return this.metadata.processingTime ? Math.round(this.metadata.processingTime) : 0;
});

// ============= INSTANCE METHODS =============

ConversationMessageSchema.methods.updateStatus = function(status: MessageStatus, error?: ErrorDetails) {
  this.status = status;
  this.updatedAt = new Date();

  if (error) {
    this.metadata.errorDetails = error;
  }

  if (status === MessageStatus.COMPLETED && this.metadata.processingTime === undefined) {
    this.metadata.processingTime = Date.now() - this.createdAt.getTime();
  }
};

ConversationMessageSchema.methods.addToolCall = function(toolCall: Omit<ToolCall, 'id'>) {
  const newToolCall: ToolCall = {
    id: new mongoose.Types.ObjectId().toString(),
    ...toolCall
  };

  if (!this.toolCalls) {
    this.toolCalls = [];
  }

  this.toolCalls.push(newToolCall);
  this.updatedAt = new Date();

  return newToolCall.id;
};

ConversationMessageSchema.methods.updateToolCall = function(
  toolCallId: string,
  updates: Partial<ToolCall>
) {
  if (!this.toolCalls) return false;

  const toolCall = this.toolCalls.find(tc => tc.id === toolCallId);
  if (!toolCall) return false;

  Object.assign(toolCall, updates);
  this.updatedAt = new Date();

  return true;
};

ConversationMessageSchema.methods.addAttachment = function(attachment: MessageAttachment) {
  if (!this.attachments) {
    this.attachments = [];
  }

  this.attachments.push(attachment);
  this.updatedAt = new Date();
};

ConversationMessageSchema.methods.updateTokenUsage = function(tokenUsage: TokenUsage) {
  if (!this.metadata.tokenUsage) {
    this.metadata.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  this.metadata.tokenUsage.promptTokens += tokenUsage.promptTokens;
  this.metadata.tokenUsage.completionTokens += tokenUsage.completionTokens;
  this.metadata.tokenUsage.totalTokens += tokenUsage.totalTokens;
  this.updatedAt = new Date();
};

ConversationMessageSchema.methods.retry = function() {
  this.metadata.retryCount += 1;
  this.status = MessageStatus.PENDING;
  this.metadata.errorDetails = undefined;
  this.updatedAt = new Date();
};

// ============= STATIC METHODS =============

ConversationMessageSchema.statics.findByConversationId = function(
  conversationId: string,
  options: {
    limit?: number;
    skip?: number;
    role?: MessageRole;
    status?: MessageStatus;
    includeToolCalls?: boolean;
  } = {}
) {
  const query: any = { conversationId };

  if (options.role) {
    query.role = options.role;
  }

  if (options.status) {
    query.status = options.status;
  }

  let queryBuilder = this.find(query)
    .sort({ createdAt: 1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);

  if (!options.includeToolCalls) {
    queryBuilder = queryBuilder.select('-toolCalls');
  }

  return queryBuilder;
};

ConversationMessageSchema.statics.findLatestByConversation = function(
  conversationId: string,
  limit: number = 10
) {
  return this.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

ConversationMessageSchema.statics.findStreamingMessages = function() {
  return this.find({ status: MessageStatus.STREAMING })
    .sort({ createdAt: 1 });
};

ConversationMessageSchema.statics.findFailedMessages = function(
  retryable: boolean = true,
  maxRetries: number = 3
) {
  return this.find({
    status: MessageStatus.FAILED,
    'metadata.retryCount': { $lt: maxRetries },
    'metadata.errorDetails.retryable': retryable
  }).sort({ createdAt: 1 });
};

ConversationMessageSchema.statics.getMessageStats = function(conversationId: string) {
  return this.aggregate([
    { $match: { conversationId } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        userMessages: {
          $sum: { $cond: [{ $eq: ['$role', MessageRole.USER] }, 1, 0] }
        },
        assistantMessages: {
          $sum: { $cond: [{ $eq: ['$role', MessageRole.ASSISTANT] }, 1, 0] }
        },
        totalTokens: { $sum: '$metadata.tokenUsage.totalTokens' },
        averageProcessingTime: { $avg: '$metadata.processingTime' },
        failedMessages: {
          $sum: { $cond: [{ $eq: ['$status', MessageStatus.FAILED] }, 1, 0] }
        }
      }
    }
  ]);
};

ConversationMessageSchema.statics.searchContent = function(
  conversationId: string,
  searchQuery: string
) {
  return this.find({
    conversationId,
    $text: { $search: searchQuery }
  }, {
    score: { $meta: 'textScore' }
  }).sort({ score: { $meta: 'textScore' } });
};

// ============= MIDDLEWARE =============

// Pre-save middleware
ConversationMessageSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate ID if not provided
    if (!this.id) {
      this.id = new mongoose.Types.ObjectId().toString();
    }
  }

  // Always update the updatedAt timestamp
  this.updatedAt = new Date();

  next();
});

// Post-save middleware for logging
ConversationMessageSchema.post('save', function(doc) {
  console.log(`💬 Message saved: ${doc.id} (${doc.role}) in conversation ${doc.conversationId}`);
});

// ============= MODEL EXPORT =============

export interface ConversationMessageDocument extends IConversationMessage, Document {
  updateStatus(status: MessageStatus, error?: ErrorDetails): void;
  addToolCall(toolCall: Omit<ToolCall, 'id'>): string;
  updateToolCall(toolCallId: string, updates: Partial<ToolCall>): boolean;
  addAttachment(attachment: MessageAttachment): void;
  updateTokenUsage(tokenUsage: TokenUsage): void;
  retry(): void;
}

export interface ConversationMessageModel extends mongoose.Model<ConversationMessageDocument> {
  findByConversationId(conversationId: string, options?: {
    limit?: number;
    skip?: number;
    role?: MessageRole;
    status?: MessageStatus;
    includeToolCalls?: boolean;
  }): Promise<ConversationMessageDocument[]>;
  findLatestByConversation(conversationId: string, limit?: number): Promise<ConversationMessageDocument[]>;
  findStreamingMessages(): Promise<ConversationMessageDocument[]>;
  findFailedMessages(retryable?: boolean, maxRetries?: number): Promise<ConversationMessageDocument[]>;
  getMessageStats(conversationId: string): Promise<any[]>;
  searchContent(conversationId: string, searchQuery: string): Promise<ConversationMessageDocument[]>;
}

export const ConversationMessageModel = mongoose.model<ConversationMessageDocument, ConversationMessageModel>(
  'ConversationMessage',
  ConversationMessageSchema
);