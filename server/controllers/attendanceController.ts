import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessClass, getTeacherForUser, isClassTeacher, teachesSubject } from '../services/teacherAccess.js';
import AttendanceModel from '../models/Attendance.js';
import StudentModel from '../models/Student.js';
import ClassModel from '../models/Class.js';
import { AuditEntryModel, AttendanceCorrectionRequestModel, NotificationModel } from '../models/index.js';
import { SchoolCalendarModel, AttendanceLeaveModel } from '../models/index.js';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

const workingDays = (start: Date, end: Date): string[] => {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    if (cursor.getUTCDay() !== 0) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const monthRange = (month: string): { start: Date; end: Date } => {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 0)),
  };
};

const isValidMonth = (month: string) => /^\d{4}-\d{2}$/.test(month);
const toPlainClass = (cls: any) => ({
  ...(cls || {}),
  _id: cls._id,
  name: cls.name || cls.className || '',
  classTeacherId: cls.classTeacherId || cls.classTeacher || '',
});

const weekStartsForMonth = (month: string): string[] => {
  const { start, end } = monthRange(month);
  const anchors = new Set<string>();
  for (const date of workingDays(start, end)) {
    const parsed = new Date(`${date}T00:00:00Z`);
    const mondayOffset = parsed.getUTCDay() === 0 ? -6 : 1 - parsed.getUTCDay();
    parsed.setUTCDate(parsed.getUTCDate() + mondayOffset);
    anchors.add(parsed.toISOString().slice(0, 10));
  }
  return [...anchors].sort();
};

const statusCounts = (records: Array<{ date: string; status: string }>, dates: string[]) => {
  const byDate = new Map(records.map((record) => [record.date, record.status]));
  return dates.reduce((counts, date) => {
    const status = byDate.get(date);
    if (status === 'Present') counts.present += 1;
    if (status === 'Absent') counts.absent += 1;
    if (status === 'Leave') counts.leave += 1;
    if (status) counts.marked += 1;
    return counts;
  }, { present: 0, absent: 0, leave: 0, marked: 0 });
};

async function dailyRecordsForStudent(studentId: string, classId: string, start: string, end: string) {
  const student = await StudentModel.findOne({ _id: studentId, archivedAt: { $in: ['', null] } }).lean();
  if (!student || student.classId !== classId) return null;
  const cls = await ClassModel.findOne({ _id: classId }).lean();
  if (!cls) return null;
  const plainClass = toPlainClass(cls);
  const records = await AttendanceModel.aggregate([
    {
      $match: {
        studentId,
        classId,
        date: { $gte: start, $lte: end },
        $or: [
          { teacherId: plainClass.classTeacherId },
          { teacherId: { $exists: false } },
          { teacherId: '' },
        ],
      },
    },
    {
      $addFields: {
        statusPriority: { $switch: { branches: [
          { case: { $eq: ['$status', 'Present'] }, then: 3 },
          { case: { $eq: ['$status', 'Leave'] }, then: 2 },
        ], default: 1 } },
      },
    },
    { $sort: { date: 1, statusPriority: -1 } },
    { $group: { _id: '$date', status: { $first: '$status' } } },
    { $project: { _id: 0, date: '$_id', status: 1 } },
  ]);
  return records as Array<{ date: string; status: string }>;
}

export function getAttendanceByClassAndDate(req: AuthenticatedRequest, res: Response): void {
  const { classId, date, subjectId } = req.query as { classId?: string; date?: string; subjectId?: string };

  if (!classId || !date) {
    res.status(400).json({ success: false, message: 'classId and date (YYYY-MM-DD) are required.' });
    return;
  }
  let teacherId: string | undefined;
  if (req.user?.role === 'teacher') {
    teacherId = getTeacherForUser(req.user)?._id;
    if (!teacherId || !canAccessClass(req.user, classId)) {
      res.status(403).json({ success: false, message: 'Access denied: This class is not assigned to you.' });
      return;
    }
    if (!subjectId || !teachesSubject(req.user, classId, subjectId)) {
      res.status(403).json({ success: false, message: 'Access denied: Select a subject assigned to you in this class.' });
      return;
    }
  }

  const students = store.getStudents({ classId });
  const attendanceRecords = store.getAttendanceByClassAndDate(classId, date, teacherId, teacherId ? subjectId : undefined);

  // Return a roster of students merged with their attendance status
  const roster = students.map((stu) => {
    const record = attendanceRecords.find((a) => a.studentId === stu._id);
    const totalEverRecords = store.attendance.filter((record) =>
      record.studentId === stu._id &&
      (teacherId === undefined || record.teacherId === teacherId) &&
      (!teacherId || record.subjectId === subjectId)
    ).length;
    return {
      studentId: stu._id,
      name: stu.name,
      rollNo: stu.rollNo,
      admissionNo: stu.admissionNo,
      status: record ? record.status : 'Unmarked',
      remarks: record?.remarks || '',
      isMarked: Boolean(record),
      recordId: record?._id,
      isNewStudent: totalEverRecords === 0,
    };
  });

  res.status(200).json({
    success: true,
    classId,
    date,
    totalStudents: students.length,
    isMarked: attendanceRecords.length > 0,
    isFinalized: Boolean(store.findClassById(classId)?.finalizedAttendanceMonths?.includes(date.slice(0, 7))),
    data: roster,
  });
}

