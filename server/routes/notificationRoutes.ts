import { Router } from 'express';
import {
  createTeacherAnnouncement,
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/', authorize('admin'), createTeacherAnnouncement);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
