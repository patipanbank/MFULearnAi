import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { User, UserSchema } from '../models/user.model';
import { Chat, ChatSchema } from '../models/chat.model';
import { Agent, AgentSchema } from '../models/agent.model';
import { Collection, CollectionSchema } from '../models/collection.model';
import { Department, DepartmentSchema } from '../models/department.model';
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
    // Register all models in one place to avoid duplicate schema registrations
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: 'TrainingHistory', schema: TrainingHistorySchema },
    ]),
  ],
  exports: [MongooseModule], // Export MongooseModule to make models available in other modules
})
export class DatabaseModule {} 