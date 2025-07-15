import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../models/user.model';
import { Collection, CollectionSchema } from '../models/collection.model';
import { Department, DepartmentSchema } from '../models/department.model';
import { Chat, ChatSchema } from '../models/chat.model';
import { Agent, AgentSchema } from '../models/agent.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {} 