"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidation = void 0;
const common_1 = require("@nestjs/common");
const zod_validation_pipe_1 = require("../zod-validation.pipe");
const ZodValidation = (schema) => {
    return (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schema));
};
exports.ZodValidation = ZodValidation;
//# sourceMappingURL=zod-validation.decorator.js.map