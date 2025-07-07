import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentSchema } from './agent.schema';
import { AgentExecutionSchema } from './agent-execution.schema';
import { AgentExecutionService } from './agent-execution.service';
import { ToolService } from './tool.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { StreamingAgentOrchestratorService } from './streaming-agent-orchestrator.service';
import { BedrockModule } from '../../infrastructure/bedrock/bedrock.module';
import { StreamingService } from '../../services/streaming.service';
import { ChromaService } from '../../services/chroma.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Agent', schema: AgentSchema },
      { name: 'AgentExecution', schema: AgentExecutionSchema },
    ]),
    BedrockModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService, 
    AgentExecutionService,
    ToolService,
    AgentOrchestratorService,
    StreamingAgentOrchestratorService,
    StreamingService,
    ChromaService,
  ],
  exports: [
    AgentService, 
    AgentExecutionService,
    ToolService,
    AgentOrchestratorService,
    StreamingAgentOrchestratorService,
    StreamingService,
  ],
})
export class AgentModule {} 