import express, { Request, Response } from 'express';
import { departmentService } from '../services/departmentService';

const router = express.Router();

// Get all departments
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const departments = await departmentService.getAllDepartments(includeInactive);
    res.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await departmentService.getDepartmentStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({ error: 'Failed to fetch department stats' });
  }
});

// Get department by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Get department by name
router.get('/name/:name', async (req: Request, res: Response) => {
  try {
    const department = await departmentService.getDepartmentByName(req.params.name);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department
router.post('/', async (req: Request, res: Response) => {
  try {
    const department = await departmentService.createDepartment(req.body);
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const department = await departmentService.updateDepartment(req.params.id, req.body);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await departmentService.deleteDepartment(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: error.message || 'Failed to delete department' });
  }
});

// Recalculate user counts
router.post('/recalculate-counts', async (req: Request, res: Response) => {
  try {
    const result = await departmentService.recalculateAllUserCounts();
    res.json(result);
  } catch (error) {
    console.error('Error recalculating user counts:', error);
    res.status(500).json({ error: 'Failed to recalculate user counts' });
  }
});

// Webhook endpoints for user events (called by Auth Service)
router.post('/webhooks/user-created', async (req: Request, res: Response) => {
  try {
    const { departmentName } = req.body;
    await departmentService.onUserCreated(departmentName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling user creation webhook:', error);
    res.status(500).json({ error: 'Failed to handle user creation' });
  }
});

router.post('/webhooks/user-deleted', async (req: Request, res: Response) => {
  try {
    const { departmentName } = req.body;
    await departmentService.onUserDeleted(departmentName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling user deletion webhook:', error);
    res.status(500).json({ error: 'Failed to handle user deletion' });
  }
});

router.post('/webhooks/user-department-changed', async (req: Request, res: Response) => {
  try {
    const { oldDepartment, newDepartment } = req.body;
    await departmentService.onUserDepartmentChanged(oldDepartment, newDepartment);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling department change webhook:', error);
    res.status(500).json({ error: 'Failed to handle department change' });
  }
});

export default router;