export function markAttendance(req: AuthenticatedRequest, res: Response): void {
  const { classId, date, records, subjectId } = req.body as {
    classId: string;
    date: string;
    subjectId?: string;
    records: { studentId: string; status: 'Present' | 'Absent' | 'Leave'; remarks?: string }[];
  };

  if (!classId || !date || !Array.isArray(records)) {
    res.status(400).json({
      success: false,
      message: 'classId, date, and records array are required.',
    });
    return;
  }
  const cls = store.findClassById(classId);
  if (!cls) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }
  let teacherId: string | undefined;
  if (req.user?.role === 'teacher') {
    teacherId = getTeacherForUser(req.user)?._id;
    if (!teacherId || !teachesSubject(req.user, classId, subjectId || '')) {
      res.status(403).json({ success: false, message: 'Attendance can only be marked for a subject assigned to you in this class.' });
      return;
    }
  } else if (subjectId && !store.getSubjects(classId).some((subject) => subject._id === subjectId)) {
    res.status(403).json({ success: false, message: 'The selected subject does not belong to this class.' });
    return;
  }
  if (cls.finalizedAttendanceMonths?.includes(date.slice(0, 7))) {
    res.status(409).json({ success: false, message: 'Attendance for this month is finalized and locked.' });
    return;
  }

  const students = store.getStudents({ classId });
  const classStudentIds = new Set(students.map((student) => student._id));
  if (records.some((record) => !classStudentIds.has(record.studentId))) {
    res.status(400).json({
      success: false,
      message: 'Attendance records must belong to students in the selected class.',
    });
    return;
  }
  if (records.some((record) => !['Present', 'Absent', 'Leave'].includes(record.status))) {
    res.status(400).json({ success: false, message: 'Attendance must be explicitly marked Present, Absent, or Leave.' });
    return;
  }
  if (records.length !== classStudentIds.size || students.some((student) => !records.some((record) => record.studentId === student._id))) {
    res.status(400).json({ success: false, message: 'Submit exactly one attendance status for every student in the selected class.' });
    return;
  }

  const markedBy = req.user?._id || 'unknown';
  const updatedRecords = store.markBatchAttendance(classId, date, records, markedBy, teacherId, teacherId ? subjectId : undefined);

  res.status(200).json({
    success: true,
    message: `Attendance marked successfully for ${records.length} students on ${date}`,
    data: updatedRecords,
  });
}

export function getMonthlyReport(req: AuthenticatedRequest, res: Response): void {
  const { classId, month, subjectId } = req.query as { classId?: string; month?: string; subjectId?: string };

  if (!classId || !month) {
    res.status(400).json({
      success: false,
      message: 'classId and month (e.g. 2026-10) are required.',
    });
    return;
  }
  let teacherId: string | undefined;
  if (req.user?.role === 'teacher') {
    teacherId = getTeacherForUser(req.user)?._id;
    if (!teacherId || !canAccessClass(req.user, classId)) {
      res.status(403).json({ success: false, message: 'Access denied: This class is not assigned to you.' });
      return;
    }
    if (subjectId && !teachesSubject(req.user, classId, subjectId)) {
      res.status(403).json({ success: false, message: 'Access denied: Select a subject assigned to you in this class.' });
      return;
    }
    if (!subjectId && !isClassTeacher(req.user, classId)) {
      res.status(403).json({ success: false, message: 'Access denied: Select a subject assigned to you in this class.' });
      return;
    }
  }

  const report = store.getMonthlyAttendanceReport(classId, month, teacherId, teacherId ? subjectId : undefined);
  res.status(200).json({
    success: true,
    data: report,
  });
}

export function getClassAttendanceSummary(req: AuthenticatedRequest, res: Response): void {
  const { classId, month } = req.query as { classId?: string; month?: string };
  if (!classId || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, message: 'classId and month (YYYY-MM) are required.' });
    return;
  }
  if (!isClassTeacher(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Only the assigned class teacher can view class attendance status.' });
    return;
  }
  if (!store.findClassById(classId)) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }

  res.status(200).json({
    success: true,
    data: store.getClassMonthlyAttendanceReport(classId, month),
  });
}

export function getStudentAttendance(req: AuthenticatedRequest, res: Response): void {
  let { studentId } = req.params;
  if (req.user?.role === 'student') {
    const ownStudent = store.findStudentByUserId(req.user._id);
    if (!ownStudent || ownStudent._id !== studentId) {
      res.status(403).json({ success: false, message: 'Access denied: You can only view your own attendance.' });
      return;
    }
  }
  if (req.user?.role === 'parent') {
    const ownChild = store.findStudentsByParentId(req.user._id).find((child) => child._id === studentId);
    if (!ownChild) {
      res.status(403).json({ success: false, message: 'Access denied: You can only view your linked children.' });
      return;
    }
  }
  if (req.user?.role === 'teacher') {
    const student = store.findStudentById(studentId);
    if (!student || !isClassTeacher(req.user, student.classId)) {
      res.status(403).json({ success: false, message: 'Access denied: This student is not in one of your assigned classes.' });
      return;
    }
  }
  const requestedStudentId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
  if (['student', 'parent'].includes(req.user?.role || '') && requestedStudentId && requestedStudentId !== studentId) {
    res.status(403).json({ success: false, message: 'Access denied: Requested student does not match your authorized attendance.' });
    return;
  }
  const student = store.findStudentById(studentId);

  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  // Permission check: student or parent can only see authorized records
  const summary = store.getStudentAttendanceSummary(
    studentId,
    req.user?.role === 'teacher' ? getTeacherForUser(req.user)?._id : undefined
  );
  res.status(200).json({
    success: true,
    student: {
      id: student._id,
      name: student.name,
      rollNo: student.rollNo,
      className: student.className,
    },
    data: summary,
  });
}

