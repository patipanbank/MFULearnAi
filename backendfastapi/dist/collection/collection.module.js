"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionModule = void 0;
const common_1 = require("@nestjs/common");
const chroma_service_1 = require("./chroma.service");
const config_module_1 = require("../config/config.module");
const bedrock_module_1 = require("../bedrock/bedrock.module");
let CollectionModule = class CollectionModule {
};
exports.CollectionModule = CollectionModule;
exports.CollectionModule = CollectionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            bedrock_module_1.BedrockModule,
        ],
        controllers: [],
        providers: [chroma_service_1.ChromaService],
        exports: [chroma_service_1.ChromaService],
    })
], CollectionModule);
//# sourceMappingURL=collection.module.js.map