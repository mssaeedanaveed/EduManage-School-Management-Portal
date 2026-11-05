import { Router } from 'express';
import {
  getAttendanceByClassAndDate,
  markAttendance,
  getMonthlyReport,
  getClassAttendanceSummary,
  getStudentAttendance,
  concludeAttendanceMonth,
  unlockAttendanceMonth,
  getAdminAttendanceClasses,
  getAdminAttendanceStudents,
  getAdminStudentMonths,
  getAdminStudentMonthDetail,
  getAdminStudentWeekDetail,
  getMyAttendanceClass,
  getAttendanceStudents,
  submitClassAttendance,
  editClassAttendance,
  getAttendanceHistory,
  getTeacherAttendanceReport,
  requestAttendanceCorrection,
  exportAttendanceReport,
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/admin/classes', authorize('admin'), getAdminAttendanceClasses);
router.get('/admin/classes/:classId/students', authorize('admin'), getAdminAttendanceStudents);
router.get('/admin/students/:studentId/months', authorize('admin'), getAdminStudentMonths);
router.get('/admin/students/:studentId/months/:month', authorize('admin'), getAdminStudentMonthDetail);
router.get('/admin/students/:studentId/weeks/:week', authorize('admin'), getAdminStudentWeekDetail);

router.get('/class', authorize('teacher'), getAttendanceByClassAndDate);
router.get('/', authorize('teacher'), getAttendanceByClassAndDate);
router.post('/mark', authorize('teacher'), markAttendance);
router.get('/monthly-report', authorize('teacher'), getMonthlyReport);
router.get('/class-summary', authorize('teacher'), getClassAttendanceSummary);
router.get('/student/:studentId', authorize('admin', 'teacher', 'student', 'parent'), getStudentAttendance);
router.post('/conclude', authorize('teacher'), concludeAttendanceMonth);
router.post('/unlock', authorize('teacher'), unlockAttendanceMonth);
router.get('/export/:format', authorize('admin', 'teacher'), exportAttendanceReport);

router.get('/teacher/my-class', authorize('teacher'), getMyAttendanceClass);
router.get('/teacher/students', authorize('teacher'), getAttendanceStudents);
router.post('/teacher', authorize('teacher'), submitClassAttendance);
router.put('/teacher/:id', authorize('teacher'), editClassAttendance);
router.get('/teacher/history', authorize('teacher'), getAttendanceHistory);
router.get('/teacher/report', authorize('teacher'), getTeacherAttendanceReport);
router.post('/teacher/corrections', authorize('teacher'), requestAttendanceCorrection);

export default router;