export function concludeAttendanceMonth(req: AuthenticatedRequest, res: Response): void {
  const { classId, month } = req.body as { classId?: string; month?: string };
  if (!classId || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, message: 'classId and month (YYYY-MM) are required.' });
    return;
  }
  if (!isClassTeacher(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Only the assigned class teacher can conclude attendance.' });
    return;
  }
  if (!store.getAttendanceByClassAndDate(classId, `${month}-01`).length &&
      !store.attendance.some((record) => record.classId === classId && record.date.startsWith(month))) {
    res.status(400).json({ success: false, message: 'Attendance cannot be concluded before any daily records are saved.' });
    return;
  }
  const updated = store.setAttendanceMonthFinalized(classId, month, true);
  if (!updated) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }
  res.status(200).json({ success: true, message: 'Class attendance has been concluded and locked.', data: updated });
}

export function unlockAttendanceMonth(req: AuthenticatedRequest, res: Response): void {
  const { classId, month } = req.body as { classId?: string; month?: string };
  if (!classId || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, message: 'classId and month (YYYY-MM) are required.' });
    return;
  }
  if (req.user?.role !== 'admin' && !isClassTeacher(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Only the class teacher or an administrator can unlock attendance.' });
    return;
  }
  const updated = store.setAttendanceMonthFinalized(classId, month, false);
  if (!updated) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }
  res.status(200).json({ success: true, message: 'Class attendance has been unlocked.', data: updated });
}

export async function getAdminAttendanceClasses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const classes = await ClassModel.find({}).lean();
    res.status(200).json({
      success: true,
      total: classes.length,
      data: classes.map((cls) => {
        const plain = toPlainClass(cls);
        return { _id: plain._id, name: plain.name, section: cls.section || '', classTeacherId: plain.classTeacherId };
      }),
    });
  } catch {
    res.status(503).json({ success: false, message: 'Could not load classes from MongoDB.' });
  }
}

export async function getAdminAttendanceStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { classId } = req.params;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  try {
    const classExists = await ClassModel.findOne({ _id: classId }).lean();
    if (!classExists) {
      res.status(404).json({ success: false, message: 'Class not found.' });
      return;
    }
    const plainClass = toPlainClass(classExists);
    const students = await StudentModel.aggregate([
      { $match: { classId, archivedAt: { $in: ['', null] }, ...(search ? { $or: [
        { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { rollNo: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ] } : {}) } },
      { $sort: { rollNo: 1, name: 1 } },
    ]);
    const studentIds = students.map((student) => student._id);
    const summaries = await AttendanceModel.aggregate([
      {
        $match: {
          classId,
          studentId: { $in: studentIds },
          $or: [
            { teacherId: plainClass.classTeacherId },
            { teacherId: { $exists: false } },
            { teacherId: '' },
          ],
        },
      },
      { $group: { _id: { studentId: '$studentId', date: '$date' }, status: { $addToSet: '$status' } } },
      { $project: { studentId: '$_id.studentId', status: {
        $cond: [{ $in: ['Present', '$status'] }, 'Present', { $cond: [{ $in: ['Leave', '$status'] }, 'Leave', 'Absent'] }],
      } } },
      { $group: { _id: '$studentId', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } } } },
    ]);
    const summaryByStudent = new Map(summaries.map((item) => [item._id, item]));
    res.status(200).json({
      success: true,
      total: students.length,
      data: students.map((student) => {
        const summary = summaryByStudent.get(student._id);
        return {
          _id: student._id,
          name: student.name,
          rollNo: student.rollNo,
          attendancePercentage: summary?.total ? Number(((summary.present / summary.total) * 100).toFixed(1)) : null,
        };
      }),
    });
  } catch {
    res.status(503).json({ success: false, message: 'Could not load students from MongoDB.' });
  }
}

export async function getAdminStudentMonths(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId } = req.params;
  try {
    const student = await StudentModel.findOne({ _id: studentId, archivedAt: { $in: ['', null] } }).lean();
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    const cls = await ClassModel.findOne({ _id: student.classId }).lean();
    const plainClass = cls ? toPlainClass(cls) : { classTeacherId: '' };
    const months = await AttendanceModel.aggregate([
      { $match: {
        studentId,
        classId: student.classId,
        $or: [{ teacherId: plainClass.classTeacherId }, { teacherId: { $exists: false } }, { teacherId: '' }],
      } },
      { $group: { _id: '$date', status: { $addToSet: '$status' } } },
      { $project: { month: { $substr: ['$_id', 0, 7] } } },
      { $group: { _id: '$month' } },
      { $sort: { _id: -1 } },
    ]);
    const data = [];
    for (const item of months) {
      const records = await dailyRecordsForStudent(studentId, student.classId, `${item._id}-01`, `${item._id}-31`);
      if (!records) continue;
      const { start, end } = monthRange(item._id);
      const counts = statusCounts(records || [], workingDays(start, end));
      const date = new Date(`${item._id}-01T00:00:00Z`);
      data.push({
        month: item._id,
        monthName: date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
        year: date.getUTCFullYear(),
        summary: `${counts.present} present, ${counts.absent} absent, ${counts.leave} leave`,
        ...counts,
        percentage: counts.marked ? Number(((counts.present / counts.marked) * 100).toFixed(1)) : null,
      });
    }
    res.status(200).json({ success: true, total: data.length, data });
  } catch {
    res.status(503).json({ success: false, message: 'Could not load attendance months from MongoDB.' });
  }
}

