import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [UploadController],
})
export class UploadModule {} 