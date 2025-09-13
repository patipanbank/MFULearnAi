import express from 'express';
import { agentRoutes } from './agentRoutes';
import { templateRoutes } from './templateRoutes';
import { executionRoutes } from './executionRoutes';

/**
 * Agent Group Routes - จัดกลุ่ม routes ที่เกี่ยวกับ agent
 */
const router = express.Router();

// Sub-routes
router.use('/', agentRoutes);                // /api/agent/*
router.use('/templates', templateRoutes);    // /api/agent/templates/*
router.use('/executions', executionRoutes);  // /api/agent/executions/*

export { router as agentGroupRoutes };