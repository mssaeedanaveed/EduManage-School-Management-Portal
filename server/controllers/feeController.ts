import { Response } from 'express';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  FeeStructureModel, FeePaymentModel, StudentModel, ClassModel,
  FeeStructureV2Model, OpeningBalanceModel, StudentFeeAdjustmentModel,
  OneTimeChargeModel, FeeVoucherModel, FeePaymentModelV2, PaymentProofModel,
  FeeAuditLogModel, NotificationModel, FeeMonthLockModel,
} from '../models/index.js';
import UserModel from '../models/User.js';
import store from '../data/store.js';

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function voucherNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `VCH-${new Date().getFullYear()}-${random}`;
}

export async function getFeeStructures(req: AuthenticatedRequest, res: Response): Promise<void> {
  const structures = await FeeStructureModel.find({}).sort({ classId: 1 }).lean();
  res.status(200).json({ success: true, data: structures });
}

export async function getFeeStructureByClass(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { classId } = req.params;
  const structure = await FeeStructureModel.findOne({ classId }).lean();

  if (!structure) {
    res.status(404).json({ success: false, message: 'No fee structure found for this class.' });
    return;
  }

  res.status(200).json({ success: true, data: structure });
}

export async function saveFeeStructure(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    classId,
    title,
    tuitionFee,
    transportFee = 0,
    labFee = 0,
    libraryFee = 0,
    examFee = 0,
    otherCharges = 0,
    academicYear = '2025-2026',
  } = req.body;

  if (!classId || !title || tuitionFee === undefined) {
    res.status(400).json({
      success: false,
      message: 'classId, title, and tuitionFee are required.',
    });
    return;
  }

  const amounts = [tuitionFee, transportFee, labFee, libraryFee, examFee, otherCharges].map(Number);
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    res.status(400).json({ success: false, message: 'Fee amounts must be valid non-negative numbers.' });
    return;
  }

  const cls = await ClassModel.findById(classId).lean();
  if (!cls) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }

  const structureValues = {
    classId,
    className: `${cls.className} - ${cls.section}`,
    title,
    tuitionFee: amounts[0],
    transportFee: amounts[1],
    labFee: amounts[2],
    libraryFee: amounts[3],
    examFee: amounts[4],
    otherCharges: amounts[5],
    academicYear,
    totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
  };

  const existing = await FeeStructureModel.findOne({ classId });
  const structure = existing
    ? await FeeStructureModel.findByIdAndUpdate(existing._id, structureValues, { new: true, runValidators: true }).lean()
    : await FeeStructureModel.create({ _id: id('fee_str'), ...structureValues });

  res.status(200).json({
    success: true,
    message: 'Fee structure saved successfully',
    data: structure,
  });
}

export async function getFeePayments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { classId, studentId, status } = req.query as {
    classId?: string;
    studentId?: string;
    status?: string;
  };

  const filter: Record<string, string> = {};
  if (classId) filter.classId = classId;
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  const payments = await FeePaymentModel.find(filter).sort({ createdAt: -1 }).lean();

  res.status(200).json({
    success: true,
    total: payments.length,
    data: payments,
  });
}

export async function recordPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { voucherNo, amountPaid, paymentMethod, transactionRef, remarks } = req.body;

  if (!voucherNo || amountPaid === undefined || !paymentMethod) {
    res.status(400).json({
      success: false,
      message: 'voucherNo, amountPaid, and paymentMethod are required.',
    });
    return;
  }

  const paymentAmount = Number(amountPaid);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    return;
  }

  const payment = await FeePaymentModel.findOne({ voucherNo });
  if (!payment) {
    res.status(404).json({ success: false, message: 'Fee voucher not found' });
    return;
  }
  const newAmountPaid = Number(payment.amountPaid || 0) + paymentAmount;
  const newBalance = Math.max(0, Number(payment.totalDue) - newAmountPaid);
  if (newAmountPaid > Number(payment.totalDue)) {
    res.status(400).json({ success: false, message: 'Payment exceeds the voucher balance.' });
    return;
  }
  payment.amountPaid = newAmountPaid;
  payment.balance = newBalance;
  payment.status = newBalance === 0 ? 'Paid' : 'Partial';
  payment.paymentDate = new Date().toISOString().split('T')[0];
  payment.paymentMethod = paymentMethod;
  payment.transactionRef = transactionRef || '';
  payment.remarks = remarks || '';
  await payment.save();
  const updated = payment.toObject();

  if (!updated) {
    res.status(404).json({ success: false, message: 'Fee voucher not found' });
    return;
  }

  res.status(200).json({
    success: true,
    message: `Payment of $${amountPaid} recorded successfully for voucher ${voucherNo}`,
    data: updated,
  });
}

