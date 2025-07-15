import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { TrainingHistorySchema } from '../models/training-history.model';

@Module({
  imports: [
    ConfigModule, // Import ConfigModule to make ConfigService available
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.mongoUri,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
    // Register models
    MongooseModule.forFeature([
      { name: 'TrainingHistory', schema: TrainingHistorySchema },
    ]),
  ],
  exports: [MongooseModule], // Export MongooseModule to make models available in other modules
})
export class DatabaseModule {} 