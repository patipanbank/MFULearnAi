import { Module, Global, Logger } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { RequestLoggingInterceptor } from '../../common/request-logging.interceptor';
import { GlobalErrorFilter } from '../../common/global-error.filter';

@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalErrorFilter,
    },
  ],
  exports: [],
})
export class SecurityModule {
  private readonly logger = new Logger(SecurityModule.name);

  constructor() {
    this.logger.log('🔒 Security Module initialized');
  }
} 