export async function generateMonthlyVouchers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { classId, month, year, dueDate } = req.body;

  let targetMonth = month;
  if (month && year && !month.includes(String(year))) {
    targetMonth = `${month} ${year}`;
  }

  if (!targetMonth || !dueDate) {
    res.status(400).json({
      success: false,
      message: 'month and dueDate are required before publishing fee vouchers.',
    });
    return;
  }

  try {
    const studentFilter: Record<string, any> = {
      $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
    };
    if (classId && classId !== 'all') studentFilter.classId = classId;
    const students = await StudentModel.find(studentFilter).lean();
    if (students.length === 0) {
      res.status(404).json({ success: false, message: 'No enrolled students found for the selected class.' });
      return;
    }

    const structures = await FeeStructureModel.find(
      classId && classId !== 'all' ? { classId } : { classId: { $in: students.map((student) => student.classId) } }
    ).lean();
    const structureByClass = new Map(structures.map((structure) => [structure.classId, structure]));
    const missingClassIds = [...new Set(students.map((student) => student.classId))]
      .filter((studentClassId) => !structureByClass.has(studentClassId));
    if (missingClassIds.length > 0) {
      throw new Error('Configure a fee structure for every selected class before publishing vouchers.');
    }

    const newVouchers: any[] = [];
    for (const student of students) {
      const existing = await FeePaymentModel.findOne({ studentId: student._id, month: targetMonth }).lean();
      if (existing) continue;
      const structure = structureByClass.get(student.classId)!;
      const earlierUnpaid = await FeePaymentModel.find({
        studentId: student._id,
        month: { $ne: targetMonth },
        status: { $ne: 'Paid' },
      }).lean();
      const previousDues = earlierUnpaid.reduce((sum, voucher) => sum + Number(voucher.balance || 0), 0);
      const totalDue = Number(structure.totalAmount) + previousDues;
      let voucherNo = voucherNumber();
      while (await FeePaymentModel.exists({ voucherNo })) voucherNo = voucherNumber();
      newVouchers.push(await FeePaymentModel.create({
        _id: id('pay'),
        voucherNo,
        studentId: student._id,
        studentName: student.name,
        rollNo: student.rollNo,
        classId: student.classId,
        className: student.className,
        feeStructureId: structure._id,
        month: targetMonth,
        dueDate,
        currentFee: structure.totalAmount,
        previousDues,
        totalDue,
        amountPaid: 0,
        balance: totalDue,
        status: 'Unpaid',
      }));
    }
    res.status(201).json({
      success: true,
      message: `Generated and published ${newVouchers.length} fee vouchers for ${targetMonth}`,
      data: newVouchers,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function getMyVouchers(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  let payments: any[] = [];
  if (req.user.role === 'student') {
    const student = await StudentModel.findOne({
      userId: req.user._id,
      $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
    }).lean();
    if (student) {
      payments = await FeePaymentModel.find({ studentId: student._id }).sort({ createdAt: -1 }).lean();
    }
  } else if (req.user.role === 'parent') {
    const children = await StudentModel.find({
      parentId: req.user._id,
      $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
    }).lean();
    payments = await FeePaymentModel.find({ studentId: { $in: children.map((child) => child._id) } })
      .sort({ createdAt: -1 }).lean();
  } else {
    payments = await FeePaymentModel.find({}).sort({ createdAt: -1 }).lean();
  }

  res.status(200).json({
    success: true,
    total: payments.length,
    data: payments,
  });
}

export async function getFeeDefaulters(req: AuthenticatedRequest, res: Response): Promise<void> {
  const defaulters = await FeePaymentModel.find({ status: { $in: ['Unpaid', 'Partial', 'Overdue'] } }).lean();
  const totalPendingAmount = defaulters.reduce((acc, curr) => acc + curr.balance, 0);

  res.status(200).json({
    success: true,
    count: defaulters.length,
    totalPendingAmount,
    data: defaulters,
  });
}

export async function getVoucherDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { voucherNo } = req.params;
  const payment = await FeePaymentModel.findOne({ voucherNo }).lean();

  if (!payment) {
    res.status(404).json({ success: false, message: 'Voucher not found' });
    return;
  }

  if (req.user?.role === 'student') {
    const student = await StudentModel.findOne({
      userId: req.user._id,
      $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
    }).lean();
    if (!student || student._id !== payment.studentId) {
      res.status(403).json({ success: false, message: 'Access denied: You can only view your own vouchers.' });
      return;
    }
  } else if (req.user?.role === 'parent') {
    const linkedChild = await StudentModel.exists({
      _id: payment.studentId,
      parentId: req.user._id,
      $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
    });
    if (!linkedChild) {
      res.status(403).json({ success: false, message: 'Access denied: You can only view linked children vouchers.' });
      return;
    }
  }

  const student = await StudentModel.findById(payment.studentId).lean();
  const feeStructure = payment.feeStructureId
    ? await FeeStructureModel.findById(payment.feeStructureId).lean()
    : await FeeStructureModel.findOne({ classId: payment.classId }).lean();

  res.status(200).json({
    success: true,
    data: {
      voucher: payment,
      student,
      breakdown: feeStructure,
      schoolInfo: {
        name: 'St. Augustine International Academy',
        address: '100 Knowledge Way, Metropolis, State 90210',
        phone: '+1 (555) 019-2831',
        bankDetails: {
          bankName: 'City National Bank',
          accountTitle: 'St. Augustine Academy Trust',
          accountNumber: '4481-9023-8812',
          iban: 'US89-CNB-0001-4481-9023-8812',
        },
      },
    },
  });
}

function requireUser(req: AuthenticatedRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return false;
  }
  return true;
}

async function audit(req: AuthenticatedRequest, action: string, entity: string, entityId: string, before: unknown, after: unknown, reason = '') {
  await FeeAuditLogModel.create({ _id: id('fee_audit'), userId: req.user!._id, action, entity, entityId, before, after, reason });
}

export async function upsertAdvancedStructure(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!requireUser(req, res)) return;
  const { sessionId, classId, effectiveFrom, heads, dueDay, lateFineType, lateFineAmount } = req.body;
  if (!sessionId || !classId || !effectiveFrom || !Array.isArray(heads) || !dueDay) {
    res.status(400).json({ success: false, message: 'sessionId, classId, effectiveFrom, heads and dueDay are required.' });
    return;
  }
  const latest = await FeeStructureV2Model.findOne({ sessionId, classId }).sort({ version: -1 }).lean();
  const structure = await FeeStructureV2Model.create({
    _id: id('fee_structure'), sessionId, classId, version: (latest?.version || 0) + 1,
    effectiveFrom, heads, dueDay, lateFineType: lateFineType || 'fixed', lateFineAmount: lateFineAmount || 0,
  });
  await audit(req, 'CREATE', 'FeeStructure', structure._id, null, structure);
  res.status(201).json({ success: true, data: structure });
}

export async function getAdvancedStructures(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await FeeStructureV2Model.find({}).sort({ sessionId: 1, classId: 1, version: -1 }).lean();
  res.status(200).json({ success: true, data });
}

