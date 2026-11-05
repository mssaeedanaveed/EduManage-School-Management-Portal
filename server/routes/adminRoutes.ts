import { Router, Response } from 'express';
import { protect, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { runFeeJobs } from '../services/feeCronService.js';
import { setClassTeacher } from '../controllers/classController.js';
import { getAdminAttendanceCorrections, reviewAttendanceCorrection } from '../controllers/attendanceController.js';

const router = Router();

router.use(protect);
router.use(authorize('admin'));

router.patch('/classes/:id/class-teacher', setClassTeacher);
router.get('/attendance/corrections', getAdminAttendanceCorrections);
router.patch('/attendance/corrections/:id', reviewAttendanceCorrection);

/**
 * Manually trigger automated fee cron jobs
 * POST /api/admin/run-fee-jobs
 */
router.post('/run-fee-jobs', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = runFeeJobs();
    res.status(200).json({
      success: true,
      message: 'Automated fee jobs executed successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('[run-fee-jobs error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run fee jobs',
    });
  }
});

export default router;
