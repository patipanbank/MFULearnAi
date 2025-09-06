import express from 'express';
import { chatRoutes } from './chatRoutes';
import { messageRoutes } from './messageRoutes';
import { sessionRoutes } from './sessionRoutes';

/**
 * Chat Group Routes - จัดกลุ่ม routes ที่เกี่ยวกับ chat
 */
const router = express.Router();

// Sub-routes
router.use('/', chatRoutes);           // /api/chat/*
router.use('/messages', messageRoutes);  // /api/chat/messages/*
router.use('/sessions', sessionRoutes);  // /api/chat/sessions/*

export { router as chatGroupRoutes };