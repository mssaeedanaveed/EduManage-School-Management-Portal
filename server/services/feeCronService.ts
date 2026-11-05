import cron from 'node-cron';
import store from '../data/store.js';
import mongoose from 'mongoose';
import { FeeStructureV2Model, FeeVoucherModel, StudentModel, NotificationModel, UserModel } from '../models/index.js';

export async function runAdvancedFeeJobs(now = new Date(), reminderIntervalDays = 7) {
  let overdueUpdatedCount = 0;
  let remindersSentCount = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const vouchers = await FeeVoucherModel.find({ status: { $in: ['Unpaid', 'Partial', 'Overdue', 'Draft'] } });
  for (const voucher of vouchers) {
    if (!voucher.publishedAt || Number(voucher.paidAmount) >= Number(voucher.total)) continue;
    const due = new Date(`${voucher.dueDate}T00:00:00`);
    if (today <= due) continue;
    const student = await StudentModel.findById(voucher.studentId).lean();
    if (!student) continue;
    if (voucher.status !== 'Overdue' || Number(voucher.fine || 0) === 0) {
      voucher.status = 'Overdue';
      if (Number(voucher.fine || 0) === 0) {
        voucher.fine = 200;
        voucher.total = Number(voucher.total || 0) + 200;
      }
      await voucher.save();
      overdueUpdatedCount++;
    }
    const overdueDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
    const shouldRemind = voucher.status === 'Overdue' && overdueDays >= 1;
    if (!shouldRemind) continue;
    const recipients = [student.userId, student.parentId].filter(Boolean) as string[];
    for (const userId of recipients) {
      const latest = await NotificationModel.findOne({
        userId, voucherId: voucher._id, type: 'overdue',
      }).sort({ createdAt: -1 }).lean();
      const exists = latest && Math.floor((today.getTime() - new Date(latest.createdAt).getTime()) / 86400000) < 7;
      if (exists) continue;
      await NotificationModel.create({
        _id: `notification_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userId, role: userId === student.parentId ? 'parent' : 'student',
        type: 'overdue', voucherId: voucher._id, read: false,
        title: 'Fee Voucher Overdue',
        message: `Fee voucher ${voucher.voucherNo} for ${student.name} is overdue.`,
        createdAt: today,
      });
      remindersSentCount++;
    }
  }
  return { success: true, timestamp: today.toISOString(), overdueUpdatedCount, remindersSentCount };
}

/**
 * Core engine for running daily fee voucher tasks & automated notifications
 */
export function runFeeJobs(): {
  success: boolean;
  timestamp: string;
  overdueUpdatedCount: number;
  remindersSentCount: number;
  adminAlertCreated: boolean;
  message: string;
} {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let overdueUpdatedCount = 0;
  let remindersSentCount = 0;
  let adminAlertCreated = false;

  // 1. Identify current and next month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();
  const nextMonthIdx = (currentMonthIdx + 1) % 12;
  const nextYear = currentMonthIdx === 11 ? currentYear + 1 : currentYear;
  const nextMonthName = `${monthNames[nextMonthIdx]} ${nextYear}`;

  // 2. Admin Alert: 5 days before each month starts, alert if vouchers not yet generated
  // A month has 28 to 31 days. Check if day of month >= 24 or 25
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const daysUntilNextMonth = daysInMonth - currentDay;

  const nextMonthVouchersExist = store.feePayments.some(
    (p) => p.month === nextMonthName
  );

  // Trigger alert if <= 5 days before month start OR if test forced and not generated yet
  if (daysUntilNextMonth <= 5 && !nextMonthVouchersExist) {
    const adminUsers = store.getUsers().filter((u) => u.role === 'admin');
    for (const admin of adminUsers) {
      const alreadySent = store.hasNotificationToday(admin._id, 'fee_monthly_alert');
      if (!alreadySent) {
        store.createNotification({
          userId: admin._id,
          role: 'admin',
          type: 'fee_monthly_alert',
          title: 'Fee Vouchers Ready to Generate',
          message: `Fee vouchers for ${nextMonthName} are ready to be generated and sent.`,
          link: '/fees',
          isRead: false,
          metadata: { nextMonth: nextMonthName },
        });
        adminAlertCreated = true;
        remindersSentCount++;
      }
    }
  }

  // 3. Process all vouchers: check due dates, update to Overdue, and dispatch student & parent notifications
  const unpaidVouchers = store.feePayments.filter((p) => p.status !== 'Paid');

  for (const v of unpaidVouchers) {
    const student = store.findStudentById(v.studentId);
    if (!student) continue;

    // Difference in days between dueDate and today
    // positive = future (e.g. 3 days left), 0 = today, negative = overdue (e.g. -1 is 1 day overdue)
    const dueTime = new Date(`${v.dueDate}T00:00:00`).getTime();
    const todayTime = new Date(`${todayStr}T00:00:00`).getTime();
    const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));

    // A. Overdue Check: after due date, update status to Overdue
    if (diffDays < 0) {
      if (v.status !== 'Overdue') {
        v.status = 'Overdue';
        overdueUpdatedCount++;
      }

      // Overdue reminder: repeat every 3 days until paid
      const daysOverdue = Math.abs(diffDays);
      const isOverdueTriggerDay = daysOverdue === 1 || daysOverdue % 3 === 0;

      if (isOverdueTriggerDay) {
        // Student reminder
        if (student.userId && !store.hasNotificationToday(student.userId, 'fee_overdue', v.voucherNo)) {
          store.createNotification({
            userId: student.userId,
            role: 'student',
            type: 'fee_overdue',
            title: 'Fee Voucher Overdue',
            message: `Your fee voucher for ${v.month} is overdue (due ${v.dueDate}). Please pay as soon as possible.`,
            link: '/fees',
            isRead: false,
            metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate },
          });
          remindersSentCount++;
        }

        // Parent reminder
        if (student.parentId && !store.hasNotificationToday(student.parentId, 'fee_overdue', v.voucherNo)) {
          store.createNotification({
            userId: student.parentId,
            role: 'parent',
            type: 'fee_overdue',
            title: 'Fee Voucher Overdue',
            message: `Your fee voucher for ${v.month} for ${student.name} is overdue (due ${v.dueDate}). Please pay as soon as possible.`,
            link: '/fees',
            isRead: false,
            metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate, studentId: student._id },
          });
          remindersSentCount++;
        }
      }
    }

    // B. 3 Days Before Due Date reminder
    else if (diffDays === 3) {
      if (student.userId && !store.hasNotificationToday(student.userId, 'fee_due_3days', v.voucherNo)) {
        store.createNotification({
          userId: student.userId,
          role: 'student',
          type: 'fee_due_3days',
          title: 'Fee Due Soon',
          message: `Fee due soon: pay your ${v.month} voucher by ${v.dueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate },
        });
        remindersSentCount++;
      }

      if (student.parentId && !store.hasNotificationToday(student.parentId, 'fee_due_3days', v.voucherNo)) {
        store.createNotification({
          userId: student.parentId,
          role: 'parent',
          type: 'fee_due_3days',
          title: 'Fee Due Soon',
          message: `Fee due soon: pay your ${v.month} voucher for ${student.name} by ${v.dueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate, studentId: student._id },
        });
        remindersSentCount++;
      }
    }

    // C. 1 Day Before Due Date and On Due Date (diffDays === 1 or 0)
    else if (diffDays === 1 || diffDays === 0) {
      const typeKey = diffDays === 0 ? 'fee_due_today' : 'fee_due_1day';
      const title = diffDays === 0 ? 'Fee Due Today' : 'Fee Due Tomorrow';

      if (student.userId && !store.hasNotificationToday(student.userId, typeKey, v.voucherNo)) {
        store.createNotification({
          userId: student.userId,
          role: 'student',
          type: typeKey,
          title,
          message: `Fee reminder: pay your ${v.month} voucher by ${v.dueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate },
        });
        remindersSentCount++;
      }

      if (student.parentId && !store.hasNotificationToday(student.parentId, typeKey, v.voucherNo)) {
        store.createNotification({
          userId: student.parentId,
          role: 'parent',
          type: typeKey,
          title,
          message: `Fee reminder: pay your ${v.month} voucher for ${student.name} by ${v.dueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo: v.voucherNo, month: v.month, dueDate: v.dueDate, studentId: student._id },
        });
        remindersSentCount++;
      }
    }
  }

  // 4. Admin summary of overdue vouchers
  const overdueList = store.feePayments.filter((p) => p.status === 'Overdue');
  if (overdueList.length > 0) {
    const adminUsers = store.getUsers().filter((u) => u.role === 'admin');
    const totalOverdueAmount = overdueList.reduce((sum, p) => sum + (p.balance || 0), 0);

    for (const admin of adminUsers) {
      if (!store.hasNotificationToday(admin._id, 'fee_overdue_summary')) {
        store.createNotification({
          userId: admin._id,
          role: 'admin',
          type: 'fee_overdue_summary',
          title: 'Overdue Fee Notice',
          message: `${overdueList.length} students have overdue fee vouchers totaling $${totalOverdueAmount}.`,
          link: '/fees',
          isRead: false,
          metadata: { count: overdueList.length, total: totalOverdueAmount },
        });
        remindersSentCount++;
      }
    }
  }

  return {
    success: true,
    timestamp: todayStr,
    overdueUpdatedCount,
    remindersSentCount,
    adminAlertCreated,
    message: `Fee jobs completed: ${overdueUpdatedCount} updated to overdue, ${remindersSentCount} notifications processed.`,
  };
}

/**
 * Initialize daily cron schedule at 08:00 AM every morning
 */
export function initCronJobs(): void {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    console.log('[FeeCron] Running daily fee voucher check at 08:00 AM...');
    try {
      const result = runFeeJobs();
      console.log('[FeeCron] Job result:', result.message);
    } catch (e: any) {
      console.error('[FeeCron] Error running daily fee cron:', e.message);
    }
  });
  cron.schedule('30 8 * * *', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const vouchers = await FeeVoucherModel.find({
      status: { $in: ['Unpaid', 'Partial', 'Overdue'] },
    }).lean();
    for (const voucher of vouchers) {
      const due = new Date(`${voucher.dueDate}T00:00:00`);
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      const student = await StudentModel.findById(voucher.studentId).lean();
      if (!student) continue;
      if (days < 0 && voucher.status !== 'Overdue') {
        const structure = await FeeStructureV2Model.findOne({ classId: voucher.classId }).sort({ version: -1 }).lean();
        const fine = structure?.lateFineType === 'percent'
          ? Number(voucher.total) * Number(structure.lateFineAmount || 0) / 100
          : Number(structure?.lateFineAmount || 0);
        await FeeVoucherModel.updateOne({ _id: voucher._id }, {
          status: 'Overdue',
          fine: Number(voucher.fine || 0) + (Number(voucher.fine || 0) === 0 ? fine : 0),
          total: Number(voucher.total) + (Number(voucher.fine || 0) === 0 ? fine : 0),
        });
      }
      const daysOverdue = Math.abs(days);
      if (days === 3 || days < 0 && (daysOverdue === 1 || daysOverdue % 7 === 0)) {
        const type = days === 3 ? 'due_soon' : 'overdue';
        for (const recipient of [{ id: student.userId, role: 'student' }, { id: student.parentId, role: 'parent' }]) {
          if (!recipient.id) continue;
          await NotificationModel.create({
            _id: `fee_notification_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: recipient.id, role: recipient.role, type, title: days === 3 ? 'Fee due soon' : 'Fee overdue',
            message: `${days === 3 ? 'Fee is due soon' : 'Fee is overdue'} for ${student.name}.`, voucherId: voucher._id,
            read: false, isRead: false, createdAt: new Date(), updatedAt: new Date(),
          });
        }
      }
    }
  });

  console.log('[FeeCron] Automated daily fee cron job scheduled (08:00 AM daily).');
}

export default { runFeeJobs, initCronJobs };