export async function getAdminStudentMonthDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId, month } = req.params;
  if (!isValidMonth(month)) {
    res.status(400).json({ success: false, message: 'month must use YYYY-MM format.' });
    return;
  }
  try {
    const student = await StudentModel.findOne({ _id: studentId, archivedAt: { $in: ['', null] } }).lean();
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    const records = await dailyRecordsForStudent(studentId, student.classId, `${month}-01`, `${month}-31`);
    if (!records) {
      res.status(404).json({ success: false, message: 'Student is not enrolled in this class.' });
      return;
    }
    const { start, end } = monthRange(month);
    const dates = workingDays(start, end);
    const counts = statusCounts(records, dates);
    const today = new Date().toISOString().slice(0, 10);
    const weeks = weekStartsForMonth(month).map((weekStart, index) => {
      const parsed = new Date(`${weekStart}T00:00:00Z`);
      const weekEndDate = new Date(parsed);
      weekEndDate.setUTCDate(parsed.getUTCDate() + 5);
      const weekEnd = weekEndDate.toISOString().slice(0, 10) > end.toISOString().slice(0, 10)
        ? end.toISOString().slice(0, 10)
        : weekEndDate.toISOString().slice(0, 10);
      const weekDates = dates.filter((date) => date >= weekStart && date <= weekEnd);
      const weekCounts = statusCounts(records, weekDates);
      const inProgress = weekEnd >= today && month === today.slice(0, 7);
      return {
        week: index + 1,
        weekStart,
        weekEnd,
        label: `Week ${index + 1}`,
        statusLabel: inProgress ? 'In progress' : 'Final',
        summary: `${weekCounts.present} present, ${weekCounts.absent} absent, ${weekCounts.leave} leave`,
        ...weekCounts,
      };
    });
    const date = new Date(`${month}-01T00:00:00Z`);
    res.status(200).json({
      success: true,
      data: {
        month,
        monthName: date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
        year: date.getUTCFullYear(),
        statusLabel: month === today.slice(0, 7) ? 'In progress' : 'Final',
        summary: `${counts.present} days present, ${counts.absent} days absent, ${counts.leave} days leave`,
        ...counts,
        totalSchoolDaysMarked: counts.marked,
        percentage: counts.marked ? Number(((counts.present / counts.marked) * 100).toFixed(1)) : null,
        weeks,
      },
    });
  } catch {
    res.status(503).json({ success: false, message: 'Could not load the monthly attendance detail from MongoDB.' });
  }
}

export async function getAdminStudentWeekDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentId, week } = req.params;
  try {
    const student = await StudentModel.findOne({ _id: studentId, archivedAt: { $in: ['', null] } }).lean();
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }
    const month = week.slice(0, 7);
    if (!isValidMonth(month) || Number.isNaN(Date.parse(`${week}T00:00:00Z`))) {
      res.status(400).json({ success: false, message: 'Invalid week start date.' });
      return;
    }
    const { start, end } = monthRange(month);
    const weekEndDate = new Date(`${week}T00:00:00Z`);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 5);
    const weekEnd = weekEndDate.toISOString().slice(0, 10) > end.toISOString().slice(0, 10)
      ? end.toISOString().slice(0, 10)
      : weekEndDate.toISOString().slice(0, 10);
    if (!weekStartsForMonth(month).includes(week)) {
      res.status(404).json({ success: false, message: 'Week not found in this month.' });
      return;
    }
    const records = await dailyRecordsForStudent(studentId, student.classId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    if (!records) {
      res.status(404).json({ success: false, message: 'Student is not enrolled in this class.' });
      return;
    }
    const dates = workingDays(start, end).filter((date) => date >= week && date <= weekEnd);
    const counts = statusCounts(records, dates);
    const today = new Date().toISOString().slice(0, 10);
    const days = dates.map((date) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      return {
        date,
        dayName: parsed.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        status: records.find((record) => record.date === date)?.status || 'Not marked',
      };
    });
    res.status(200).json({
      success: true,
      data: {
        weekStart: week,
        weekEnd,
        week: weekStartsForMonth(month).indexOf(week) + 1,
        statusLabel: weekEnd >= today && month === today.slice(0, 7) ? 'In progress' : 'Final',
        summary: `${counts.present} days present, ${counts.absent} days absent, ${counts.leave} days leave`,
        ...counts,
        days,
      },
    });
  } catch {
    res.status(503).json({ success: false, message: 'Could not load the weekly attendance detail from MongoDB.' });
  }
}

const validAttendanceStatuses = new Set(['Present', 'Absent', 'Late', 'OnLeave', 'Leave']);
const normalizeAttendanceStatus = (status: string): 'Present' | 'Absent' | 'Late' | 'OnLeave' =>
  status === 'Leave' ? 'OnLeave' : status as 'Present' | 'Absent' | 'Late' | 'OnLeave';

