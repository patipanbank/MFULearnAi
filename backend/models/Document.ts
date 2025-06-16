import { Document, Schema, model } from 'mongoose';

export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface IDocument {
  name: string;
  collectionId: Schema.Types.ObjectId;
  summary: string;
  status: DocumentStatus;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DocumentDocument = IDocument & Document;

const documentSchema = new Schema<DocumentDocument>({
  name: { type: String, required: true },
  collectionId: { type: Schema.Types.ObjectId, ref: 'Collection', required: true },
  summary: { type: String, default: '' },
  status: { type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.PENDING },
  createdBy: { type: String, required: true },
}, { timestamps: true });

export const DocumentModel = model<DocumentDocument>('Document', documentSchema); 