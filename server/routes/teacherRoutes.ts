import { Router } from 'express';
import {
  getAllTeachers,
  getTeacherById,
  getAvailableSubjects,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacherController.js';
import { protect, authorize } from '../middleware/auth.js';
import {
  getMyAttendanceClass,
  getAttendanceStudents,
  submitClassAttendance,
  editClassAttendance,
  getAttendanceHistory,
  getTeacherAttendanceReport,
  requestAttendanceCorrection,
  exportAttendanceReport,
} from '../controllers/attendanceController.js';

const router = Router();

router.use(protect);

router.get('/attendance/my-class', authorize('teacher'), getMyAttendanceClass);
router.get('/attendance/students', authorize('teacher'), getAttendanceStudents);
router.post('/attendance', authorize('teacher'), submitClassAttendance);
router.put('/attendance/:id', authorize('teacher'), editClassAttendance);
router.get('/attendance/history', authorize('teacher'), getAttendanceHistory);
router.get('/attendance/report', authorize('teacher'), getTeacherAttendanceReport);
router.post('/attendance/corrections', authorize('teacher'), requestAttendanceCorrection);
router.get('/attendance/export/:format', authorize('teacher'), exportAttendanceReport);

router.get('/', authorize('admin'), getAllTeachers);
router.get('/available-subjects/:classId', authorize('admin'), getAvailableSubjects);
router.get('/:id', authorize('admin'), getTeacherById);
router.post('/', authorize('admin'), createTeacher);
router.put('/:id', authorize('admin'), updateTeacher);
router.delete('/:id', authorize('admin'), deleteTeacher);

export default router;
