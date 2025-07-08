"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const embedding_processor_1 = require("./embedding.processor");
const job_processor_1 = require("./job.processor");
const job_queue_service_1 = require("./job-queue.service");
const queue_controller_1 = require("./queue.controller");
const chroma_service_1 = require("../../services/chroma.service");
const document_management_service_1 = require("../../services/document-management.service");
const document_service_1 = require("../../services/document.service");
const agent_module_1 = require("../../modules/agents/agent.module");
const bedrock_module_1 = require("../bedrock/bedrock.module");
const memory_service_1 = require("../../services/memory.service");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: 'BULL_QUEUE',
                useFactory: () => {
                    const redisUrl = process.env.REDIS_URL;
                    if (redisUrl) {
                        return new bullmq_1.Queue('default', {
                            connection: {
                                url: redisUrl,
                            },
                        });
                    }
                    const host = process.env.REDIS_HOST || 'localhost';
                    const port = parseInt(process.env.REDIS_PORT || '6379');
                    const password = process.env.REDIS_PASSWORD;
                    const db = parseInt(process.env.REDIS_DB || '0');
                    return new bullmq_1.Queue('default', {
                        connection: {
                            host,
                            port,
                            password,
                            db,
                        },
                    });
                },
            },
            chroma_service_1.ChromaService,
            document_service_1.DocumentService,
            document_management_service_1.DocumentManagementService,
            job_queue_service_1.JobQueueService,
            embedding_processor_1.EmbeddingProcessor,
            job_processor_1.JobProcessor,
            memory_service_1.MemoryService,
        ],
        imports: [agent_module_1.AgentModule, bedrock_module_1.BedrockModule],
        exports: ['BULL_QUEUE', memory_service_1.MemoryService, job_queue_service_1.JobQueueService],
        controllers: [queue_controller_1.QueueController],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map