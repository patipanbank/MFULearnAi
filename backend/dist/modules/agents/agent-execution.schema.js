"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutionSchema = exports.AgentExecutionStatus = void 0;
const mongoose_1 = require("mongoose");
var AgentExecutionStatus;
(function (AgentExecutionStatus) {
    AgentExecutionStatus["IDLE"] = "idle";
    AgentExecutionStatus["THINKING"] = "thinking";
    AgentExecutionStatus["USING_TOOL"] = "using_tool";
    AgentExecutionStatus["RESPONDING"] = "responding";
    AgentExecutionStatus["ERROR"] = "error";
})(AgentExecutionStatus || (exports.AgentExecutionStatus = AgentExecutionStatus = {}));
exports.AgentExecutionSchema = new mongoose_1.Schema({
    agentId: { type: String, required: true },
    sessionId: { type: String, required: true },
    status: { type: String, enum: Object.values(AgentExecutionStatus), default: AgentExecutionStatus.IDLE },
    currentTool: { type: String },
    progress: { type: Number, default: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    tokenUsage: {
        input: { type: Number, default: 0 },
        output: { type: Number, default: 0 },
    },
});
//# sourceMappingURL=agent-execution.schema.js.map