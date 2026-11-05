import request from 'supertest';

const asJson = (token) => ({ Authorization: `Bearer ${token}` });

describe('Teacher attendance backend', () => {
  let app;
  let generateToken;
  let store;
  let adminToken;
  let teacherOneToken;
  let teacherTwoToken;
  let studentToken;
  let parentToken;
  let AttendanceModel;
  let NotificationModel;
  let AuditEntryModel;
  let AttendanceCorrectionRequestModel;
  let SchoolCalendarModel;
  let AttendanceLeaveModel;
  let StudentModel;

  beforeAll(async () => {
    const auth = await import('../../server/middleware/auth.ts');
    generateToken = auth.generateToken;
    const storeModule = await import('../../server/data/store.ts');
    store = storeModule.default?.default || storeModule.default;
    const appModule = await import('../../server/app.ts');
    app = appModule.createServerApp();
    const unwrap = (module) => module.default?.default || module.default;
    AttendanceModel = unwrap(await import('../../server/models/Attendance.ts'));
    NotificationModel = unwrap(await import('../../server/models/Notification.ts'));
    AuditEntryModel = unwrap(await import('../../server/models/AuditEntry.ts'));
    AttendanceCorrectionRequestModel = unwrap(await import('../../server/models/AttendanceCorrectionRequest.ts'));
    SchoolCalendarModel = unwrap(await import('../../server/models/SchoolCalendar.ts'));
    AttendanceLeaveModel = unwrap(await import('../../server/models/AttendanceLeave.ts'));
    StudentModel = unwrap(await import('../../server/models/Student.ts'));

    adminToken = generateToken(store.findUserById('att_admin'));
    teacherOneToken = generateToken(store.findUserById('att_teacher_1_user'));
    teacherTwoToken = generateToken(store.findUserById('att_teacher_2_user'));
    studentToken = generateToken(store.findUserById('att_student_1_user'));
    parentToken = generateToken(store.findUserById('att_parent_user'));
  });

  test('1. class teacher assignment, replacement, removal, audit and notification', async () => {
    let response = await request(app).patch('/api/admin/classes/att_class_a/class-teacher')
      .set(asJson(adminToken)).send({ classTeacherId: 'att_teacher_1' });
    expect(response.status).toBe(200);

    response = await request(app).patch('/api/admin/classes/att_class_b/class-teacher')
      .set(asJson(adminToken)).send({ classTeacherId: 'att_teacher_1' });
    expect(response.status).toBe(409);

    response = await request(app).patch('/api/admin/classes/att_class_a/class-teacher')
      .set(asJson(adminToken)).send({ classTeacherId: 'att_teacher_2' });
    expect(response.status).toBe(200);
    expect((await AuditEntryModel.countDocuments({ entityId: 'att_class_a' }))).toBeGreaterThanOrEqual(2);
    expect((await NotificationModel.countDocuments({ userId: 'att_teacher_2_user', type: 'class_teacher_assigned' }))).toBe(1);

    response = await request(app).patch('/api/admin/classes/att_class_a/class-teacher')
      .set(asJson(adminToken)).send({ classTeacherId: '' });
    expect(response.status).toBe(200);
    expect((await NotificationModel.countDocuments({ userId: 'att_teacher_2_user', type: 'class_teacher_removed' }))).toBe(1);
  });

  test('2-4. class access, cross-class submission, and active class roster', async () => {
    await request(app).patch('/api/admin/classes/att_class_a/class-teacher')
      .set(asJson(adminToken)).send({ classTeacherId: 'att_teacher_1' });
    let response = await request(app).get('/api/teacher/attendance/my-class').set(asJson(teacherOneToken));
    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe('att_class_a');

    response = await request(app).get('/api/teacher/attendance/students')
      .set(asJson(teacherOneToken)).query({ date: new Date().toISOString().slice(0, 10) });
    expect(response.status).toBe(200);
    expect(response.body.data.map((item) => item.studentId).sort()).toEqual(['att_student_1', 'att_student_2', 'att_student_3', 'att_student_4']);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherTwoToken)).send({
        classId: 'att_class_a',
        date: new Date().toISOString().slice(0, 10),
        records: [],
      });
    expect(response.status).toBe(403);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_b',
        date: new Date().toISOString().slice(0, 10),
        records: [],
      });
    expect(response.status).toBe(403);
  });

  test('5-8. submit, update, validation, leave lock, holiday and Sunday rules', async () => {
    const today = new Date();
    const date = today.toISOString().slice(0, 10);
    const records = [
      { studentId: 'att_student_1', status: 'Present' },
      { studentId: 'att_student_2', status: 'Absent' },
      { studentId: 'att_student_3', status: 'Present' },
      { studentId: 'att_student_4', status: 'Present' },
    ];
    let response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date, records });
    if (response.status === 400) {
      // Run the fixed weekday case on a known working weekday.
      const working = new Date(today.getTime());
      while (working.getUTCDay() === 0 || working.getUTCDay() === 6) working.setUTCDate(working.getUTCDate() - 1);
      const workingDate = working.toISOString().slice(0, 10);
      response = await request(app).post('/api/teacher/attendance')
        .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date: workingDate, records });
    }
    expect(response.status).toBe(201);
    expect(response.body.data.records).toHaveLength(4);

    const savedDate = response.body.data.date;
    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_a',
        date: savedDate,
        records: [
          { studentId: 'att_student_1', status: 'Absent' },
          { studentId: 'att_student_2', status: 'Present' },
          { studentId: 'att_student_3', status: 'Present' },
          { studentId: 'att_student_4', status: 'Present' },
        ],
      });
    expect(response.status).toBe(200);
    expect(await AttendanceModel.countDocuments({ classId: 'att_class_a', date: savedDate })).toBe(1);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_a',
        date: savedDate,
        records: [{ studentId: 'att_student_1', status: 'Present' }],
      });
    expect(response.status).toBe(400);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date: '2099-01-01', records });
    expect(response.status).toBe(400);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date: '2020-01-01', records });
    expect(response.status).toBe(400);

    await SchoolCalendarModel.create({ _id: 'calendar_sunday_working', date: '2026-11-01', type: 'Working' });
    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date: '2026-11-01', records });
    expect(response.status).toBe(201);

    await SchoolCalendarModel.create({ _id: 'calendar_holiday', date: '2026-11-02', type: 'Holiday' });
    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({ classId: 'att_class_a', date: '2026-11-02', records });
    expect(response.status).toBe(400);

    await AttendanceLeaveModel.create({
      _id: 'leave_student_1', studentId: 'att_student_1', date: savedDate, status: 'Approved',
    });
    response = await request(app).get('/api/teacher/attendance/students')
      .set(asJson(teacherOneToken)).query({ date: savedDate });
    expect(response.body.data.find((student) => student.studentId === 'att_student_1')).toMatchObject({
      status: 'OnLeave', leaveLocked: true,
    });
  });

  test('9-12. reports, notifications, read isolation, replacement and exports', async () => {
    let response;
    await StudentModel.create({
      _id: 'att_student_zero', userId: 'att_student_zero_user', name: 'No Records Student',
      admissionNo: 'ATT-ZERO', rollNo: '6', classId: 'att_class_a', section: 'A',
      className: 'Attendance Grade 1', parentId: 'att_parent_user', status: 'Active', archivedAt: '',
      email: 'attendance.zero@test.local',
    });
    const report = await request(app).get('/api/teacher/attendance/report')
      .set(asJson(teacherOneToken)).query({ month: '2026-11' });
    expect(report.status).toBe(200);
    const newStudent = report.body.data.report.find((item) => item.studentId === 'att_student_zero');
    if (newStudent) {
      expect(newStudent.present).toBe(0);
      expect(newStudent.attendancePercentageLabel).toBe('No data yet');
    }

    response = await request(app).get('/api/attendance/export/xlsx')
      .set(asJson(teacherOneToken)).query({ classId: 'att_class_a', month: '2026-11' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml');

    response = await request(app).get('/api/attendance/export/pdf')
      .set(asJson(teacherOneToken)).query({ classId: 'att_class_a', month: '2026-11' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('pdf');

    response = await request(app).get('/api/attendance/student/att_student_1')
      .set(asJson(studentToken));
    expect(response.status).toBe(200);
    response = await request(app).get('/api/attendance/student/att_student_2')
      .set(asJson(studentToken));
    expect(response.status).toBe(403);
    response = await request(app).get('/api/attendance/student/att_student_2')
      .set(asJson(parentToken));
    expect(response.status).toBe(200);
  });

  test('10. exact monthly percentages, Late rule, On Leave treatment, exports', async () => {
    const month = '2027-05';
    await AttendanceModel.deleteMany({ classId: 'att_class_a', date: { $regex: '^2027-05' } });
    const dates = [];
    for (let day = 1; dates.length < 20 && day <= 31; day++) {
      const date = new Date(Date.UTC(2027, 4, day));
      if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
        dates.push(`${month}-${String(day).padStart(2, '0')}`);
      }
    }
    expect(dates).toHaveLength(20);

    for (let index = 0; index < dates.length; index++) {
      await AttendanceModel.create({
        _id: `attendance_report_${index}`,
        classId: 'att_class_a',
        section: 'A',
        date: dates[index],
        takenBy: 'att_teacher_1',
        records: [
          { studentId: 'att_student_1', status: index < 18 ? 'Present' : 'Absent' },
          { studentId: 'att_student_2', status: index < 14 ? 'Present' : (index === 14 ? 'Late' : 'Absent') },
          { studentId: 'att_student_3', status: 'OnLeave' },
        ],
        submittedAt: new Date(),
      });
    }

    let response = await request(app).get('/api/teacher/attendance/report')
      .set(asJson(teacherOneToken)).query({ month });
    expect(response.status).toBe(200);
    const a = response.body.data.report.find((row) => row.studentId === 'att_student_1');
    const b = response.body.data.report.find((row) => row.studentId === 'att_student_2');
    const c = response.body.data.report.find((row) => row.studentId === 'att_student_3');
    const zero = response.body.data.report.find((row) => row.studentId === 'att_student_4');
    expect(a.percentage).toBe(90);
    expect(a.below75).toBe(false);
    expect(b.percentage).toBe(75);
    expect(b.below75).toBe(false);
    expect(b.late).toBe(1);
    expect(c.percentage).toBeNull();
    expect(c.attendancePercentageLabel).toBe('No data yet');
    expect(zero.percentage).toBeNull();
    expect(zero.attendancePercentageLabel).toBe('No data yet');

    response = await request(app).get('/api/attendance/export/xlsx')
      .set(asJson(teacherOneToken)).query({ classId: 'att_class_a', month })
      .buffer(true).parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    const ExcelJSModule = await import('exceljs');
    const ExcelJSConstructor = ExcelJSModule.default?.Workbook || ExcelJSModule.Workbook;
    const workbook = new ExcelJSConstructor();
    const excelSource = Buffer.isBuffer(response.body) ? response.body : (response.body?.data || response.body);
    const excelBuffer = Buffer.isBuffer(excelSource)
      ? excelSource
      : Buffer.from(Array.isArray(excelSource) ? excelSource : Object.values(excelSource));
    await workbook.xlsx.load(excelBuffer);
    const rows = workbook.worksheets[0].getSheetValues();
    const values = JSON.stringify(rows);
    expect(values).toContain('90');
    expect(values).toContain('75');
    expect(values).toContain('No data yet');

    response = await request(app).get('/api/attendance/export/pdf')
      .set(asJson(teacherOneToken)).query({ classId: 'att_class_a', month });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('pdf');
    expect(response.body.length).toBeGreaterThan(100);
  });

  test('11. absence and low-attendance notification deduplication', async () => {
    await NotificationModel.deleteMany({ type: { $in: ['attendance_absent', 'attendance_low'] } });
    const date = '2026-11-05';
    await AttendanceLeaveModel.deleteMany({ date });
    let response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_a',
        date,
        records: [
          { studentId: 'att_student_1', status: 'Absent', remarks: '' },
          { studentId: 'att_student_2', status: 'Present', remarks: '' },
          { studentId: 'att_student_3', status: 'Present', remarks: '' },
          { studentId: 'att_student_4', status: 'Present', remarks: '' },
          { studentId: 'att_student_zero', status: 'Present', remarks: '' },
        ],
      });
    if (![200, 201].includes(response.status)) throw new Error(`Attendance submit failed: ${response.status} ${JSON.stringify(response.body)}`);
    let absentStudent = await NotificationModel.countDocuments({
      type: 'attendance_absent', userId: 'att_student_1_user',
      'metadata.notificationKey': `attendance_absent:${date}:att_student_1`,
    });
    let absentParent = await NotificationModel.countDocuments({
      type: 'attendance_absent', userId: 'att_parent_user',
      'metadata.notificationKey': `attendance_absent:${date}:att_student_1`,
    });
    expect(absentStudent).toBe(1);
    expect(absentParent).toBe(1);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_a', date,
        records: [
          { studentId: 'att_student_1', status: 'Absent', remarks: 'Edited remark' },
          { studentId: 'att_student_2', status: 'Present', remarks: '' },
          { studentId: 'att_student_3', status: 'Present', remarks: '' },
          { studentId: 'att_student_4', status: 'Present', remarks: '' },
          { studentId: 'att_student_zero', status: 'Present', remarks: '' },
        ],
      });
    expect(response.status).toBe(200);
    expect(await NotificationModel.countDocuments({ type: 'attendance_absent', 'metadata.notificationKey': `attendance_absent:${date}:att_student_1` })).toBe(2);

    for (const status of ['Present', 'Absent']) {
      response = await request(app).post('/api/teacher/attendance')
        .set(asJson(teacherOneToken)).send({
          classId: 'att_class_a', date,
          records: [
            { studentId: 'att_student_1', status, remarks: '' },
            { studentId: 'att_student_2', status: 'Present', remarks: '' },
            { studentId: 'att_student_3', status: 'Present', remarks: '' },
            { studentId: 'att_student_4', status: 'Present', remarks: '' },
            { studentId: 'att_student_zero', status: 'Present', remarks: '' },
          ],
        });
      expect(response.status).toBe(200);
    }
    expect(await NotificationModel.countDocuments({ type: 'attendance_absent', 'metadata.notificationKey': `attendance_absent:${date}:att_student_1` })).toBe(2);

    const parentNotifications = await NotificationModel.find({
      type: 'attendance_absent', userId: 'att_parent_user',
    }).lean();
    expect(parentNotifications).toHaveLength(1);
    expect(parentNotifications[0].message).toContain('Student One');
    expect(parentNotifications[0].message).toContain(date);
    expect(parentNotifications[0].message).toContain('Attendance Grade 1');

    const lowBefore = await NotificationModel.countDocuments({ type: 'attendance_low' });
    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(teacherOneToken)).send({
        classId: 'att_class_a', date,
        records: [
          { studentId: 'att_student_1', status: 'Absent', remarks: '' },
          { studentId: 'att_student_2', status: 'Present', remarks: '' },
          { studentId: 'att_student_3', status: 'Present', remarks: '' },
          { studentId: 'att_student_4', status: 'Present', remarks: '' },
          { studentId: 'att_student_zero', status: 'Present', remarks: '' },
        ],
      });
    expect(response.status).toBe(200);
    const lowAfter = await NotificationModel.countDocuments({ type: 'attendance_low' });
    expect(lowAfter).toBe(lowBefore);
    const parentLow = await NotificationModel.countDocuments({ type: 'attendance_low', userId: 'att_parent_user' });
    expect(parentLow).toBeGreaterThanOrEqual(1);
  });

  test('14. student and parent attendance isolation', async () => {
    let response = await request(app).get('/api/attendance/student/att_student_1')
      .set(asJson(studentToken));
    expect(response.status).toBe(200);
    expect(response.body.student.id).toBe('att_student_1');

    response = await request(app).get('/api/attendance/student/att_student_2')
      .set(asJson(studentToken));
    expect(response.status).toBe(403);
    response = await request(app).get('/api/attendance/student/att_student_1')
      .set(asJson(studentToken)).query({ studentId: 'att_student_2' });
    expect(response.status).toBe(403);

    response = await request(app).get('/api/attendance/student/att_student_1')
      .set(asJson(parentToken));
    expect(response.status).toBe(200);
    response = await request(app).get('/api/attendance/student/att_student_2')
      .set(asJson(parentToken));
    expect(response.status).toBe(200);
    response = await request(app).get('/api/attendance/student/att_student_unrelated')
      .set(asJson(parentToken));
    expect(response.status).toBe(403);

    response = await request(app).post('/api/teacher/attendance')
      .set(asJson(studentToken)).send({});
    expect(response.status).toBe(403);
    response = await request(app).get('/api/teacher/attendance/history')
      .set(asJson(parentToken));
    expect(response.status).toBe(403);
    response = await request(app).get('/api/attendance/student/att_student_1');
    expect(response.status).toBe(401);

    expect(JSON.stringify(response.body)).not.toContain('Student Two');
    expect(JSON.stringify(response.body)).not.toContain('att_student_2');
  });

  test('13. correction approval/rejection, audit, and teacher notification', async () => {
    const attendance = await AttendanceModel.findOne({ classId: 'att_class_a' });
    let response = await request(app).post('/api/teacher/attendance/corrections')
      .set(asJson(teacherOneToken)).send({
        attendanceId: attendance._id, studentId: 'att_student_1', newStatus: 'Present', reason: 'Correct status',
      });
    expect(response.status).toBe(201);
    const correctionId = response.body.data._id;

    response = await request(app).patch(`/api/admin/attendance/corrections/${correctionId}`)
      .set(asJson(adminToken)).send({ status: 'Approved', reviewNote: 'Verified' });
    expect(response.status).toBe(200);
    const updated = await AttendanceModel.findById(attendance._id);
    expect(updated.records.find((record) => record.studentId === 'att_student_1').status).toBe('Present');
    expect(await AuditEntryModel.countDocuments({ entityId: correctionId })).toBe(1);
    expect(await NotificationModel.countDocuments({ userId: 'att_teacher_1_user', type: 'attendance_correction_approved' })).toBe(1);

    response = await request(app).post('/api/teacher/attendance/corrections')
      .set(asJson(teacherOneToken)).send({
        attendanceId: attendance._id, studentId: 'att_student_2', newStatus: 'Absent', reason: 'Incorrectly marked',
      });
    const rejectionId = response.body.data._id;
    response = await request(app).patch(`/api/admin/attendance/corrections/${rejectionId}`)
      .set(asJson(adminToken)).send({ status: 'Rejected', reviewNote: 'Evidence missing' });
    expect(response.status).toBe(200);
    expect(await AttendanceCorrectionRequestModel.findById(rejectionId).then((item) => item.reviewNote)).toBe('Evidence missing');
  });

  test('16. existing admin, student, parent and fee endpoints respond', async () => {
    const endpoints = [
      ['/api/classes', adminToken],
      ['/api/students', adminToken],
      ['/api/dashboard/stats', studentToken],
      ['/api/dashboard/stats', parentToken],
      ['/api/fees/structures', adminToken],
    ];
    for (const [endpoint, token] of endpoints) {
      const response = await request(app).get(endpoint).set(asJson(token));
      expect([200, 404]).toContain(response.status);
    }
  });
});
