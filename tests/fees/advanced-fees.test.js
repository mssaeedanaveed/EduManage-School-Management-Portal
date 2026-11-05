import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

let app;
let models;
let runAdvancedFeeJobs;
let NotificationModel;
const JWT_SECRET = process.env.JWT_SECRET || 'edumanage-secret-jwt-key-2026-production';
const headers = (email) => {
  const user = global.__TEST_USERS__[email];
  return { Authorization: `Bearer ${jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET)}` };
};

beforeAll(async () => {
  const server = await import('../../server/app.ts');
  app = server.createServerApp();
  models = await import('../../server/models/FeeModule.ts');
  const notificationModels = await import('../../server/models/Notification.ts');
  NotificationModel = notificationModels.NotificationModel;
  const cron = await import('../../server/services/feeCronService.ts');
  runAdvancedFeeJobs = cron.runAdvancedFeeJobs;
});

beforeEach(async () => {
  await Promise.all(Object.values({
    vouchers: models.FeeVoucherModel, payments: models.FeePaymentModelV2, proofs: models.PaymentProofModel,
    locks: models.FeeMonthLockModel, notifications: NotificationModel, audit: models.FeeAuditLogModel,
    structures: models.FeeStructureV2Model,
  }).map((model) => model.deleteMany({})));
});

async function structure(classId = 'TEST_CLASS_A', amount = 5000) {
  const response = await request(app).post('/api/fees/structure').set(headers('test.admin@school.local')).send({
    sessionId: 'TEST-2026', classId, effectiveFrom: '2026-01-01',
    heads: [{ name: 'Tuition', amount }], dueDay: 10, lateFineType: 'fixed', lateFineAmount: 200,
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

async function generate(studentId, month, year = 2026) {
  const response = await request(app).post('/api/fees/vouchers/generate').set(headers('test.admin@school.local')).send({
    scope: 'student', studentId, sessionId: 'TEST-2026', month, year,
  });
  return response;
}

test('carry-forward across three months has exact arrears and no duplicate links', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  let generatedMonth = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 1 });
  await request(app).patch(`/api/fees/vouchers/${generatedMonth._id}/publish`).set(headers('test.admin@school.local'));
  await runAdvancedFeeJobs(new Date('2026-01-11T00:00:00Z'));
  await generate('TEST_STUDENT_A', 2);
  generatedMonth = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 2 });
  await request(app).patch(`/api/fees/vouchers/${generatedMonth._id}/publish`).set(headers('test.admin@school.local'));
  await runAdvancedFeeJobs(new Date('2026-02-11T00:00:00Z'));
  await generate('TEST_STUDENT_A', 3);
  const vouchers = await models.FeeVoucherModel.find({ studentId: 'TEST_STUDENT_A' }).sort({ month: 1 }).lean();
  expect(vouchers.map((voucher) => voucher.total)).toEqual([5200, 10200, 15400]);
  expect(vouchers[0].carriedForward).toBe(true);
  expect(vouchers[0].carriedToVoucherId).toBe(vouchers[1]._id);
});

test('partial payment and oldest-payment ordering use exact balances', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  let [month1] = await models.FeeVoucherModel.find({ studentId: 'TEST_STUDENT_A' }).lean();
  await request(app).patch(`/api/fees/vouchers/${month1._id}/publish`).set(headers('test.admin@school.local'));
  const partial = await request(app).post('/api/fees/payments').set(headers('test.admin@school.local')).send({
    voucherId: month1._id, amount: 3000, mode: 'cash', date: '2026-01-11', referenceNo: 'ADV-PARTIAL',
  });
  expect(partial.status).toBe(201);
  month1 = await models.FeeVoucherModel.findById(month1._id).lean();
  expect(month1.paidAmount).toBe(3000);
  expect(month1.total - month1.paidAmount).toBe(2000);
  expect(month1.status).toBe('Partial');

  await generate('TEST_STUDENT_A', 2);
  const month2 = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 2 }).lean();
  expect(month2.arrears[0].balance).toBe(2000);
  expect(month2.total).toBe(7000);

  await models.FeeVoucherModel.updateOne({ _id: month2._id }, { $set: { status: 'Unpaid', paidAmount: 0 } });
  const oldPayment = await models.FeePaymentModelV2.create({
    _id: 'payment_order_test', voucherId: month1._id, studentId: 'TEST_STUDENT_A', amount: 7000,
    mode: 'cash', date: '2026-01-12', receiptNo: 'ADV-ORDER', recordedBy: global.__TEST_USERS__['test.admin@school.local']._id,
  });
  const order = await request(app).post('/api/fees/payments').set(headers('test.admin@school.local')).send({
    voucherId: month1._id, amount: 7000, mode: 'cash', date: '2026-01-12', referenceNo: 'ADV-ORDER-2',
  });
  expect(order.status).toBe(201);
  expect(models.FeeVoucherModel.findById(month1._id)).resolves.toMatchObject({ paidAmount: 5000, status: 'Paid' });
});

