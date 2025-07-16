"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const training_controller_1 = require("./training.controller");
const training_service_1 = require("./training.service");
const training_history_model_1 = require("../models/training-history.model");
const collection_module_1 = require("../collection/collection.module");
const bedrock_module_1 = require("../bedrock/bedrock.module");
const upload_module_1 = require("../upload/upload.module");
const config_module_1 = require("../config/config.module");
let TrainingModule = class TrainingModule {
};
exports.TrainingModule = TrainingModule;
exports.TrainingModule = TrainingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: training_history_model_1.TrainingHistory.name, schema: training_history_model_1.TrainingHistorySchema },
            ]),
            collection_module_1.CollectionModule,
            bedrock_module_1.BedrockModule,
            upload_module_1.UploadModule,
            config_module_1.ConfigModule,
        ],
        controllers: [training_controller_1.TrainingController],
        providers: [training_service_1.TrainingService],
        exports: [training_service_1.TrainingService],
    })
], TrainingModule);
//# sourceMappingURL=training.module.js.map