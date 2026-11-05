import { Router } from 'express';
import {
  getAllExams,
  createExam,
  getResults,
  saveResult,
  getReportCard,
  finalizeClassResults,
  updateExam,
  deleteExam,
  requestResultUnlock,
  setExamPublished,
  approveResultUnlock,
  getResultUnlockRequests,
  getAdminResultTracker,
  getAdminResultSummary,
  getResultAudit,
} from '../controllers/resultController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/exams', getAllExams);
router.post('/exams', authorize('admin'), createExam);
router.put('/exams/:examId', authorize('admin'), updateExam);
router.delete('/exams/:examId', authorize('admin'), deleteExam);
router.post('/exams/:examId/publish', authorize('admin'), setExamPublished);
router.post('/unlock-request', authorize('teacher'), requestResultUnlock);
router.get('/unlock-requests', authorize('admin'), getResultUnlockRequests);
router.post('/unlock-request/decision', authorize('admin'), approveResultUnlock);
router.get('/admin/tracker', authorize('admin'), getAdminResultTracker);
router.get('/admin/summary', authorize('admin'), getAdminResultSummary);
router.get('/admin/audit', authorize('admin'), getResultAudit);
router.get('/', getResults);
router.post('/enter', authorize('teacher'), saveResult);
router.post('/finalize', authorize('teacher'), finalizeClassResults);
router.get('/report-card/:examId/:studentId', getReportCard);

export default router;