test('payment reversal returns exact balance and flags later published vouchers', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  await generate('TEST_STUDENT_A', 2);
  const [month1] = await models.FeeVoucherModel.find({ studentId: 'TEST_STUDENT_A', month: 1 }).lean();
  await request(app).patch(`/api/fees/vouchers/${month1._id}/publish`).set(headers('test.admin@school.local'));
  const month2 = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 2 });
  await request(app).patch(`/api/fees/vouchers/${month2._id}/publish`).set(headers('test.admin@school.local'));
  const payment = await request(app).post('/api/fees/payments').set(headers('test.admin@school.local')).send({
    voucherId: month1._id, amount: 3000, mode: 'cash', date: '2026-01-11', referenceNo: 'REV-3000',
  });
  const paymentId = payment.body.data.payment._id;
  const noReason = await request(app).post(`/api/fees/payments/${paymentId}/reverse`).set(headers('test.admin@school.local')).send({});
  expect(noReason.status).toBe(400);
  const reversal = await request(app).post(`/api/fees/payments/${paymentId}/reverse`).set(headers('test.admin@school.local')).send({ reason: 'TEST incorrect payment' });
  expect(reversal.status).toBe(200);
  const reversedVoucher = await models.FeeVoucherModel.findById(month1._id).lean();
  expect(reversedVoucher.paidAmount).toBe(0);
  expect(reversedVoucher.status).toBe('Unpaid');
  const later = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 2 }).lean();
  expect(later.adminReviewRequired).toBe(true);
  const audit = await models.FeeAuditLogModel.findOne({ action: 'REVERSE' }).lean();
  expect(audit.reason).toBe('TEST incorrect payment');
  expect(audit.before).toBeTruthy();
  expect(audit.after).toBeTruthy();
});

test('overdue cron applies flat fine once and sends reminders every seven days', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  const voucher = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 1 });
  await request(app).patch(`/api/fees/vouchers/${voucher._id}/publish`).set(headers('test.admin@school.local'));
  voucher.dueDate = '2026-01-10';
  await voucher.save();
  await runAdvancedFeeJobs(new Date('2026-01-11T00:00:00Z'));
  await runAdvancedFeeJobs(new Date('2026-01-11T00:00:00Z'));
  let current = await models.FeeVoucherModel.findById(voucher._id).lean();
  expect(current.status).toBe('Overdue');
  expect(current.fine).toBe(200);
  expect(await NotificationModel.countDocuments({ voucherId: voucher._id, type: 'overdue' })).toBe(2);
  await runAdvancedFeeJobs(new Date('2026-01-18T00:00:00Z'));
  const notifications = await NotificationModel.find({ voucherId: voucher._id, type: 'overdue' }).lean();
  expect(notifications.length).toBe(2 + 2);
  current = await models.FeeVoucherModel.findById(voucher._id).lean();
  expect(current.fine).toBe(200);
});

