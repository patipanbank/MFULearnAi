import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum TrainingAction {
  UPLOAD = 'upload',
  DELETE = 'delete',
  CREATE_COLLECTION = 'create_collection',
  UPDATE_COLLECTION = 'update_collection',
  DELETE_COLLECTION = 'delete_collection',
}

export type TrainingHistoryDocument = TrainingHistory & Document;

@Schema({
  timestamps: true,
  collection: 'training_history',
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
export class TrainingHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  collectionName: string;

  @Prop()
  documentName?: string;

  @Prop({ required: true, enum: TrainingAction })
  action: TrainingAction;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ type: Object })
  details?: Record<string, any>;
}

export const TrainingHistorySchema = SchemaFactory.createForClass(TrainingHistory);

// Add indexes
TrainingHistorySchema.index({ userId: 1, timestamp: -1 });
TrainingHistorySchema.index({ collectionName: 1, timestamp: -1 });
TrainingHistorySchema.index({ action: 1, timestamp: -1 }); 