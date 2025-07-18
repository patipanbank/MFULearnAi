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

const { spawn } = require('child_process');
const path = require('path');

// Get worker type from command line arguments
const workerType = process.argv[2] || 'all';

console.log('🚀 Starting MFULearnAI Workers...');
console.log(`📋 Worker type: ${workerType}`);

// Function to start a worker
function startWorker(type) {
  console.log(`🎯 Starting ${type} worker...`);
  
  const workerProcess = spawn('npx', ['ts-node', `src/workers/${type}Worker.ts`], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production'
    }
  });

  workerProcess.on('error', (error) => {
    console.error(`❌ Failed to start ${type} worker:`, error);
  });

  workerProcess.on('exit', (code) => {
    console.log(`🛑 ${type} worker exited with code ${code}`);
  });

  return workerProcess;
}

// Function to handle graceful shutdown
function gracefulShutdown(processes) {
  console.log('\n🛑 Received shutdown signal, stopping workers gracefully...');
  
  processes.forEach((proc, index) => {
    if (proc && !proc.killed) {
      console.log(`🛑 Stopping worker ${index + 1}...`);
      proc.kill('SIGTERM');
    }
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('🛑 Force exiting...');
    process.exit(1);
  }, 5000);
}

// Start workers based on type
const processes = [];

try {
  switch (workerType) {
    case 'chat':
      processes.push(startWorker('chat'));
      break;
      
    case 'agent':
      processes.push(startWorker('agent'));
      break;
      
    case 'all':
    default:
      processes.push(startWorker('chat'));
      processes.push(startWorker('agent'));
      break;
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown(processes));
  process.on('SIGINT', () => gracefulShutdown(processes));

  console.log('✅ Workers started successfully');
  console.log('📡 Workers are now listening for jobs...');
  console.log('🛑 Press Ctrl+C to stop all workers');

} catch (error) {
  console.error('❌ Failed to start workers:', error);
  process.exit(1);
} 