export async function setFeeMonthLock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  const locked = req.body.locked !== false;
  if (!month || !year || month < 1 || month > 12) {
    res.status(400).json({ success: false, message: 'Valid month and year are required.' }); return;
  }
  if (locked) {
    const lock = await FeeMonthLockModel.findOneAndUpdate(
      { month, year, active: true },
      { $set: { _id: `fee_lock_${month}_${year}`, reason: req.body.reason || '', lockedBy: req.user!._id, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await audit(req, 'LOCK_MONTH', 'FeeMonthLock', lock._id, null, lock, req.body.reason || '');
    res.status(200).json({ success: true, locked: true, data: lock });
  } else {
    const before = await FeeMonthLockModel.findOne({ month, year, active: true });
    if (before) {
      before.active = false;
      before.unlockedAt = new Date();
      await before.save();
      await audit(req, 'UNLOCK_MONTH', 'FeeMonthLock', before._id, before.toObject(), { ...before.toObject(), active: false }, req.body.reason || '');
    }
    res.status(200).json({ success: true, locked: false });
  }
}

export async function promoteStudentClass(req: AuthenticatedRequest, res: Response): Promise<void> {
  const student = await StudentModel.findById(req.params.studentId);
  if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return; }
  const classId = req.body.classId;
  const cls = await ClassModel.findById(classId);
  if (!cls) { res.status(400).json({ success: false, message: 'Valid classId is required.' }); return; }
  const before = student.classId;
  student.classId = classId;
  student.className = `${cls.className || cls.name} - ${cls.section}`;
  await student.save();
  const cached = store.findStudentById(student._id);
  if (cached) store.updateStudent(student._id, { classId, className: student.className });
  await audit(req, 'PROMOTE', 'Student', student._id, { classId: before }, { classId });
  res.status(200).json({ success: true, data: student });
}

export async function withdrawStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const student = await StudentModel.findById(req.params.studentId);
  if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return; }
  const vouchers = await FeeVoucherModel.find({ studentId: student._id, status: { $in: ['Draft', 'Unpaid', 'Partial', 'Overdue'] } }).lean();
  const balance = vouchers.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount || 0)), 0);
  student.status = 'Withdrawn';
  await student.save();
  await audit(req, 'WITHDRAW', 'Student', student._id, { status: 'Active' }, { status: 'Withdrawn', balance });
  res.status(200).json({
    success: true,
    warning: balance > 0 ? `Withdrawal has outstanding fees of ${balance}.` : null,
    balance,
    data: student,
  });
}

export async function getStudentBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const vouchers = await FeeVoucherModel.find({ studentId: req.params.studentId, status: { $in: ['Draft', 'Unpaid', 'Partial', 'Overdue'] } }).lean();
  const balance = vouchers.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount || 0)), 0);
  res.status(200).json({ success: true, balance });
}