async function validateAttendanceDate(date: string): Promise<string | null> {
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return 'A valid attendance date is required.';
  const today = new Date();
  const todayDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  if (date > todayDate) return 'Future attendance dates cannot be marked.';
  const calendar = await SchoolCalendarModel.findOne({ date }).lean();
  if (calendar?.type === 'Working') return null;
  if (calendar?.type === 'Holiday') return 'This date is a holiday and cannot be marked.';
  if ([0].includes(day.getUTCDay())) return 'Sunday is a holiday unless it is marked as a working day.';
  return null;
}

function attendanceEditCutoff(date: string): Date {
  const cutoff = new Date(`${date}T23:59:59.999Z`);
  const configuredDays = Math.max(0, Number(process.env.ATTENDANCE_EDIT_DAYS || 7));
  cutoff.setUTCDate(cutoff.getUTCDate() + configuredDays);
  return cutoff;
}

async function workingDatesInMonth(month: string): Promise<string[]> {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  const overrides = await SchoolCalendarModel.find({
    date: { $gte: month + '-01', $lte: month + '-' + String(end.getUTCDate()).padStart(2, '0') },
  }).lean();
  const overrideByDate = new Map(overrides.map((item: any) => [item.date, item.type]));
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const override = overrideByDate.get(date);
    if (override === 'Working' || (override !== 'Holiday' && cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6)) {
      dates.push(date);
    }
  }
  return dates;
}

async function notifyAbsences(sheet: any): Promise<void> {
  const absenceDate = sheet.date;
  const classInfo = store.getClasses().find((item) => item._id === String(sheet.classId));
  const classLabel = classInfo ? `${classInfo.name} - Section ${classInfo.section}` : 'class';
  const absentRecords = (sheet.records || []).filter((record: any) => record.status === 'Absent');
  for (const absent of absentRecords) {
    const student: any = await StudentModel.findOne({ _id: absent.studentId }).lean();
    if (!student) continue;
    const notificationKey = `attendance_absent:${absenceDate}:${student._id}`;
    const exists = await NotificationModel.exists({
      'metadata.notificationKey': notificationKey,
      type: 'attendance_absent',
    });
    if (exists) continue;
    const recipients = new Set<string>([
      ...(student.userId ? [student.userId] : []),
      ...(student.parentId ? [student.parentId] : []),
    ]);
    for (const userId of recipients) {
      await NotificationModel.create({
        _id: `notif_absent_${Date.now()}_${student._id}_${userId}`,
        userId,
        role: userId === student.parentId ? 'parent' : 'student',
        type: 'attendance_absent',
        title: 'Student marked absent',
        message: `${student.name} was marked absent on ${absenceDate} in ${classLabel}.`,
        link: '/attendance',
        isRead: false,
        read: false,
        metadata: { notificationKey },
      });
    }
  }
}

async function notifyLowAttendance(sheet: any): Promise<void> {
    const month = String(sheet.date).slice(0, 7);
    const threshold = Number(process.env.MIN_ATTENDANCE_PERCENTAGE || '75');
    const sheets = await AttendanceModel.find({
      classId: sheet.classId,
      section: sheet.section,
      date: new RegExp(`^${month}-`),
    }).lean();
    const denominator = new Set(sheets.map((item: any) => String(item.date))).size;
    if (!denominator) return;

    for (const record of sheet.records || []) {
      let present = 0;
      for (const monthlySheet of sheets) {
        const monthlyRecord = (monthlySheet.records || []).find((item: any) => String(item.studentId) === String(record.studentId));
        if (monthlyRecord?.status === 'Present' || monthlyRecord?.status === 'Late') present++;
      }
      const percentage = present / denominator * 100;
      if (percentage >= threshold) continue;
      const student: any = await StudentModel.findOne({ _id: record.studentId }).lean();
      if (!student) continue;
      const notificationKey = `attendance_low:${month}:${student._id}`;
      if (await NotificationModel.exists({ 'metadata.notificationKey': notificationKey })) continue;
      const recipients = new Set<string>([
        ...(student.parentId ? [String(student.parentId)] : []),
        ...store.getUsers().filter((user: any) => user.role === 'admin').map((user: any) => String(user._id)),
      ]);
      for (const recipient of recipients) {
        const isAdmin = store.getUsers().some((user: any) => String(user._id) === recipient && user.role === 'admin');
        await NotificationModel.create({
          _id: `notif_low_${Date.now()}_${student._id}_${recipient}`,
          userId: recipient,
          role: isAdmin ? 'admin' : 'parent',
          type: 'attendance_low',
          title: 'Attendance below minimum',
          message: `${student.name}'s attendance is ${percentage.toFixed(1)}%, below the ${threshold}% minimum.`,
          link: '/attendance',
          isRead: false,
          read: false,
          metadata: { notificationKey },
        });
    }
  }
}

function teacherClassForRequest(req: AuthenticatedRequest, requestedClassId?: string) {
  const teacher = getTeacherForUser(req.user);
  if (!teacher) return { error: 'Teacher profile not found.' } as const;
  const cls = store.getClasses().find((item) =>
    item.classTeacherId === teacher._id && (!requestedClassId || item._id === requestedClassId)
  );
  if (!cls) {
    return {
      error: requestedClassId
        ? '403: You are not the current class teacher of this class.'
        : '403: You are not assigned as class teacher of any class.',
      status: 403,
    } as const;
  }
  return { teacher, cls } as const;
}

