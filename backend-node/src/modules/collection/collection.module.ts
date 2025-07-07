import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionSchema } from './collection.schema';
import { DocumentManagementService } from '../../services/document-management.service';
import { DocumentService } from '../../services/document.service';
import { ChromaService } from '../../services/chroma.service';
import { BedrockModule } from '../../infrastructure/bedrock/bedrock.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Collection', schema: CollectionSchema }]),
    BedrockModule,
  ],
  controllers: [CollectionController],
  providers: [
    CollectionService,
    DocumentManagementService,
    DocumentService,
    ChromaService,
  ],
  exports: [CollectionService, DocumentManagementService],
})
export class CollectionModule {} 