test('proof lifecycle validates files, ownership, approvals and rejection reasons', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  const voucher = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 1 }).lean();
  const proofUpload = async (email, referenceNo, filename = 'proof.pdf', size = 20) => request(app)
    .post('/api/fees/proofs').set(headers(email))
    .field('voucherId', voucher._id).field('amount', '5000').field('mode', 'bank').field('referenceNo', referenceNo)
    .attach('proof', Buffer.alloc(size, 1), filename);
  const valid = await proofUpload('test.parent.a@school.local', 'PROOF-VALID');
  expect(valid.status).toBe(201);
  expect(valid.body.data.status).toBe('Pending');
  const approve = await request(app).patch(`/api/fees/proofs/${valid.body.data._id}/approve`).set(headers('test.accountant@school.local')).send({});
  expect(approve.status).toBe(200);
  const payment = await models.FeePaymentModelV2.findOne({ referenceNo: 'PROOF-VALID' }).lean();
  expect(payment.amount).toBe(5000);
  expect(payment.receiptNo).toMatch(/^RCPT-/);
  const duplicateApproval = await request(app).patch(`/api/fees/proofs/${valid.body.data._id}/approve`).set(headers('test.admin@school.local')).send({});
  expect(duplicateApproval.status).toBe(409);
  const duplicateReference = await proofUpload('test.parent.a@school.local', 'PROOF-VALID');
  expect(duplicateReference.status).toBe(409);

  const rejected = await proofUpload('test.parent.a@school.local', 'PROOF-REJECT');
  expect(rejected.status).toBe(201);
  const noReason = await request(app).patch(`/api/fees/proofs/${rejected.body.data._id}/reject`).set(headers('test.admin@school.local')).send({});
  expect(noReason.status).toBe(400);
  const rejectedResponse = await request(app).patch(`/api/fees/proofs/${rejected.body.data._id}/reject`).set(headers('test.admin@school.local')).send({ reason: 'TEST invalid slip' });
  expect(rejectedResponse.status).toBe(200);

  expect((await proofUpload('test.parent.a@school.local', 'BAD-TYPE', 'bad.exe')).status).toBe(400);
  expect((await proofUpload('test.parent.a@school.local', 'BIG-FILE', 'proof.pdf', 5 * 1024 * 1024 + 1)).status).toBe(400);
  expect((await proofUpload('test.parent.b@school.local', 'CROSS-PARENT')).status).toBe(403);
});

test('month lock blocks mutations and unlock restores access; actions are audited', async () => {
  await structure();
  await generate('TEST_STUDENT_A', 1);
  const voucher = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 1 });
  await request(app).patch(`/api/fees/vouchers/${voucher._id}/publish`).set(headers('test.admin@school.local'));
  const lock = await request(app).post('/api/fees/month-lock').set(headers('test.admin@school.local')).send({ month: 1, year: 2026, locked: true, reason: 'TEST close month' });
  expect(lock.status).toBe(200);
  expect((await request(app).put(`/api/fees/vouchers/${voucher._id}`).set(headers('test.admin@school.local')).send({ discount: 1 })).status).toBe(409);
  expect((await request(app).patch(`/api/fees/vouchers/${voucher._id}/cancel`).set(headers('test.admin@school.local')).send({ reason: 'TEST' })).status).toBe(409);
  expect((await request(app).post('/api/fees/payments').set(headers('test.admin@school.local')).send({ voucherId: voucher._id, amount: 500, mode: 'cash', date: '2026-01-11' })).status).toBe(409);
  const unlock = await request(app).post('/api/fees/month-lock').set(headers('test.admin@school.local')).send({ month: 1, year: 2026, locked: false, reason: 'TEST reopen month' });
  expect(unlock.status).toBe(200);
  expect(await models.FeeAuditLogModel.countDocuments({ action: { $in: ['LOCK_MONTH', 'UNLOCK_MONTH'] } })).toBe(2);
});

test('promotion uses new class structure while withdrawal and no-dues are enforced', async () => {
  await structure('TEST_CLASS_A', 5000);
  await structure('TEST_CLASS_B', 6000);
  await generate('TEST_STUDENT_A', 1);
  const old = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 1 }).lean();
  expect(old.items[0].amount).toBe(5000);
  const promoted = await request(app).patch('/api/fees/students/TEST_STUDENT_A/class').set(headers('test.admin@school.local')).send({ classId: 'TEST_CLASS_B' });
  expect(promoted.status).toBe(200);
  await generate('TEST_STUDENT_A', 2);
  const next = await models.FeeVoucherModel.findOne({ studentId: 'TEST_STUDENT_A', month: 2 }).lean();
  expect(next.items[0].amount).toBe(6000);
  expect((await models.FeeVoucherModel.findById(old._id).lean()).items[0].amount).toBe(5000);
  const withdrawn = await request(app).patch('/api/fees/students/TEST_STUDENT_A/withdraw').set(headers('test.admin@school.local')).send({});
  expect(withdrawn.status).toBe(200);
  expect(withdrawn.body.balance).toBeGreaterThan(0);
  expect(withdrawn.body.warning).toContain('outstanding fees');
  const refused = await request(app).get('/api/fees/students/TEST_STUDENT_A/no-dues-certificate').set(headers('test.admin@school.local'));
  expect(refused.status).toBe(409);
  await models.FeeVoucherModel.updateMany({ studentId: 'TEST_STUDENT_A' }, { $set: { status: 'Paid', paidAmount: 6000 } });
  const certificate = await request(app).get('/api/fees/students/TEST_STUDENT_A/no-dues-certificate').set(headers('test.admin@school.local'));
  expect(certificate.status).toBe(200);
  expect(certificate.headers['content-type']).toContain('application/pdf');
});
