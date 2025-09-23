/**
 * Conversation Model
 *
 * MongoDB model สำหรับระบบ conversation ใหม่
 * ออกแบบให้รองรับ scalability และ performance
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  Conversation as IConversation,
  ConversationStatus,
  ConversationConfiguration,
  ConversationMetadata,
  MemorySettings
} from '../types';

// ============= SCHEMA DEFINITIONS =============

const MemorySettingsSchema = new Schema<MemorySettings>({
  shortTermEnabled: { type: Boolean, default: true },
  longTermEnabled: { type: Boolean, default: true },
  embeddingEnabled: { type: Boolean, default: true },
  maxShortTermMessages: { type: Number, default: 10 },
  embeddingThreshold: { type: Number, default: 10 },
  contextWindow: { type: Number, default: 4000 }
}, { _id: false });

const ConversationConfigurationSchema = new Schema<ConversationConfiguration>({
  temperature: { type: Number, default: 0.7, min: 0, max: 2 },
  maxTokens: { type: Number, default: 4000, min: 1, max: 200000 },
  collectionNames: [{ type: String }],
  enabledTools: [{ type: String }],
  memorySettings: { type: MemorySettingsSchema, default: () => ({}) },
  streamingEnabled: { type: Boolean, default: true },
  autoSave: { type: Boolean, default: true },
  timeoutMs: { type: Number, default: 60000 }
}, { _id: false });

const ConversationMetadataSchema = new Schema<ConversationMetadata>({
  messageCount: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  lastError: {
    code: String,
    message: String,
    details: Schema.Types.Mixed,
    timestamp: Date,
    retryable: Boolean
  },
  tags: [{ type: String }],
  isPinned: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false }
}, { _id: false });

// ============= MAIN SCHEMA =============

const ConversationSchema = new Schema<IConversation & Document>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  status: {
    type: String,
    enum: Object.values(ConversationStatus),
    default: ConversationStatus.ACTIVE,
    index: true
  },
  agentId: {
    type: String,
    index: true
  },
  modelId: {
    type: String,
    required: true,
    default: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  },
  systemPrompt: {
    type: String,
    maxlength: 10000
  },
  configuration: {
    type: ConversationConfigurationSchema,
    default: () => ({})
  },
  metadata: {
    type: ConversationMetadataSchema,
    default: () => ({})
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastMessageAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

// ============= INDEXES =============

// Compound indexes for efficient queries
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index({ userId: 1, status: 1 });
ConversationSchema.index({ userId: 1, 'metadata.isPinned': 1 });
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ status: 1, updatedAt: -1 });

// Text search index
ConversationSchema.index({
  title: 'text',
  systemPrompt: 'text',
  'metadata.tags': 'text'
});

// TTL index for archived conversations (optional)
ConversationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 365 * 24 * 60 * 60, // 1 year
    partialFilterExpression: { 'metadata.isArchived': true }
  }
);

// ============= VIRTUAL FIELDS =============

ConversationSchema.virtual('isActive').get(function() {
  return this.status === ConversationStatus.ACTIVE;
});

ConversationSchema.virtual('hasMessages').get(function() {
  return this.metadata.messageCount > 0;
});

ConversationSchema.virtual('responseTimeMs').get(function() {
  return Math.round(this.metadata.averageResponseTime);
});

// ============= INSTANCE METHODS =============

ConversationSchema.methods.updateStats = function(stats: {
  messageCount?: number;
  tokenUsage?: number;
  responseTime?: number;
  errorOccurred?: boolean;
}) {
  if (stats.messageCount !== undefined) {
    this.metadata.messageCount = stats.messageCount;
  }

  if (stats.tokenUsage !== undefined) {
    this.metadata.totalTokens += stats.tokenUsage;
  }

  if (stats.responseTime !== undefined) {
    // Calculate rolling average
    const currentAvg = this.metadata.averageResponseTime || 0;
    const messageCount = this.metadata.messageCount || 1;
    this.metadata.averageResponseTime =
      (currentAvg * (messageCount - 1) + stats.responseTime) / messageCount;
  }

  if (stats.errorOccurred) {
    this.metadata.errorCount += 1;
  }

  this.updatedAt = new Date();
  this.lastMessageAt = new Date();
};

ConversationSchema.methods.setError = function(error: {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
}) {
  this.metadata.lastError = {
    code: error.code,
    message: error.message,
    details: error.details,
    timestamp: new Date(),
    retryable: error.retryable || false
  };
  this.metadata.errorCount += 1;
  this.updatedAt = new Date();
};

ConversationSchema.methods.clearError = function() {
  this.metadata.lastError = undefined;
  this.updatedAt = new Date();
};

ConversationSchema.methods.archive = function() {
  this.status = ConversationStatus.ARCHIVED;
  this.metadata.isArchived = true;
  this.updatedAt = new Date();
};

ConversationSchema.methods.pin = function() {
  this.metadata.isPinned = true;
  this.updatedAt = new Date();
};

ConversationSchema.methods.unpin = function() {
  this.metadata.isPinned = false;
  this.updatedAt = new Date();
};

// ============= STATIC METHODS =============

ConversationSchema.statics.findByUserId = function(userId: string, options: {
  status?: ConversationStatus;
  isPinned?: boolean;
  limit?: number;
  skip?: number;
} = {}) {
  const query: any = { userId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.isPinned !== undefined) {
    query['metadata.isPinned'] = options.isPinned;
  }

  return this.find(query)
    .sort({ 'metadata.isPinned': -1, lastMessageAt: -1, createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

ConversationSchema.statics.findActiveByUser = function(userId: string) {
  return this.find({
    userId,
    status: ConversationStatus.ACTIVE,
    'metadata.isArchived': { $ne: true }
  }).sort({ lastMessageAt: -1 });
};

ConversationSchema.statics.searchConversations = function(userId: string, searchQuery: string) {
  return this.find({
    userId,
    $text: { $search: searchQuery }
  }, {
    score: { $meta: 'textScore' }
  }).sort({ score: { $meta: 'textScore' } });
};

ConversationSchema.statics.getStatsByUser = function(userId: string) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        activeConversations: {
          $sum: { $cond: [{ $eq: ['$status', ConversationStatus.ACTIVE] }, 1, 0] }
        },
        totalMessages: { $sum: '$metadata.messageCount' },
        totalTokens: { $sum: '$metadata.totalTokens' },
        averageResponseTime: { $avg: '$metadata.averageResponseTime' }
      }
    }
  ]);
};

// ============= MIDDLEWARE =============

// Pre-save middleware
ConversationSchema.pre('save', function(next) {
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
ConversationSchema.post('save', function(doc) {
  console.log(`💾 Conversation saved: ${doc.id} (${doc.title})`);
});

// ============= MODEL EXPORT =============

export interface ConversationDocument extends Document {
  updateStats(stats: {
    messageCount?: number;
    tokenUsage?: number;
    responseTime?: number;
    errorOccurred?: boolean;
  }): void;
  setError(error: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  }): void;
  clearError(): void;
  archive(): void;
  pin(): void;
  unpin(): void;
}

export interface ConversationModel extends mongoose.Model<ConversationDocument> {
  findByUserId(userId: string, options?: {
    status?: ConversationStatus;
    isPinned?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<ConversationDocument[]>;
  findActiveByUser(userId: string): Promise<ConversationDocument[]>;
  searchConversations(userId: string, searchQuery: string): Promise<ConversationDocument[]>;
  getStatsByUser(userId: string): Promise<any[]>;
}

export const ConversationModel = mongoose.model<ConversationDocument, ConversationModel>(
  'Conversation',
  ConversationSchema
);