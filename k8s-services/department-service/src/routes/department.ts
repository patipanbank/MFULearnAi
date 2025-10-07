import express, { Request, Response } from 'express';
import { departmentService } from '../services/departmentService';

const router = express.Router();

// Get all departments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const departments = await departmentService.getAllDepartments(includeInactive === 'true');
    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department stats
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
    return res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Ensure department exists (find or create)
router.post('/ensure', async (req: Request, res: Response) => {
  try {
    const { name, displayName } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const department = await departmentService.ensureDepartmentExists(name, displayName);

    if (!department) {
      return res.status(400).json({ error: 'Invalid department name' });
    }

    return res.json(department);
  } catch (error) {
    console.error('Error ensuring department:', error);
    return res.status(500).json({ error: 'Failed to ensure department exists' });
  }
});

// Create new department
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
    return res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    return res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await departmentService.deleteDepartment(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Recalculate all user counts
router.post('/recalculate', async (req: Request, res: Response) => {
  try {
    const result = await departmentService.recalculateAllUserCounts();
    res.json(result);
  } catch (error) {
    console.error('Error recalculating user counts:', error);
    res.status(500).json({ error: 'Failed to recalculate user counts' });
  }
});

// User event handlers (called by other services)
router.post('/events/user-created', async (req: Request, res: Response) => {
  try {
    const { departmentName } = req.body;
    await departmentService.onUserCreated(departmentName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling user created event:', error);
    res.status(500).json({ error: 'Failed to handle user created event' });
  }
});

router.post('/events/user-deleted', async (req: Request, res: Response) => {
  try {
    const { departmentName } = req.body;
    await departmentService.onUserDeleted(departmentName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling user deleted event:', error);
    res.status(500).json({ error: 'Failed to handle user deleted event' });
  }
});

router.post('/events/user-department-changed', async (req: Request, res: Response) => {
  try {
    const { oldDepartment, newDepartment } = req.body;
    await departmentService.onUserDepartmentChanged(oldDepartment, newDepartment);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling user department changed event:', error);
    res.status(500).json({ error: 'Failed to handle user department changed event' });
  }
});

export default router;
