"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAgentJob = handleAgentJob;
async function handleAgentJob(job) {
    const { agentId, userId, data } = job.data;
    console.log(`🤖 Processing agent job for agent ${agentId}`);
    try {
        console.log(`✅ Agent job completed for agent ${agentId}`);
    }
    catch (error) {
        console.error(`❌ Agent job failed for agent ${agentId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=agentHandler.js.map