export async function generateNoDuesCertificate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const student = await StudentModel.findById(req.params.studentId).lean();
  if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return; }
  const vouchers = await FeeVoucherModel.find({ studentId: student._id, status: { $in: ['Draft', 'Unpaid', 'Partial', 'Overdue'] } }).lean();
  const balance = vouchers.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount || 0)), 0);
  if (balance !== 0) { res.status(409).json({ success: false, message: 'No-Dues certificate is unavailable while fees are outstanding.', balance }); return; }
  const pdf = new jsPDF();
  pdf.setFontSize(18);
  pdf.text('NO-DUES CERTIFICATE', 105, 25, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(`Student: ${student.name}`, 20, 50);
  pdf.text(`Student ID: ${student._id}`, 20, 60);
  pdf.text('Outstanding fee balance: 0', 20, 70);
  await audit(req, 'GENERATE_NO_DUES', 'Student', student._id, null, { balance: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="no-dues-${student._id}.pdf"`);
  res.status(200).send(Buffer.from(pdf.output('arraybuffer')));
}

export async function updateAdvancedStructure(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!requireUser(req, res)) return;
  const { id: structureId } = req.params;
  const before = await FeeStructureV2Model.findById(structureId).lean();
  if (!before) { res.status(404).json({ success: false, message: 'Fee structure not found.' }); return; }
  const allowed = ['effectiveFrom', 'heads', 'dueDay', 'lateFineType', 'lateFineAmount'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  const after = await FeeStructureV2Model.findByIdAndUpdate(structureId, update, { new: true, runValidators: true }).lean();
  await audit(req, 'UPDATE', 'FeeStructure', structureId, before, after, req.body.reason || '');
  res.status(200).json({ success: true, data: after });
}

export async function addOpeningBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId, amount, asOfDate, note } = req.body;
  if (!studentId || amount === undefined || !asOfDate) {
    res.status(400).json({ success: false, message: 'studentId, amount and asOfDate are required.' }); return;
  }
  const record = await OpeningBalanceModel.create({
    _id: id('opening_balance'), studentId, amount: Number(amount), asOfDate, note: note || '', importedBy: req.user!._id,
  });
  await audit(req, 'CREATE', 'OpeningBalance', record._id, null, record);
  res.status(201).json({ success: true, data: record });
}

export async function importOpeningBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { csv } = req.body;
  if (typeof csv !== 'string' || !csv.trim()) {
    res.status(400).json({ success: false, message: 'CSV content is required.' }); return;
  }
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift()!.split(',').map((v) => v.trim().toLowerCase());
  const records = [];
  for (const line of lines) {
    const values = line.split(',').map((v) => v.trim());
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] || '']));
    if (!row.studentid || row.amount === undefined) continue;
    records.push(await OpeningBalanceModel.create({
      _id: id('opening_balance'), studentId: row.studentid, amount: Number(row.amount),
      asOfDate: row.asofdate || new Date().toISOString().slice(0, 10), note: row.note || '',
      importedBy: req.user!._id,
    }));
  }
  await audit(req, 'IMPORT', 'OpeningBalance', 'csv', null, { count: records.length });
  res.status(201).json({ success: true, total: records.length, data: records });
}

export async function createAdjustment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId, type, amount, percent, reason } = req.body;
  if (!studentId || !type || !reason || (amount === undefined && percent === undefined)) {
    res.status(400).json({ success: false, message: 'studentId, type, reason and amount or percent are required.' }); return;
  }
  const adjustment = await StudentFeeAdjustmentModel.create({
    _id: id('fee_adjustment'), studentId, type, amount, percent, reason, active: true,
  });
  await audit(req, 'CREATE', 'StudentFeeAdjustment', adjustment._id, null, adjustment, reason);
  res.status(201).json({ success: true, data: adjustment });
}

export async function createOneTimeCharge(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId, classId, name, amount, month, year } = req.body;
  if ((!studentId && !classId) || !name || amount === undefined || !month || !year) {
    res.status(400).json({ success: false, message: 'studentId or classId, name, amount, month and year are required.' }); return;
  }
  const charge = await OneTimeChargeModel.create({
    _id: id('fee_charge'), studentId, classId, name, amount: Number(amount), month: Number(month), year: Number(year),
  });
  await audit(req, 'CREATE', 'OneTimeCharge', charge._id, null, charge, req.body.reason || '');
  res.status(201).json({ success: true, data: charge });
}

async function nextVoucherNumber(month: number, year: number): Promise<string> {
  const prefix = `FV-${year}-${String(month).padStart(2, '0')}-`;
  const latest = await FeeVoucherModel.findOne({ voucherNo: { $regex: `^${prefix}` } }).sort({ voucherNo: -1 }).lean();
  const sequence = latest ? Number(latest.voucherNo.split('-').at(-1)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function generateAdvancedVouchers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { scope = 'all', month, year, sessionId } = req.body;
  if (!month || !year) { res.status(400).json({ success: false, message: 'month and year are required.' }); return; }
  if (!sessionId) { res.status(400).json({ success: false, message: 'sessionId is required.' }); return; }
  if (!['all', 'class', 'student'].includes(scope)) {
    res.status(400).json({ success: false, message: 'scope must be all, class or student.' }); return;
  }
  if (scope === 'class' && !req.body.classId) {
    res.status(400).json({ success: false, message: 'classId is required for class scope.' }); return;
  }
  if (scope === 'student' && !req.body.studentId) {
    res.status(400).json({ success: false, message: 'studentId is required for student scope.' }); return;
  }
  const filter: Record<string, unknown> = {
    $or: [{ archivedAt: '' }, { archivedAt: { $exists: false } }],
  };
  if (scope === 'class') filter.classId = req.body.classId;
  if (scope === 'student') filter._id = req.body.studentId;
  const students = await StudentModel.find(filter).lean();
  const vouchers = [];
  const duplicates: Array<{ studentId: string; month: number; year: number }> = [];
  const skippedStudents: Array<{ studentId: string; name: string; reason: string }> = [];
  for (const student of students) {
    if ((student as any).status === 'Inactive' || (student as any).status === 'Withdrawn' || student.archivedAt) {
      skippedStudents.push({ studentId: student._id, name: student.name, reason: 'Inactive, withdrawn or archived student' });
      continue;
    }
    if (await FeeVoucherModel.exists({ studentId: student._id, month: Number(month), year: Number(year) })) {
      duplicates.push({ studentId: student._id, month: Number(month), year: Number(year) });
      continue;
    }
    const targetDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const structure = await FeeStructureV2Model.findOne({
      sessionId,
      classId: student.classId,
      effectiveFrom: { $lte: targetDate },
    }).sort({ effectiveFrom: -1, version: -1 }).lean();
    if (!structure) {
      skippedStudents.push({ studentId: student._id, name: student.name, reason: 'No fee structure for class/session' });
      continue;
    }
    const firstVoucher = !(await FeeVoucherModel.exists({ studentId: student._id }));
    const opening = firstVoucher ? await OpeningBalanceModel.findOne({ studentId: student._id }).sort({ asOfDate: -1 }).lean() : null;
    const adjustments = await StudentFeeAdjustmentModel.find({ studentId: student._id, active: true }).lean();
    const charges = await OneTimeChargeModel.find({
      month: Number(month), year: Number(year),
      $or: [{ studentId: student._id }, { classId: student.classId }],
    }).lean();
    const items = [
      ...(structure.heads as Array<{ name: string; amount: number }>).map((head) => ({ name: head.name, amount: head.amount })),
      ...charges.map((charge) => ({ name: charge.name, amount: charge.amount })),
    ];
    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const discount = adjustments.reduce((sum, adjustment) => {
      if (adjustment.amount !== undefined) return sum + Number(adjustment.amount);
      return sum + subtotal * Number(adjustment.percent || 0) / 100;
    }, 0);
    const previousVouchers = await FeeVoucherModel.find({
      studentId: student._id,
      status: { $in: ['Draft', 'Unpaid', 'Partial', 'Overdue'] },
      $or: [
        { year: { $lt: Number(year) } },
        { year: Number(year), month: { $lt: Number(month) } },
      ],
    }).sort({ year: 1, month: 1 });
    const arrears = previousVouchers.filter((voucher) => !voucher.carriedForward).map((voucher) => ({
      voucherNo: voucher.voucherNo,
      month: voucher.month,
      year: voucher.year,
      balance: Math.max(0, Number(voucher.total) - Number(voucher.paidAmount || 0) - Number(voucher.fine || 0)),
    })).filter((arrear) => arrear.balance > 0);
    const previousDues = arrears.reduce((sum, arrear) => sum + arrear.balance, 0);
    const lateFines = previousVouchers.reduce((sum, voucher) => sum + Number(voucher.fine || 0), 0);
    const openingValue = Number(opening?.amount || 0);
    const openingBalance = Math.max(0, openingValue);
    const advanceCredit = Math.max(0, -openingValue);
    const total = Math.max(0, subtotal + openingBalance + previousDues + lateFines - discount - advanceCredit);
    const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(structure.dueDay).padStart(2, '0')}`;
    const voucher = await FeeVoucherModel.create({
      _id: id('fee_voucher'), voucherNo: await nextVoucherNumber(Number(month), Number(year)),
      studentId: student._id, parentId: student.parentId, classId: student.classId,
      month: Number(month), year: Number(year), items, arrears, openingBalance,
      discount, fine: lateFines, advanceCredit, total, dueDate, paidAmount: 0, status: 'Draft',
    });
    for (const previous of previousVouchers) {
      if (!previous.carriedForward) {
        previous.carriedForward = true;
        previous.carriedToVoucherId = voucher._id;
        await previous.save();
      }
    }
    vouchers.push(voucher);
  }
  if (duplicates.length > 0 && vouchers.length === 0) {
    res.status(409).json({ success: false, message: 'Vouchers already exist for the requested students and period.', duplicates, data: [] });
    return;
  }
  res.status(201).json({ success: true, total: vouchers.length, skipped: skippedStudents.length, skippedStudents, duplicates, data: vouchers });
}

export async function updateAdvancedVoucher(req: AuthenticatedRequest, res: Response): Promise<void> {
  const before = await FeeVoucherModel.findById(req.params.id);
  if (!before) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  if (await FeeMonthLockModel.exists({ month: before.month, year: before.year, active: true })) {
    res.status(409).json({ success: false, message: 'This fee month is locked.' }); return;
  }
  if (before.status !== 'Draft') { res.status(409).json({ success: false, message: 'Only Draft vouchers can be edited.' }); return; }
  const allowed = ['items', 'openingBalance', 'fine', 'discount', 'advanceCredit', 'dueDate'];
  for (const key of allowed) if (req.body[key] !== undefined) (before as any)[key] = req.body[key];
  before.total = Math.max(0,
    (before.items as any[]).reduce((sum, item) => sum + Number(item.amount), 0)
    + Number(before.openingBalance) + Number(before.fine) - Number(before.discount) - Number(before.advanceCredit));
  await before.save();
  await audit(req, 'UPDATE', 'FeeVoucher', before._id, before.toObject(), before.toObject(), req.body.reason || '');
  res.status(200).json({ success: true, data: before });
}

async function notifyStudentAndParent(
  studentId: string,
  voucherId: string,
  type: string,
  title: string,
  message: string,
): Promise<void> {
  const student = await StudentModel.findById(studentId).lean();
  if (!student) return;
  for (const userId of ([student.userId, student.parentId].filter(Boolean) as string[])) {
    await NotificationModel.create({
      _id: id('notification'), userId, role: userId === student.userId ? 'student' : 'parent',
      type, title, message: `${message} Student: ${student.name}.`, voucherId, read: false, isRead: false,
    });
  }
}

export async function publishVoucher(req: AuthenticatedRequest, res: Response): Promise<void> {
  const voucher = await FeeVoucherModel.findById(req.params.id);
  if (!voucher) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  if (voucher.status !== 'Draft') { res.status(409).json({ success: false, message: 'Voucher is not a Draft.' }); return; }
  voucher.status = 'Unpaid';
  voucher.publishedAt = new Date().toISOString();
  await voucher.save();
  await audit(req, 'PUBLISH', 'FeeVoucher', voucher._id, null, voucher);
  const student = await StudentModel.findById(voucher.studentId).lean();
  if (req.user?.role === 'student' && student?.userId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied.' }); return;
  }
  if (req.user?.role === 'parent' && student?.parentId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied.' }); return;
  }
  await notifyStudentAndParent(voucher.studentId, voucher._id, 'new_voucher',
    'New fee voucher', `New fee voucher for ${student?.name || 'Student'} - ${voucher.month}/${voucher.year}`);
  res.status(200).json({ success: true, data: voucher });
}

export async function publishBulkVouchers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  let published = 0;
  for (const voucherId of ids) {
    const voucher = await FeeVoucherModel.findById(voucherId);
    if (!voucher || voucher.status !== 'Draft') continue;
    voucher.status = 'Unpaid';
    voucher.publishedAt = new Date().toISOString();
    await voucher.save();
    await audit(req, 'PUBLISH', 'FeeVoucher', voucher._id, null, voucher);
    await notifyStudentAndParent(voucher.studentId, voucher._id, 'new_voucher', 'New fee voucher',
      `New fee voucher for ${voucher.month}/${voucher.year}`);
    published++;
  }
  res.status(200).json({ success: true, published });
}

