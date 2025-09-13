import express from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import sessionRoutes from './sessionRoutes';

/**
 * Auth Group Routes - จัดกลุ่ม routes ที่เกี่ยวกับ authentication
 */
const router = express.Router();

// Sub-routes  
router.use('/', authRoutes);           // /api/auth/*
router.use('/users', userRoutes);      // /api/auth/users/*
router.use('/sessions', sessionRoutes); // /api/auth/sessions/*

export { router as authGroupRoutes };