export function getMyAttendanceClass(req: AuthenticatedRequest, res: Response): void {
  const result = teacherClassForRequest(req);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  res.status(200).json({ success: true, data: result.cls });
}

export async function getAttendanceStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = teacherClassForRequest(req);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ success: false, message: 'A valid date query parameter is required.' });
    return;
  }
  const students = await StudentModel.find({
    classId: result.cls._id,
    section: result.cls.section,
    status: 'Active',
    archivedAt: { $in: ['', null] },
  })
    .sort({ rollNo: 1, name: 1 }).lean();
  const attendance = await AttendanceModel.findOne({ classId: result.cls._id, section: result.cls.section, date }).lean();
  const approvedLeaves = await AttendanceLeaveModel.find({
    studentId: { $in: students.map((student: any) => student._id) },
    date,
    status: 'Approved',
  }).lean();
  const approvedLeaveIds = new Set(approvedLeaves.map((leave: any) => leave.studentId));
  const statusByStudent = new Map(
    ((attendance?.records || []) as any[]).map((record) => [record.studentId, record])
  );
  res.status(200).json({
    success: true,
    data: students.map((student: any) => ({
      studentId: student._id,
      name: student.name,
      rollNo: student.rollNo,
      admissionNo: student.admissionNo,
      status: approvedLeaveIds.has(student._id)
        ? 'OnLeave'
        : statusByStudent.get(student._id)?.status || 'Unmarked',
      remarks: statusByStudent.get(student._id)?.remarks || '',
      isMarked: Boolean(statusByStudent.get(student._id)),
      leaveLocked: approvedLeaveIds.has(student._id),
      isNewStudent: false,
    })),
    attendanceId: attendance?._id || null,
  });
}

export async function submitClassAttendance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { classId, date, records } = req.body as { classId?: string; date?: string; records?: any[] };
  const result = teacherClassForRequest(req, classId);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Array.isArray(records)) {
    res.status(400).json({ success: false, message: 'classId, date, and records are required.' });
    return;
  }
  const dateError = await validateAttendanceDate(date!);
  if (dateError) {
    res.status(400).json({ success: false, message: dateError });
    return;
  }
  if (new Date() > attendanceEditCutoff(date!)) {
    res.status(400).json({ success: false, message: 'Attendance for a date outside the edit window cannot be submitted.' });
    return;
  }
  const students = await StudentModel.find({
    classId,
    section: result.cls.section,
    status: 'Active',
    archivedAt: { $in: ['', null] },
  }).lean();
  const studentIds = new Set(students.map((student: any) => student._id));
  const uniqueIds = new Set(records.map((record) => record.studentId));
  if (records.some((record) => !studentIds.has(record.studentId) || !validAttendanceStatuses.has(record.status)) ||
      records.length !== studentIds.size || uniqueIds.size !== records.length) {
    res.status(400).json({ success: false, message: 'Submit one valid status for every enrolled student in the class.' });
    return;
  }
  const approvedLeaves = await AttendanceLeaveModel.find({
    studentId: { $in: [...studentIds] },
    date,
    status: 'Approved',
  }).lean();
  const lockedLeaveIds = new Set(approvedLeaves.map((leave: any) => leave.studentId));
  if (records.some((record: any) => lockedLeaveIds.has(record.studentId) && normalizeAttendanceStatus(record.status) !== 'OnLeave')) {
    res.status(400).json({ success: false, message: 'Approved leave students must be submitted as On Leave.' });
    return;
  }
  const existing = await AttendanceModel.findOne({ classId, section: result.cls.section, date });
  const attendanceRecords = records.map((record) => ({
    studentId: record.studentId,
    status: normalizeAttendanceStatus(record.status),
    remarks: typeof record.remarks === 'string' ? record.remarks.trim() : '',
  }));
  if (existing) {
    if (existing.takenBy && existing.takenBy !== result.teacher._id) {
      res.status(403).json({ success: false, message: 'This attendance sheet belongs to another class teacher.' });
      return;
    }
    existing.records = attendanceRecords as any;
    existing.editedAt = new Date();
    await existing.save();
    await notifyAbsences(existing);
    await notifyLowAttendance(existing);
    res.status(200).json({ success: true, message: 'Attendance updated.', data: existing });
    return;
  }
  const attendance = await AttendanceModel.create({
    _id: `attendance_${classId}_${date}_${Date.now()}`,
    classId,
    section: result.cls.section,
    date,
    takenBy: result.teacher._id,
    records: attendanceRecords,
    submittedAt: new Date(),
  });
  await notifyAbsences(attendance);
  await notifyLowAttendance(attendance);
  res.status(201).json({ success: true, message: 'Attendance submitted.', data: attendance });
}

