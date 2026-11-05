import { Router } from 'express';
import {
  getTimetable,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  getClassTimetable,
  getMyTeacherTimetable,
  getMyStudentTimetable,
  getTimetableFormData,
  checkTimetableConflict,
  getTeacherTimetable,
  getTimetableClashes,
} from '../controllers/timetableController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getTimetable);
router.get('/class/:classId', getClassTimetable);
router.get('/teacher/me', authorize('teacher'), getMyTeacherTimetable);
router.get('/teacher/:teacherId', authorize('admin'), getTeacherTimetable);
router.get('/student/me', authorize('student'), getMyStudentTimetable);
router.get('/form-data', authorize('admin'), getTimetableFormData);
router.get('/clashes', authorize('admin'), getTimetableClashes);
router.post('/conflicts/check', authorize('admin'), checkTimetableConflict);
router.post('/', authorize('admin'), createTimetableSlot);
router.put('/:id', authorize('admin'), updateTimetableSlot);
router.delete('/:id', authorize('admin'), deleteTimetableSlot);

export default router;
