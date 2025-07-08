import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentExecutionDocument, AgentExecutionStatus } from './agent-execution.schema';

@Injectable()
export class AgentExecutionService {
  constructor(
    @InjectModel('AgentExecution') private readonly model: Model<AgentExecutionDocument>,
  ) {}

  createExecution(agentId: string, sessionId: string) {
    return this.model.create({ agentId, sessionId, status: AgentExecutionStatus.IDLE });
  }

  updateStatus(id: string, status: AgentExecutionStatus, extra: Partial<AgentExecutionDocument> = {}) {
    return this.model.findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true });
  }

  finish(id: string, tokenUsage: { input: number; output: number }) {
    return this.model.findByIdAndUpdate(
      id,
      { $set: { status: AgentExecutionStatus.RESPONDING, endTime: new Date(), tokenUsage } },
      { new: true },
    );
  }

  findBySession(sessionId: string) {
    return this.model.find({ sessionId });
  }
} 