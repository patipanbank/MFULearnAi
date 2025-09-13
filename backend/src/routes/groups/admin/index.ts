import express from 'express';
import systemRoutes from './systemRoutes';
import usersRoutes from './usersRoutes';
import analyticsRoutes from './analyticsRoutes';

/**
 * Admin Group Routes - จัดกลุ่ม routes สำหรับ admin operations
 */
const router = express.Router();

// Sub-routes
router.use('/system', systemRoutes);       // /api/admin/system/*
router.use('/users', usersRoutes);         // /api/admin/users/*  
router.use('/analytics', analyticsRoutes); // /api/admin/analytics/*

export { router as adminGroupRoutes };