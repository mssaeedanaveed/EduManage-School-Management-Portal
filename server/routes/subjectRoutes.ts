import { Router } from 'express';
import {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  checkCourseCodeAvailability,
} from '../controllers/subjectController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getAllSubjects);
router.get('/course-code-availability', authorize('admin'), checkCourseCodeAvailability);
router.get('/:id', getSubjectById);
router.post('/', authorize('admin'), createSubject);
router.put('/:id', authorize('admin'), updateSubject);
router.delete('/:id', authorize('admin'), deleteSubject);

export default router;
