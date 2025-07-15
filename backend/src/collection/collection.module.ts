import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { Collection, CollectionSchema } from '../models/collection.model';
import { User, UserSchema } from '../models/user.model';
import { ChromaService } from '../services/chroma.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService, ChromaService],
  exports: [CollectionService],
})
export class CollectionModule {} 