export async function cancelVoucher(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.body.reason?.trim()) { res.status(400).json({ success: false, message: 'Cancellation reason is required.' }); return; }
  const before = await FeeVoucherModel.findById(req.params.id);
  if (!before) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  if (await FeeMonthLockModel.exists({ month: before.month, year: before.year, active: true })) {
    res.status(409).json({ success: false, message: 'This fee month is locked.' }); return;
  }
  before.status = 'Cancelled';
  before.cancelReason = req.body.reason.trim();
  await before.save();
  await audit(req, 'CANCEL', 'FeeVoucher', before._id, null, before, before.cancelReason);
  res.status(200).json({ success: true, data: before });
}

export async function listAdvancedVouchers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { class: classId, month, status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (classId) filter.classId = classId;
  if (month) filter.month = Number(month);
  if (status) filter.status = status;
  if (req.user?.role === 'student') {
    const student = await StudentModel.findOne({ userId: req.user._id }).lean();
    filter.studentId = student?._id || '__none__';
  } else if (req.user?.role === 'parent') {
    const children = await StudentModel.find({ parentId: req.user._id }).lean();
    filter.studentId = { $in: children.map((child) => child._id) };
  }
  const data = await FeeVoucherModel.find(filter).sort({ year: -1, month: -1 }).lean();
  res.status(200).json({ success: true, data });
}