export async function editClassAttendance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const attendance = await AttendanceModel.findOne({ _id: req.params.id }).lean();
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return;
  }
  const result = teacherClassForRequest(req, attendance.classId);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  const cutoff = attendanceEditCutoff(attendance.date);
  if (new Date() > cutoff) {
    res.status(409).json({ success: false, message: 'The attendance edit window has closed. Submit a correction request instead.' });
    return;
  }
  const before = attendance.records;
  const records = req.body.records as any[];
  if (!Array.isArray(records)) {
    res.status(400).json({ success: false, message: 'records array is required.' });
    return;
  }
  const validIds = new Set((attendance.records || []).map((record: any) => record.studentId));
  if (records.some((record) => !validIds.has(record.studentId) || !validAttendanceStatuses.has(record.status))) {
    res.status(400).json({ success: false, message: 'Only valid students and attendance statuses may be edited.' });
    return;
  }
  const approvedLeaves = await AttendanceLeaveModel.find({
    studentId: { $in: records.map((record: any) => record.studentId) },
    date: attendance.date,
    status: 'Approved',
  }).lean();
  const lockedLeaveIds = new Set(approvedLeaves.map((leave: any) => leave.studentId));
  if (records.some((record: any) => lockedLeaveIds.has(record.studentId) && normalizeAttendanceStatus(record.status) !== 'OnLeave')) {
    res.status(400).json({ success: false, message: 'Approved leave students must remain On Leave.' });
    return;
  }
  const updated = await AttendanceModel.findByIdAndUpdate(attendance._id, {
    $set: {
      records,
      editedAt: new Date(),
    },
  }, { new: true }).lean();
  await AuditEntryModel.create({
    _id: `audit_attendance_${Date.now()}_${attendance._id}`,
    type: 'attendance_edit',
    entityType: 'attendance',
    entityId: attendance._id,
    actorId: req.user!._id,
    before: { records: before },
    after: { records },
  });
  res.status(200).json({ success: true, message: 'Attendance edited.', data: updated });
}

export async function getAttendanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = teacherClassForRequest(req);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  const records = await AttendanceModel.find({ classId: result.cls._id, section: result.cls.section, records: { $exists: true } })
    .sort({ date: -1 }).lean();
  res.status(200).json({ success: true, data: records });
}

export async function getTeacherAttendanceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = teacherClassForRequest(req);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, message: 'month must be YYYY-MM.' });
    return;
  }
  const sheets = await AttendanceModel.find({
    classId: result.cls._id,
    section: result.cls.section,
    date: { $regex: `^${month}` },
  }).lean();
  const students = await StudentModel.find({
    classId: result.cls._id,
    section: result.cls.section,
    status: 'Active',
    archivedAt: { $in: ['', null] },
  }).sort({ rollNo: 1 }).lean();
  const calendarWorkingDays = await workingDatesInMonth(month);
  const submittedWorkingDays = new Set(sheets.map((sheet: any) => sheet.date));
  const workingDays = calendarWorkingDays.filter((date) => submittedWorkingDays.has(date));
  if (workingDays.length === 0 && sheets.length > 0) {
    workingDays.push(...sheets.map((sheet: any) => sheet.date).sort());
  }
  const denominator = workingDays.length;
  const report = students.map((student: any) => {
    const records = sheets.flatMap((sheet: any) =>
      (sheet.records || []).filter((record: any) => record.studentId === student._id)
        .map((record: any) => ({ date: sheet.date, status: record.status }))
    );
    const present = records.filter((record) => record.status === 'Present' || record.status === 'Late').length;
    const absent = records.filter((record) => record.status === 'Absent').length;
    const leave = records.filter((record) => record.status === 'OnLeave').length;
    const late = records.filter((record) => record.status === 'Late').length;
    const leaveDates = new Set(records.filter((record) => record.status === 'OnLeave').map((record) => record.date));
    const eligibleDays = workingDays.filter((date) => !leaveDates.has(date)).length;
    return {
      studentId: student._id,
      name: student.name,
      rollNo: student.rollNo,
      present, absent, leave, late,
      totalDays: eligibleDays,
      percentage: records.length && eligibleDays > 0 ? Number(((present / eligibleDays) * 100).toFixed(1)) : null,
      attendancePercentageLabel: records.length && eligibleDays > 0 ? undefined : 'No data yet',
      below75: records.length > 0 && eligibleDays > 0 && present / eligibleDays < 0.75,
      records,
    };
  });
  res.status(200).json({ success: true, data: { month, report } });
}

export async function requestAttendanceCorrection(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { attendanceId, studentId, newStatus, reason } = req.body as {
    attendanceId?: string; studentId?: string; newStatus?: string; reason?: string;
  };
  if (!attendanceId || !studentId || !newStatus || !reason?.trim() || !validAttendanceStatuses.has(newStatus)) {
    res.status(400).json({ success: false, message: 'attendanceId, studentId, newStatus, and reason are required.' });
    return;
  }
  const attendance = await AttendanceModel.findOne({ _id: attendanceId }).lean();
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return;
  }
  const result = teacherClassForRequest(req, attendance.classId);
  if ('error' in result) {
    res.status(result.status || 403).json({ success: false, message: String(result.error).replace(/^403: /, '') });
    return;
  }
  const oldRecord = (attendance.records || []).find((record: any) => record.studentId === studentId);
  if (!oldRecord) {
    res.status(404).json({ success: false, message: 'Student attendance record not found.' });
    return;
  }
  const correction = await AttendanceCorrectionRequestModel.create({
    _id: `attendance_correction_${Date.now()}_${studentId}`,
    attendanceId,
    studentId,
    oldStatus: normalizeAttendanceStatus(oldRecord.status),
    newStatus: normalizeAttendanceStatus(newStatus),
    reason: reason.trim(),
    status: 'Pending',
    requestedBy: result.teacher._id,
  });
  res.status(201).json({ success: true, message: 'Correction request submitted.', data: correction });
}

