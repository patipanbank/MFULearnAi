import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemPromptDocument = SystemPrompt & Document;

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
export class SystemPrompt {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  updated: Date;
}

export const SystemPromptSchema = SchemaFactory.createForClass(SystemPrompt);

// Add indexes
SystemPromptSchema.index({ name: 1 });
SystemPromptSchema.index({ isDefault: 1 });
SystemPromptSchema.index({ isActive: 1 });

// Pre-save middleware to update the updated field
SystemPromptSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Pre-update middleware to update the updated field
SystemPromptSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated: new Date() });
  next();
}); 