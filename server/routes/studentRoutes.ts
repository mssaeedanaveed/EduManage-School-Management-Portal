import { Router } from 'express';
import {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentDirectoryClasses,
  getStudentsByClass,
  getStudentCount,
  getOldStudents,
} from '../controllers/studentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/directory/classes', authorize('admin'), getStudentDirectoryClasses);
router.get('/directory/class-names/:className/students', authorize('admin'), getStudentsByClass);
router.get('/directory/classes/:classId/students', authorize('admin'), getStudentsByClass);
router.get('/directory/count', authorize('admin'), getStudentCount);
router.get('/old', authorize('admin'), getOldStudents);
router.get('/', getAllStudents);
router.get('/:id', getStudentById);
router.post('/', authorize('admin'), createStudent);
router.put('/:id', authorize('admin'), updateStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

export default router;