export async function getAdminAttendanceCorrections(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const corrections = await AttendanceCorrectionRequestModel.find({}).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, data: corrections });
}

export async function reviewAttendanceCorrection(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { status, reviewNote } = req.body as { status?: string; reviewNote?: string };
  if (!['Approved', 'Rejected'].includes(status || '')) {
    res.status(400).json({ success: false, message: 'status must be Approved or Rejected.' });
    return;
  }
  const reviewStatus = status as 'Approved' | 'Rejected';
  const correction: any = await AttendanceCorrectionRequestModel.findById(req.params.id);
  if (!correction) {
    res.status(404).json({ success: false, message: 'Correction request not found.' });
    return;
  }
  if (correction.status !== 'Pending') {
    res.status(409).json({ success: false, message: 'This correction request has already been reviewed.' });
    return;
  }
  correction.status = reviewStatus;
  correction.reviewedBy = req.user!._id;
  correction.reviewNote = typeof reviewNote === 'string' ? reviewNote.trim() : '';
  if (reviewStatus === 'Approved') {
    const attendance: any = await AttendanceModel.findById(correction.attendanceId);
    if (!attendance) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }
    const before = attendance.records.map((record: any) => ({ studentId: record.studentId, status: record.status }));
    const record = attendance.records.find((item: any) => item.studentId === correction.studentId);
    if (record) record.status = correction.newStatus;
    attendance.editedAt = new Date();
    await attendance.save();
    await AuditEntryModel.create({
      _id: `audit_correction_${Date.now()}_${correction._id}`,
      type: 'attendance_correction',
      entityType: 'attendance_correction',
      entityId: correction._id,
      actorId: req.user!._id,
      before: { records: before },
      after: { records: attendance.records },
      reason: correction.reason,
    });
  }
  await correction.save();
  const teacher = store.findTeacherById(correction.requestedBy);
  if (teacher?.userId) {
    await NotificationModel.create({
      _id: `notif_correction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: teacher.userId,
      role: 'teacher',
      type: `attendance_correction_${reviewStatus.toLowerCase()}`,
      title: `Attendance correction ${reviewStatus.toLowerCase()}`,
      message: `Your attendance correction request was ${reviewStatus.toLowerCase()}.${reviewNote ? ` ${reviewNote.trim()}` : ''}`,
      link: '/attendance',
      isRead: false,
      read: false,
    });
  }
  res.status(200).json({ success: true, message: `Correction ${reviewStatus.toLowerCase()}.`, data: correction });
}

export async function exportAttendanceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const format = String(req.params.format || '').toLowerCase();
  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  if (!['xlsx', 'pdf'].includes(format) || !classId || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, message: 'format, classId, and month (YYYY-MM) are required.' });
    return;
  }
  const cls = store.findClassById(classId);
  if (!cls) {
    res.status(404).json({ success: false, message: 'Class not found.' });
    return;
  }
  if (req.user?.role === 'teacher') {
    const teacher = getTeacherForUser(req.user);
    if (!teacher || cls.classTeacherId !== teacher._id) {
      res.status(403).json({ success: false, message: 'Only the current class teacher can export this report.' });
      return;
    }
  }
  const sheets = await AttendanceModel.find({ classId, date: { $regex: `^${month}` }, records: { $exists: true } }).lean();
  const students = await StudentModel.find({
    classId,
    section: cls.section,
    status: 'Active',
    archivedAt: { $in: ['', null] },
  }).sort({ rollNo: 1 }).lean();
  const calendarWorking = await workingDatesInMonth(month);
  const submittedDates = new Set(sheets.map((sheet: any) => sheet.date));
  const working = calendarWorking.filter((date) => submittedDates.has(date));
  const rows = students.map((student: any) => {
    const records = sheets.flatMap((sheet: any) =>
      (sheet.records || []).filter((record: any) => record.studentId === student._id)
        .map((record: any) => ({ status: record.status, date: sheet.date }))
    );
    const leaveDates = new Set(records.filter((record) => record.status === 'OnLeave').map((record) => record.date));
    const eligibleDays = working.filter((date) => !leaveDates.has(date)).length;
    const present = records.filter((record) => record.status === 'Present' || record.status === 'Late').length;
    const percentage = records.length && eligibleDays > 0 ? Number(((present / eligibleDays) * 100).toFixed(1)) : null;
    return [student.rollNo, student.name, present, records.filter((record) => record.status === 'Absent').length, eligibleDays, percentage ?? 'No data yet', percentage != null && percentage < 75 ? 'Yes' : 'No'];
  });

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');
    worksheet.addRow(['Roll No', 'Student', 'Present', 'Absent/Leave/Late', 'Marked Days', 'Percentage', 'Below 75%']);
    rows.forEach((row) => worksheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${classId}-${month}.xlsx"`);
    res.status(200).send(await workbook.xlsx.writeBuffer());
    return;
  }

  const document = new jsPDF();
  document.setFontSize(14);
  document.text(`Attendance Report - ${cls.name} - ${month}`, 14, 18);
  document.setFontSize(10);
  rows.forEach((row, index) => document.text(String(row.join(' | ')), 14, 28 + index * 6));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${classId}-${month}.pdf"`);
  res.status(200).send(Buffer.from(document.output('arraybuffer')));
}
