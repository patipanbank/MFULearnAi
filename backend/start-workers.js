#!/usr/bin/env node

/**
 * Start Workers Script for MFULearnAI Backend
 * 
 * Usage:
 * $ node start-workers.js [chat|agent|all]
 * 
 * Examples:
 * $ node start-workers.js chat     # Start only chat worker
 * $ node start-workers.js agent    # Start only agent worker  
 * $ node start-workers.js all      # Start both workers
 * $ node start-workers.js          # Start both workers (default)
 */

const { fork } = require('child_process');

function startWorker(path, name) {
  const proc = fork(path);
  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    // Restart worker if needed
    setTimeout(() => startWorker(path, name), 1000);
  });
  proc.on('error', (err) => {
    console.error(`[${name}] error:`, err);
  });
  console.log(`[${name}] started (pid: ${proc.pid})`);
}

// Start multiple instances of each worker type
const chatWorkerCount = process.env.CHAT_WORKER_COUNT || 2;
const agentWorkerCount = process.env.AGENT_WORKER_COUNT || 1;
const notificationWorkerCount = process.env.NOTIFICATION_WORKER_COUNT || 1;

for (let i = 0; i < chatWorkerCount; i++) {
  startWorker('./src/workers/chatWorker.ts', `chatWorker-${i+1}`);
}
for (let i = 0; i < agentWorkerCount; i++) {
  startWorker('./src/workers/agentWorker.ts', `agentWorker-${i+1}`);
}
for (let i = 0; i < notificationWorkerCount; i++) {
  startWorker('./src/workers/notificationWorker.ts', `notificationWorker-${i+1}`);
} 