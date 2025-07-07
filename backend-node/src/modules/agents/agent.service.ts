import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentDocument } from './agent.schema';

@Injectable()
export class AgentService {
  constructor(@InjectModel('Agent') private readonly agentModel: Model<AgentDocument>) {}

  findAll() {
    return this.agentModel.find();
  }

  findOne(id: string) {
    return this.agentModel.findById(id);
  }

  create(data: Partial<AgentDocument>) {
    return this.agentModel.create(data);
  }

  update(id: string, data: Partial<AgentDocument>) {
    return this.agentModel.findByIdAndUpdate(id, data, { new: true });
  }

  delete(id: string) {
    return this.agentModel.findByIdAndDelete(id);
  }
} 