export async function advancedVoucherPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  const voucher = await FeeVoucherModel.findById(req.params.id).lean();
  if (!voucher) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  const student = await StudentModel.findById(voucher.studentId).lean();
  const [schoolClass, parent, payments] = await Promise.all([
    ClassModel.findById(voucher.classId).lean(),
    student?.parentId ? UserModel.findById(student.parentId).lean() : null,
    FeePaymentModelV2.find({ voucherId: voucher._id, reversed: false }).sort({ date: 1 }).lean(),
  ]);
  const doc = new jsPDF();
  const schoolName = process.env.SCHOOL_NAME || 'EduManage School';
  doc.setFontSize(18);
  doc.text(schoolName, 105, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.text('OFFICIAL FEE VOUCHER', 105, 26, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Voucher No: ${voucher.voucherNo}`, 14, 40);
  doc.text(`Student: ${student?.name || '-'}`, 14, 48);
  doc.text(`Class: ${(schoolClass as any)?.name || voucher.classId}  Roll No: ${student?.rollNo || '-'}`, 14, 56);
  doc.text(`Parent: ${(parent as any)?.name || '-'}`, 14, 64);
  doc.text(`Billing Period: ${voucher.month}/${voucher.year}  Due Date: ${voucher.dueDate}`, 14, 72);
  let y = 86;
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMIZED FEES', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  for (const item of (voucher.items || []) as Array<{ name?: string; amount?: number }>) {
    doc.text(item.name || 'Fee', 14, y);
    doc.text(Number(item.amount || 0).toFixed(2), 196, y, { align: 'right' });
    y += 7;
  }
  doc.text('Arrears', 14, y);
  doc.text((voucher.arrears || []).map((item: any) => `${item.month}/${item.year}: ${Number(item.balance || 0).toFixed(2)}`).join('; ') || 'None', 196, y, { align: 'right', maxWidth: 110 });
  y += 8;
  doc.text(`Opening Balance: ${Number(voucher.openingBalance || 0).toFixed(2)}`, 14, y);
  y += 7;
  doc.text(`Fine: ${Number(voucher.fine || 0).toFixed(2)}`, 14, y);
  doc.text(`Discount: ${Number(voucher.discount || 0).toFixed(2)}`, 196, y, { align: 'right' });
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${Number(voucher.total || 0).toFixed(2)}`, 14, y);
  doc.text(`PAID: ${Number(voucher.paidAmount || 0).toFixed(2)}`, 196, y, { align: 'right' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`Bank: ${process.env.SCHOOL_BANK_NAME || 'Bank details not configured'}`, 14, y);
  doc.text(`Account: ${process.env.SCHOOL_BANK_ACCOUNT || '-'}`, 14, y + 7);
  doc.text(`Voucher barcode/code: ${voucher.voucherNo}`, 14, y + 18);
  doc.rect(14, y + 21, 182, 12);
  doc.setFont('courier', 'bold');
  doc.text(voucher.voucherNo.replace(/./g, '$& '), 105, y + 29, { align: 'center' });
  const qrDataUrl = await QRCode.toDataURL(voucher.voucherNo, { width: 160, margin: 1 });
  doc.addImage(qrDataUrl, 'PNG', 170, y + 20, 26, 26);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${voucher.voucherNo}.pdf"`);
  res.status(200).send(Buffer.from(doc.output('arraybuffer')));
}

export async function createAdvancedPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { voucherId, amount, mode, referenceNo, date } = req.body;
  const voucher = await FeeVoucherModel.findById(voucherId);
  if (!voucher) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  if (await FeeMonthLockModel.exists({ month: voucher.month, year: voucher.year, active: true })) {
    res.status(409).json({ success: false, message: 'This fee month is locked.' }); return;
  }
  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' }); return;
  }
  const studentBalance = await FeeVoucherModel.find({
    studentId: voucher.studentId,
    status: { $in: ['Unpaid', 'Partial', 'Overdue'] },
  }).lean();
  const totalBalance = studentBalance.reduce((sum, item) => sum + Math.max(0, Number(item.total) - Number(item.paidAmount)), 0);
  if (paymentAmount > totalBalance) { res.status(400).json({ success: false, message: 'Payment exceeds the student outstanding balance.' }); return; }
  const receiptNo = `RCPT-${new Date().getFullYear()}-${Date.now()}`;
  const payment = await FeePaymentModelV2.create({
    _id: id('fee_payment'), voucherId, studentId: voucher.studentId, amount: paymentAmount,
    mode, date: date || new Date().toISOString().slice(0, 10), receiptNo, recordedBy: req.user!._id,
  });
  let remaining = paymentAmount;
  const allocations = await FeeVoucherModel.find({
    studentId: voucher.studentId,
    status: { $in: ['Unpaid', 'Partial', 'Overdue'] },
  }).sort({ year: 1, month: 1 }).exec();
  const appliedVoucherIds: string[] = [];
  for (const target of allocations) {
    if (remaining <= 0) break;
    const outstanding = Math.max(0, Number(target.total) - Number(target.paidAmount));
    const applied = Math.min(outstanding, remaining);
    if (applied > 0) {
      target.paidAmount = Number(target.paidAmount) + applied;
      target.status = target.paidAmount >= target.total ? 'Paid' : 'Partial';
      await target.save();
      appliedVoucherIds.push(target._id);
      remaining -= applied;
    }
  }
  await audit(req, 'PAYMENT', 'FeeVoucher', voucher._id, null, { voucher, payment });
  await notifyStudentAndParent(voucher.studentId, voucher._id, 'payment_received', 'Payment received',
    `Payment ${receiptNo} of ${paymentAmount} received.`);
  res.status(201).json({ success: true, data: { payment, voucher } });
}

