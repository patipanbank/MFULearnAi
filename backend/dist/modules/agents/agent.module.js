"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentModule = void 0;
const common_1 = require("@nestjs/common");
const agent_controller_1 = require("./agent.controller");
const agent_service_1 = require("./agent.service");
const mongoose_1 = require("@nestjs/mongoose");
const agent_schema_1 = require("./agent.schema");
const agent_execution_schema_1 = require("./agent-execution.schema");
const agent_execution_service_1 = require("./agent-execution.service");
const tool_service_1 = require("./tool.service");
const agent_orchestrator_service_1 = require("./agent-orchestrator.service");
const streaming_agent_orchestrator_service_1 = require("./streaming-agent-orchestrator.service");
const bedrock_module_1 = require("../../infrastructure/bedrock/bedrock.module");
const streaming_service_1 = require("../../services/streaming.service");
const chroma_service_1 = require("../../services/chroma.service");
let AgentModule = class AgentModule {
};
exports.AgentModule = AgentModule;
exports.AgentModule = AgentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'Agent', schema: agent_schema_1.AgentSchema },
                { name: 'AgentExecution', schema: agent_execution_schema_1.AgentExecutionSchema },
            ]),
            bedrock_module_1.BedrockModule,
        ],
        controllers: [agent_controller_1.AgentController],
        providers: [
            agent_service_1.AgentService,
            agent_execution_service_1.AgentExecutionService,
            tool_service_1.ToolService,
            agent_orchestrator_service_1.AgentOrchestratorService,
            streaming_agent_orchestrator_service_1.StreamingAgentOrchestratorService,
            streaming_service_1.StreamingService,
            chroma_service_1.ChromaService,
        ],
        exports: [
            agent_service_1.AgentService,
            agent_execution_service_1.AgentExecutionService,
            tool_service_1.ToolService,
            agent_orchestrator_service_1.AgentOrchestratorService,
            streaming_agent_orchestrator_service_1.StreamingAgentOrchestratorService,
            streaming_service_1.StreamingService,
        ],
    })
], AgentModule);
//# sourceMappingURL=agent.module.js.map