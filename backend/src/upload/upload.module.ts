import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { WebScraperService } from './web-scraper.service';

@Module({
  controllers: [],
  providers: [
    DocumentService,
    WebScraperService,
  ],
  exports: [
    DocumentService,
    WebScraperService,
  ],
})
export class UploadModule {} 