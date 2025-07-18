import { Job } from 'bullmq';
import { AgentJobData } from '../services/queueService';

export async function handleAgentJob(job: Job<AgentJobData>) {
  const { agentId, userId, data } = job.data;
  console.log(`🤖 Processing agent job for agent ${agentId}`);
  try {
    // Process agent-specific logic here (implement จริงในอนาคต)
    console.log(`✅ Agent job completed for agent ${agentId}`);
  } catch (error) {
    console.error(`❌ Agent job failed for agent ${agentId}:`, error);
    throw error;
  }
} 