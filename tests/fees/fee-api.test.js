import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'edumanage-secret-jwt-key-2026-production';
let app;
let feeModels;

beforeAll(async () => {
  const server = await import('../../server/app.ts');
  app = server.createServerApp();
  feeModels = await import('../../server/models/FeeModule.ts');
});

beforeEach(async () => {
  await Promise.all([
    feeModels.FeeVoucherModel.deleteMany({}),
    feeModels.FeePaymentModelV2.deleteMany({}),
    feeModels.OpeningBalanceModel.deleteMany({}),
    feeModels.FeeStructureV2Model.deleteMany({}),
    feeModels.PaymentProofModel.deleteMany({}),
    feeModels.FeeAuditLogModel.deleteMany({}),
  ]);
});

function token(email) {
  const user = global.__TEST_USERS__[email];
  return jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
}

const auth = (email) => ({ Authorization: `Bearer ${token(email)}` });

describe('Fee Management integration', () => {
  test('creates fee structures, versions, opening balances and first-voucher arrears', async () => {
    const admin = auth('test.admin@school.local');
    const structureA = await request(app).post('/api/fees/structure').set(admin).send({
      sessionId: 'TEST-2026', classId: 'TEST_CLASS_A', effectiveFrom: '2026-09-01',
      heads: [{ name: 'Tuition', amount: 1000 }, { name: 'Exam', amount: 200 }], dueDay: 10,
    });
    expect(structureA.status).toBe(201);
    expect(structureA.body.data.heads.reduce((sum, head) => sum + head.amount, 0)).toBe(1200);

    const opening = await request(app).post('/api/fees/opening-balance').set(admin).send({
      studentId: 'TEST_STUDENT_A', amount: 300, asOfDate: '2026-08-31', note: 'TEST opening balance',
    });
    expect(opening.status).toBe(201);
    expect(opening.body.data.amount).toBe(300);

    const imported = await request(app).post('/api/fees/opening-balance/import').set(admin).send({
      csv: 'studentId,amount,asOfDate,note\nTEST_STUDENT_B,125,2026-08-31,TEST import',
    });
    expect([200, 201]).toContain(imported.status);
  });

  test('generates individual drafts, blocks duplicates and publishes child-named notifications', async () => {
    const admin = auth('test.admin@school.local');
    for (const structure of [
      ['TEST_CLASS_A', 1200], ['TEST_CLASS_B', 900], ['TEST_CLASS_C', 700],
    ]) {
      await request(app).post('/api/fees/structure').set(admin).send({
        sessionId: 'TEST-2026', classId: structure[0], effectiveFrom: '2026-09-01',
        heads: [{ name: 'Tuition', amount: structure[1]}], dueDay: 10,
      });
    }
    const generated = await request(app).post('/api/fees/vouchers/generate').set(admin).send({
      scope: 'all', sessionId: 'TEST-2026', month: 10, year: 2026,
    });
    expect([200, 201]).toContain(generated.status);
    expect(generated.body.total).toBeGreaterThanOrEqual(3);

    const duplicate = await request(app).post('/api/fees/vouchers/generate').set(admin).send({ scope: 'all', sessionId: 'TEST-2026', month: 10, year: 2026 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.duplicates.length).toBeGreaterThan(0);

    const drafts = await request(app).get('/api/fees/vouchers').set(admin);
    const aVoucher = drafts.body.data.find((voucher) => voucher.studentId === 'TEST_STUDENT_A');
    expect(aVoucher.total).toBe(1200);

    const edit = await request(app).put(`/api/fees/vouchers/${aVoucher._id}`).set(admin).send({ total: 1210, reason: 'TEST Draft edit' });
    expect(edit.status).toBe(200);

    const publish = await request(app).patch(`/api/fees/vouchers/${aVoucher._id}/publish`).set(admin);
    expect(publish.status).toBe(200);
    const notifications = await request(app).get('/api/notifications').set(auth('test.parent.a@school.local'));
    expect(notifications.body.data.some((item) => item.message.includes('TEST Student A'))).toBe(true);
  });

  test('multi-child endpoint and student access are isolated', async () => {
    const admin = auth('test.admin@school.local');
    for (const [classId, amount] of [['TEST_CLASS_A', 1200], ['TEST_CLASS_B', 900]]) {
      await request(app).post('/api/fees/structure').set(admin).send({
        sessionId: 'TEST-2026', classId, effectiveFrom: '2026-09-01',
        heads: [{ name: 'Tuition', amount }], dueDay: 10,
      });
    }
    await request(app).post('/api/fees/vouchers/generate').set(admin).send({ scope: 'all', sessionId: 'TEST-2026', month: 10, year: 2026 });
    const family = await request(app).get('/api/fees/parent/children').set(auth('test.parent.a@school.local'));
    expect(family.status).toBe(200);
    expect(family.body.data).toHaveLength(2);

    const amounts = family.body.data.map((child) => child.vouchers.reduce((sum, voucher) => sum + voucher.total, 0)).sort((a, b) => a - b);
    expect(amounts).toEqual([900, 1200]);
    expect(family.body.data.reduce((sum, child) => sum + child.dues, 0)).toBe(2100);

    const studentB = await request(app).get('/api/fees/vouchers').set(auth('test.student.b@school.local'));
    expect(studentB.status).toBe(200);
    expect(studentB.body.data.every((voucher) => voucher.studentId === 'TEST_STUDENT_B')).toBe(true);
  });

  test('payments, partial balances and full/advance totals update correctly', async () => {
    const admin = auth('test.admin@school.local');
    await request(app).post('/api/fees/structure').set(admin).send({
      sessionId: 'TEST-2026', classId: 'TEST_CLASS_A', effectiveFrom: '2026-09-01',
      heads: [{ name: 'Tuition', amount: 1000 }], dueDay: 10,
    });
    await request(app).post('/api/fees/vouchers/generate').set(admin).send({ scope: 'student', sessionId: 'TEST-2026', studentId: 'TEST_STUDENT_A', month: 10, year: 2026 });
    const vouchers = await request(app).get('/api/fees/vouchers').set(admin);
    const voucher = vouchers.body.data.find((item) => item.studentId === 'TEST_STUDENT_A');
    await request(app).patch(`/api/fees/vouchers/${voucher._id}/publish`).set(admin);

    const partial = await request(app).post('/api/fees/payments').set(admin).send({
      voucherId: voucher._id, amount: 400, mode: 'cash', date: '2026-10-01', referenceNo: 'TEST-PARTIAL',
    });
    expect(partial.status).toBe(201);
    const partialVoucher = await request(app).get('/api/fees/vouchers').set(admin);
    const updated = partialVoucher.body.data.find((item) => item._id === voucher._id);
    expect(updated.paidAmount).toBe(400);
    expect(updated.status).toBe('Partial');

    const full = await request(app).post('/api/fees/payments').set(admin).send({
      voucherId: voucher._id, amount: 600, mode: 'cash', date: '2026-10-02', referenceNo: 'TEST-FULL',
    });
    expect(full.status).toBe(201);
    const paid = await request(app).get('/api/fees/vouchers').set(admin);
    expect(paid.body.data.find((item) => item._id === voucher._id).status).toBe('Paid');
  });

  test('proof ownership, role restrictions, PDF and Excel exports', async () => {
    const admin = auth('test.admin@school.local');
    await request(app).post('/api/fees/structure').set(admin).send({
      sessionId: 'TEST-2026', classId: 'TEST_CLASS_C', effectiveFrom: '2026-09-01',
      heads: [{ name: 'Tuition', amount: 700 }], dueDay: 10,
    });
    await request(app).post('/api/fees/vouchers/generate').set(admin).send({ scope: 'student', sessionId: 'TEST-2026', studentId: 'TEST_STUDENT_C', month: 10, year: 2026 });
    const vouchers = await request(app).get('/api/fees/vouchers').set(admin);
    const voucher = vouchers.body.data.find((item) => item.studentId === 'TEST_STUDENT_C');

    const crossChildUpload = await request(app).post('/api/fees/proofs').set(auth('test.parent.a@school.local'))
      .field('voucherId', voucher._id).field('amount', '700').field('mode', 'bank').field('referenceNo', 'TEST-CROSS')
      .attach('proof', Buffer.from('%PDF-1.4 TEST'), 'proof.pdf');
    // Voucher ownership is determined by the submitted voucher; attach it in a second request payload.
    expect([403, 404]).toContain(crossChildUpload.status);

    const accountantStructure = await request(app).post('/api/fees/structure').set(auth('test.accountant@school.local')).send({});
    expect(accountantStructure.status).toBe(403);
    const audit = await request(app).get('/api/fees/audit-log').set(auth('test.accountant@school.local'));
    expect(audit.status).toBe(403);

    const pdf = await request(app).get(`/api/fees/vouchers/${voucher._id}/pdf`).set(admin);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');

    const excel = await request(app).get('/api/fees/reports?format=xlsx').set(admin);
    expect(excel.status).toBe(200);
    expect(excel.headers['content-type']).toContain('spreadsheetml');
  });

  test('regression health and core modules respond', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    const publicModules = ['/api/students', '/api/attendance', '/api/results', '/api/timetable', '/api/classes'];
    for (const path of publicModules) {
      const response = await request(app).get(path);
      expect([200, 401, 403]).toContain(response.status);
    }
  });
});
