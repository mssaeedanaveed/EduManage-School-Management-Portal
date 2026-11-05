import { Router } from 'express';
import {
  getAllClasses,
  getClassById,
  getAvailableClassTeachers,
  checkRoomAvailability,
  createClass,
  createClassSections,
  updateClass,
  deleteClass,
} from '../controllers/classController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/available-teachers', authorize('admin'), getAvailableClassTeachers);
router.get('/room-availability', authorize('admin'), checkRoomAvailability);
router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.post('/sections', authorize('admin'), createClassSections);
router.post('/', authorize('admin'), createClass);
router.put('/:id', authorize('admin'), updateClass);
router.delete('/:id', authorize('admin'), deleteClass);

export default router;
