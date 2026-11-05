import { Router } from 'express';
import {
  getFeeStructures,
  getFeeStructureByClass,
  saveFeeStructure,
  getFeePayments,
  recordPayment,
  generateMonthlyVouchers,
  getFeeDefaulters,
  getVoucherDetails,
  getMyVouchers,
  getAdvancedStructures, upsertAdvancedStructure, updateAdvancedStructure,
  addOpeningBalance, importOpeningBalances, createAdjustment, createOneTimeCharge,
  generateAdvancedVouchers, updateAdvancedVoucher, publishVoucher, publishBulkVouchers,
  cancelVoucher, listAdvancedVouchers, advancedVoucherPdf, createAdvancedPayment,
  reversePayment, createProof, listProofs, reviewProof, getDefaultersAdvanced,
  sendFeeReminders, waiveFine, getLedger, getLedgerPdf, getFeeReports,
  getFeeAuditLog, getStudentFees, getParentChildrenFees, setFeeMonthLock,
  promoteStudentClass, withdrawStudent, getStudentBalance, generateNoDuesCertificate,
} from '../controllers/feeController.js';
import { protect, authorize } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const proofDirectory = path.resolve(process.cwd(), 'uploads', 'fee-proofs');
fs.mkdirSync(proofDirectory, { recursive: true });
const proofUpload = multer({
  storage: multer.diskStorage({
    destination: proofDirectory,
    filename: (_req, file, callback) => {
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`;
      callback(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype));
  },
});

const router = Router();

router.use(protect);

router.get('/structures', authorize('admin', 'teacher', 'student', 'parent'), getFeeStructures);
router.get('/structure/:classId', authorize('admin', 'teacher', 'student', 'parent'), getFeeStructureByClass);
router.post('/structure', authorize('admin'), upsertAdvancedStructure);
router.get('/structure', authorize('admin', 'accountant', 'student', 'parent'), getAdvancedStructures);
router.put('/structure/:id', authorize('admin'), updateAdvancedStructure);

router.get('/payments', authorize('admin'), getFeePayments);
router.get('/vouchers/my', authorize('admin', 'student', 'parent'), getMyVouchers);
router.post('/payments/record', authorize('admin'), recordPayment);
router.post('/generate-vouchers', authorize('admin'), generateMonthlyVouchers);
router.post('/vouchers/generate', authorize('admin'), generateAdvancedVouchers);
router.get('/defaulters', authorize('admin'), getFeeDefaulters);
router.get('/voucher/:voucherNo', authorize('admin', 'student', 'parent'), getVoucherDetails);
router.post('/opening-balance', authorize('admin'), addOpeningBalance);
router.post('/opening-balance/import', authorize('admin'), importOpeningBalances);
router.post('/adjustments', authorize('admin'), createAdjustment);
router.post('/one-time-charges', authorize('admin'), createOneTimeCharge);
router.put('/vouchers/:id', authorize('admin'), updateAdvancedVoucher);
router.patch('/vouchers/:id/publish', authorize('admin'), publishVoucher);
router.post('/vouchers/publish-bulk', authorize('admin'), publishBulkVouchers);
router.patch('/vouchers/:id/cancel', authorize('admin'), cancelVoucher);
router.get('/vouchers', authorize('admin', 'accountant', 'student', 'parent'), listAdvancedVouchers);
router.get('/vouchers/:id/pdf', authorize('admin', 'accountant', 'student', 'parent'), advancedVoucherPdf);
router.post('/payments', authorize('admin', 'accountant'), createAdvancedPayment);
router.post('/payments/:id/reverse', authorize('admin'), reversePayment);
router.post('/proofs', authorize('student', 'parent'), proofUpload.single('proof'), createProof);
router.get('/proofs', authorize('admin', 'accountant', 'student', 'parent'), listProofs);
router.patch('/proofs/:id/approve', authorize('admin', 'accountant'), reviewProof);
router.patch('/proofs/:id/reject', authorize('admin', 'accountant'), reviewProof);
router.get('/advanced-defaulters', authorize('admin', 'accountant'), getDefaultersAdvanced);
router.post('/reminders', authorize('admin'), sendFeeReminders);
router.post('/fines/:voucherId/waive', authorize('admin'), waiveFine);
router.get('/ledger/:studentId', authorize('admin', 'accountant', 'student', 'parent'), getLedger);
router.get('/ledger/:studentId/pdf', authorize('admin', 'accountant', 'student', 'parent'), getLedgerPdf);
router.get('/reports', authorize('admin', 'accountant'), getFeeReports);
router.get('/audit-log', authorize('admin'), getFeeAuditLog);
router.get('/student/:studentId', authorize('admin', 'accountant', 'student', 'parent'), getStudentFees);
router.get('/parent/children', authorize('parent'), getParentChildrenFees);
router.post('/month-lock', authorize('admin'), setFeeMonthLock);
router.patch('/students/:studentId/class', authorize('admin'), promoteStudentClass);
router.patch('/students/:studentId/withdraw', authorize('admin'), withdrawStudent);
router.get('/students/:studentId/balance', authorize('admin', 'accountant', 'student', 'parent'), getStudentBalance);
router.get('/students/:studentId/no-dues-certificate', authorize('admin'), generateNoDuesCertificate);
router.post('/payments/webhook', (_req, res) => res.status(501).json({
  success: false,
  message: 'Online payment gateway webhook is not configured.',
}));

export default router;
