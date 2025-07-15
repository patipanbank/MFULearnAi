import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('test-redis')
  async testRedis() {
    try {
      // Test Redis operations
      await this.redisService.set('test-key', 'test-value', 60);
      const value = await this.redisService.get('test-key');
      await this.redisService.del('test-key');

      return {
        success: true,
        message: 'Redis operations successful',
        testValue: value,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Redis operations failed',
        error: error.message,
      };
    }
  }
}
