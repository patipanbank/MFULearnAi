import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class ChatMessage {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role: 'user' | 'assistant' | 'system';

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: false })
  isStreaming: boolean;

  @Prop({ default: false })
  isComplete: boolean;

  @Prop({ type: Object })
  metadata?: any;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Chat {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  id?: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  name?: string;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[];

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  agentId?: Types.ObjectId;

  @Prop()
  modelId?: string;

  @Prop({ type: [String], default: [] })
  collectionNames?: string[];

  @Prop()
  systemPrompt?: string;

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  updated: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ type: Object })
  metadata?: any;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Add indexes
ChatSchema.index({ userId: 1 });
ChatSchema.index({ agentId: 1 });
ChatSchema.index({ created: -1 });
ChatSchema.index({ updated: -1 });
ChatSchema.index({ isActive: 1 });
ChatSchema.index({ isPinned: 1 });
ChatSchema.index({ userId: 1, isPinned: 1 });

// Pre-save middleware to update the updated field
ChatSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Pre-update middleware to update the updated field
ChatSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated: new Date() });
  next();
}); 