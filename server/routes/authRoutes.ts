import { Router } from 'express';
import { login, getMe, resetDemoData, getDirectoryAccounts, changePassword } from '../controllers/authController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/change-password', protect, authorize('teacher'), changePassword);
router.post('/reset-demo', protect, authorize('admin'), resetDemoData);
router.get('/directory', getDirectoryAccounts);

export default router;