export async function reversePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.body.reason?.trim()) { res.status(400).json({ success: false, message: 'Reversal reason is required.' }); return; }
  const payment = await FeePaymentModelV2.findById(req.params.id);
  if (!payment || payment.reversed) { res.status(404).json({ success: false, message: 'Active payment not found.' }); return; }
  const voucher = await FeeVoucherModel.findById(payment.voucherId);
  if (!voucher) { res.status(404).json({ success: false, message: 'Payment voucher not found.' }); return; }
  if (await FeeMonthLockModel.exists({ month: voucher.month, year: voucher.year, active: true })) {
    res.status(409).json({ success: false, message: 'This fee month is locked.' }); return;
  }
  const before = payment.toObject();
  payment.reversed = true;
  payment.reversalReason = req.body.reason.trim();
  payment.reversedBy = req.user!._id;
  await payment.save();
  voucher.paidAmount = Math.max(0, Number(voucher.paidAmount) - Number(payment.amount));
  voucher.status = voucher.paidAmount >= voucher.total ? 'Paid' : voucher.paidAmount > 0 ? 'Partial' : 'Unpaid';
  await voucher.save();
  const affectedLater = await FeeVoucherModel.find({
    studentId: payment.studentId,
    publishedAt: { $exists: true },
    $or: [{ year: { $gt: voucher.year } }, { year: voucher.year, month: { $gt: voucher.month } }],
  }).sort({ year: 1, month: 1 });
  for (const later of affectedLater) {
    later.adminReviewRequired = true;
    await later.save();
  }
  const laterVouchers = await FeeVoucherModel.find({
    studentId: payment.studentId,
    publishedAt: { $exists: true },
    _id: { $ne: voucher?._id },
  }).sort({ year: 1, month: 1 });
  for (const later of laterVouchers) {
    later.adminReviewRequired = true;
    await later.save();
  }
  await audit(req, 'REVERSE', 'FeePayment', payment._id, before, payment.toObject(), payment.reversalReason);
  res.status(200).json({ success: true, data: payment });
}

export async function createProof(req: AuthenticatedRequest, res: Response): Promise<void> {
  const upload = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
  const { voucherId, amount, mode, referenceNo } = req.body;
  if (!upload || !voucherId || !amount || !mode || !referenceNo) {
    res.status(400).json({ success: false, message: 'voucherId, amount, mode, referenceNo and proof file are required.' }); return;
  }
  const voucher = await FeeVoucherModel.findById(voucherId).lean();
  const studentId = voucher?.studentId;
  if (!voucher || !studentId) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  let ownsVoucher: unknown = false;
  if (req.user?.role === 'student') {
    ownsVoucher = await StudentModel.exists({ _id: studentId, userId: req.user._id });
  } else if (req.user?.role === 'parent') {
    ownsVoucher = await StudentModel.exists({ _id: studentId, parentId: req.user._id });
  }
  if (!ownsVoucher) { res.status(403).json({ success: false, message: 'This voucher is not linked to your account.' }); return; }
  if (await PaymentProofModel.exists({ referenceNo })) {
    res.status(409).json({ success: false, message: 'A payment proof with this reference number already exists.' }); return;
  }
  const proof = await PaymentProofModel.create({
    _id: id('payment_proof'), voucherId, studentId, uploadedBy: req.user!._id,
    fileUrl: `/uploads/fee-proofs/${upload.filename}`, amount: Number(amount), mode, referenceNo, status: 'Pending',
  });
  res.status(201).json({ success: true, data: proof });
}

export async function listProofs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.user?.role === 'student') {
    const student = await StudentModel.findOne({ userId: req.user._id }).lean();
    if (student) filter.studentId = student._id;
    else filter.studentId = '__none__';
  } else if (req.user?.role === 'parent') {
    const children = await StudentModel.find({ parentId: req.user._id }).lean();
    filter.studentId = { $in: children.map((child) => child._id) };
  }
  const data = await PaymentProofModel.find(filter).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, data });
}

export async function reviewProof(req: AuthenticatedRequest, res: Response): Promise<void> {
  const approved = req.path.endsWith('/approve');
  const proof = await PaymentProofModel.findById(req.params.id);
  if (!proof) { res.status(404).json({ success: false, message: 'Proof not found.' }); return; }
  if (proof.status !== 'Pending') { res.status(409).json({ success: false, message: 'Payment proof has already been reviewed.' }); return; }
  if (approved && await FeePaymentModelV2.exists({ referenceNo: proof.referenceNo })) {
    res.status(409).json({ success: false, message: 'A payment with this reference number already exists.' }); return;
  }
  if (!approved && !req.body.reason?.trim()) {
    res.status(400).json({ success: false, message: 'Rejection reason is required.' }); return;
  }
  proof.status = approved ? 'Approved' : 'Rejected';
  proof.reviewedBy = req.user!._id;
  proof.rejectReason = approved ? '' : req.body.reason.trim();
  await proof.save();
  if (approved) {
    const voucher = await FeeVoucherModel.findById(proof.voucherId);
    if (voucher) {
      const receiptNo = `RCPT-${new Date().getFullYear()}-${Date.now()}`;
      await FeePaymentModelV2.create({
        _id: id('fee_payment'), voucherId: voucher._id, studentId: voucher.studentId,
        amount: proof.amount, mode: proof.mode, date: new Date().toISOString().slice(0, 10),
        receiptNo, referenceNo: proof.referenceNo, recordedBy: req.user!._id,
      });
      voucher.paidAmount = Number(voucher.paidAmount) + Number(proof.amount);
      voucher.status = voucher.paidAmount >= voucher.total ? 'Paid' : 'Partial';
      await voucher.save();
      await notifyStudentAndParent(voucher.studentId, voucher._id, 'proof_approved', 'Payment proof approved',
        `Payment proof of ${proof.amount} was approved.`);
    }
  } else {
    await notifyStudentAndParent(proof.studentId, proof.voucherId, 'proof_rejected', 'Payment proof rejected',
      `Payment proof was rejected: ${proof.rejectReason}`);
  }
  await audit(req, approved ? 'APPROVE_PROOF' : 'REJECT_PROOF', 'PaymentProof', proof._id, null, proof);
  res.status(200).json({ success: true, data: proof });
}

export async function getDefaultersAdvanced(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await FeeVoucherModel.find({ status: { $in: ['Unpaid', 'Partial', 'Overdue'] } }).lean();
  res.status(200).json({ success: true, data, totalDue: data.reduce((sum, v) => sum + Number(v.total) - Number(v.paidAmount), 0) });
}

