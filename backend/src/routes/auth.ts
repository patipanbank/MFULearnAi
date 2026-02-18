
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../auth/AuthService';

const router = Router();

// Public / Login
router.post('/admin/login', AuthController.loginAdmin);
router.get('/login/saml', AuthController.startSamlLogin);
router.post('/saml/callback', AuthController.handleSamlCallback);
router.get('/login/sso', AuthController.startSsoLogin);
router.post('/sso/callback', AuthController.handleSsoCallback);
router.post('/refresh', AuthController.refresh);

// Protected
router.get('/me', AuthService.authenticateUser, AuthController.me);

// Admin - Users
router.get('/users', AuthService.authenticateUser, AuthService.requireRole(['admin', 'superadmin']), AuthController.listUsers);
router.post('/users', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.createUser);
router.put('/users/:id', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.updateUser);
router.delete('/users/:id', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.deleteUser);
router.post('/users/create-admin', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.createUser); // Alias

// Admin - Departments
router.get('/departments', AuthService.authenticateUser, AuthController.listDepartments); // Public-ish? Or need auth? Identity service required auth.
router.post('/departments', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.createDepartment);
router.put('/departments/:id', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.updateDepartment);
router.delete('/departments/:id', AuthService.authenticateUser, AuthService.requireRole(['superadmin']), AuthController.deleteDepartment);

export default router;
