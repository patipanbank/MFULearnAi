import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CollectionDocument = Collection & Document;

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DEPARTMENT = 'DEPARTMENT',
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Collection {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ 
    type: String, 
    enum: CollectionPermission,
    default: CollectionPermission.PRIVATE 
  })
  permission: CollectionPermission;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true })
  department: string;

  @Prop({ default: null })
  modelId?: string;

  @Prop({ default: 0 })
  documentCount: number;

  @Prop({ default: 0 })
  size: number;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);

// Create indexes for better performance
CollectionSchema.index({ permission: 1 });
CollectionSchema.index({ createdBy: 1 });
CollectionSchema.index({ createdAt: -1 });
CollectionSchema.index({ isActive: 1 });
CollectionSchema.index({ createdBy: 1, permission: 1 }); 