export async function sendFeeReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const vouchers = await FeeVoucherModel.find({ status: { $in: ['Unpaid', 'Partial', 'Overdue'] }, dueDate: { $lte: today } }).lean();
  for (const voucher of vouchers) {
    await notifyStudentAndParent(voucher.studentId, voucher._id, 'overdue', 'Fee reminder', 'Your fee voucher is due.');
  }
  res.status(200).json({ success: true, sent: vouchers.length });
}

export async function waiveFine(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.body.reason?.trim()) { res.status(400).json({ success: false, message: 'Waiver reason is required.' }); return; }
  const voucher = await FeeVoucherModel.findById(req.params.voucherId);
  if (!voucher) { res.status(404).json({ success: false, message: 'Voucher not found.' }); return; }
  const before = voucher.toObject();
  const reduction = req.body.amount === undefined
    ? Number(voucher.fine)
    : Math.min(Number(voucher.fine), Math.max(0, Number(req.body.amount)));
  voucher.fine = Math.max(0, Number(voucher.fine) - reduction);
  voucher.total = Math.max(0, Number(voucher.total) - reduction);
  await voucher.save();
  await audit(req, 'WAIVE_FINE', 'FeeVoucher', voucher._id, before, voucher.toObject(), req.body.reason.trim());
  res.status(200).json({ success: true, data: voucher });
}

export async function getLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
  const studentId = req.params.studentId;
  const [vouchers, payments] = await Promise.all([
    FeeVoucherModel.find({ studentId }).sort({ year: 1, month: 1 }).lean(),
    FeePaymentModelV2.find({ studentId, reversed: false }).sort({ date: 1 }).lean(),
  ]);
  res.status(200).json({ success: true, data: { vouchers, payments } });
}

export async function getLedgerPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  const student = await StudentModel.findById(req.params.studentId).lean();
  if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return; }
  const vouchers = await FeeVoucherModel.find({ studentId: student._id }).lean();
  res.setHeader('Content-Type', 'application/pdf');
  res.status(200).send(Buffer.from(`%PDF-1.4\nFee Ledger\n${student.name}\nVouchers: ${vouchers.length}`));
}

export async function getFeeReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const vouchers = await FeeVoucherModel.find({}).lean();
  const payments = await FeePaymentModelV2.find({ reversed: false }).lean();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const collectedThisMonth = payments
    .filter((payment) => new Date(payment.date) >= monthStart)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstanding = vouchers.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount)), 0);
  const overdue = vouchers
    .filter((voucher) => voucher.status === 'Overdue')
    .reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount)), 0);
  const report = {
    success: true,
    data: {
      voucherCount: vouchers.length,
      collected: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      collectedThisMonth,
      outstanding,
      overdue,
      defaulterCount: vouchers.filter((voucher) => voucher.status === 'Overdue').length,
      collectionPercentage: outstanding + collectedThisMonth > 0
        ? Math.round((collectedThisMonth / (collectedThisMonth + outstanding)) * 100)
        : 0,
      byStatus: vouchers.reduce<Record<string, number>>((counts, voucher) => {
        counts[voucher.status] = (counts[voucher.status] || 0) + 1;
        return counts;
      }, {}),
    },
  };
  if (String(req.query.format || '').toLowerCase() === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fee Report');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 24 },
      { header: 'Value', key: 'value', width: 24 },
    ];
    sheet.addRows([
      { metric: 'Voucher count', value: report.data.voucherCount },
      { metric: 'Collected', value: report.data.collected },
      { metric: 'Collected this month', value: report.data.collectedThisMonth },
      { metric: 'Outstanding', value: report.data.outstanding },
      { metric: 'Overdue', value: report.data.overdue },
      { metric: 'Collection percentage', value: report.data.collectionPercentage },
      { metric: 'Defaulters', value: report.data.defaulterCount },
    ]);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fee-report.xlsx"');
    res.status(200).send(await workbook.xlsx.writeBuffer());
    return;
  }
  res.status(200).json(report);
}

export async function getFeeAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await FeeAuditLogModel.find({}).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, data });
}

export async function getStudentFees(req: AuthenticatedRequest, res: Response): Promise<void> {
  const studentId = req.params.studentId;
  if (req.user?.role === 'student') {
    const student = await StudentModel.findOne({ _id: studentId, userId: req.user._id }).lean();
    if (!student) { res.status(403).json({ success: false, message: 'Access denied.' }); return; }
  }
  if (req.user?.role === 'parent') {
    const linked = await StudentModel.exists({ _id: studentId, parentId: req.user._id });
    if (!linked) { res.status(403).json({ success: false, message: 'Access denied.' }); return; }
  }
  const vouchers = await FeeVoucherModel.find({ studentId }).sort({ year: -1, month: -1 }).lean();
  const payments = await FeePaymentModelV2.find({ studentId, reversed: false }).sort({ date: -1 }).lean();
  res.status(200).json({
    success: true,
    data: {
      vouchers,
      pending: vouchers.filter((voucher) => ['Draft', 'Unpaid', 'Partial'].includes(voucher.status)),
      overdue: vouchers.filter((voucher) => voucher.status === 'Overdue'),
      payments,
    },
  });
}

export async function getParentChildrenFees(req: AuthenticatedRequest, res: Response): Promise<void> {
  const children = await StudentModel.find({ parentId: req.user!._id }).lean();
  const data = [];
  for (const child of children) {
    const vouchers = await FeeVoucherModel.find({ studentId: child._id }).sort({ year: -1, month: -1 }).lean();
    const payments = await FeePaymentModelV2.find({ studentId: child._id, reversed: false }).sort({ date: -1 }).lean();
    const dues = vouchers.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount)), 0);
    const overdue = vouchers
      .filter((voucher) => voucher.status === 'Overdue')
      .reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total) - Number(voucher.paidAmount)), 0);
    data.push({
      student: child,
      vouchers,
      payments,
      dues,
      overdue,
      pending: Math.max(0, dues - overdue),
    });
  }
  res.status(200).json({ success: true, data });
}
