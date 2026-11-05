import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessClass } from '../services/teacherAccess.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function success(res: Response, status: number, data: unknown, message?: string) {
  res.status(status).json({ success: true, ...(message ? { message } : {}), data });
}

function failure(res: Response, status: number, message: string, data?: unknown) {
  res.status(status).json({ success: false, message, ...(data === undefined ? {} : { data }) });
}

function parseTime(time: unknown): string | null {
  return typeof time === 'string' && TIME_PATTERN.test(time) ? time : null;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function sortSlots(slots: any[]) {
  const order = DAYS;
  return [...slots].sort((a, b) =>
    order.indexOf(a.day) - order.indexOf(b.day) ||
    (a.periodNo ?? a.period) - (b.periodNo ?? b.period) ||
    a.startTime.localeCompare(b.startTime)
  );
}

function normalizeSlotInput(body: any, classAcademicYear?: string) {
  const periodNo = Number(body.periodNo ?? body.period);
  return {
    classId: String(body.classId || ''),
    day: body.day,
    period: periodNo,
    periodNo,
    startTime: parseTime(body.startTime),
    endTime: parseTime(body.endTime),
    subjectId: String(body.subjectId || ''),
    teacherId: String(body.teacherId || ''),
    room: String(body.room ?? body.roomNo ?? '').trim(),
    roomNo: String(body.room ?? body.roomNo ?? '').trim(),
    academicYear: String(body.academicYear || classAcademicYear || '').trim(),
  };
}

function validateSlot(res: Response, input: ReturnType<typeof normalizeSlotInput>): boolean {
  if (!input.classId || !input.day || !input.startTime || !input.endTime || !input.subjectId || !input.teacherId || !input.academicYear) {
    failure(res, 400, 'classId, day, periodNo, startTime, endTime, subjectId, teacherId, and academicYear are required.');
    return false;
  }
  if (!Number.isInteger(input.periodNo) || input.periodNo < 1) {
    failure(res, 400, 'periodNo must be a positive integer.');
    return false;
  }
  if (!DAYS.includes(input.day)) {
    failure(res, 400, 'Select a valid day.');
    return false;
  }
  if (toMinutes(input.endTime) <= toMinutes(input.startTime)) {
    failure(res, 400, 'endTime must be later than startTime.');
    return false;
  }
  return true;
}

function getCurrentTeacher(req: AuthenticatedRequest, res: Response) {
  const teacher = store.findTeacherByUserId(req.user!._id);
  if (!teacher) {
    failure(res, 403, 'No teacher profile is linked to your account.');
    return null;
  }
  return teacher;
}

export function getClassTimetable(req: AuthenticatedRequest, res: Response): void {
  const classId = String(req.params.classId || req.query.classId || '');
  const cls = store.findClassById(classId);
  if (!cls) {
    failure(res, 404, 'Class not found.');
    return;
  }
  if (req.user?.role === 'student') {
    const student = store.findStudentByUserId(req.user._id);
    if (!student || student.classId !== classId) {
      failure(res, 403, 'Access denied: this is not your class timetable.');
      return;
    }
  } else if (req.user?.role === 'teacher' && !canAccessClass(req.user, classId)) {
    failure(res, 403, 'Access denied: this class is not assigned to you.');
    return;
  }

  success(res, 200, {
    class: { _id: cls._id, name: cls.name, section: cls.section, roomNo: cls.roomNo },
    slots: sortSlots(store.getTimetable(classId)),
  });
}

export function getMyStudentTimetable(req: AuthenticatedRequest, res: Response): void {
  const student = store.findStudentByUserId(req.user!._id);
  if (!student) {
    failure(res, 403, 'No student profile is linked to your account.');
    return;
  }
  success(res, 200, sortSlots(store.getTimetable(student.classId)));
}

export function getTimetable(req: AuthenticatedRequest, res: Response): void {
  if (req.user?.role === 'student') {
    getMyStudentTimetable(req, res);
    return;
  }
  if (req.user?.role === 'teacher') {
    getMyTeacherTimetable(req, res);
    return;
  }

  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
  if (classId) {
    const cls = store.findClassById(classId);
    if (!cls) {
      failure(res, 404, 'Class not found.');
      return;
    }
    success(res, 200, sortSlots(store.getTimetable(classId)), undefined);
    return;
  }
  success(res, 200, sortSlots(store.getTimetable()), undefined);
}

export function getMyTeacherTimetable(req: AuthenticatedRequest, res: Response): void {
  const teacher = getCurrentTeacher(req, res);
  if (!teacher) return;
  success(res, 200, sortSlots(store.getTimetable(undefined, teacher._id)));
}

export function getTeacherTimetable(req: AuthenticatedRequest, res: Response): void {
  const teacher = store.findTeacherById(req.params.teacherId);
  if (!teacher) {
    failure(res, 404, 'Teacher not found.');
    return;
  }
  success(res, 200, sortSlots(store.getTimetable(undefined, teacher._id)));
}

export function getTimetableClashes(_req: AuthenticatedRequest, res: Response): void {
  const clashes = store.timetable.filter((slot) => {
    const subject = store.findSubjectById(slot.subjectId);
    const assignedTeacherId = subject ? store.getSubjectTeacherId(subject, slot.classId) : '';
    return !slot.teacherId ||
      !store.findTeacherById(slot.teacherId) ||
      assignedTeacherId !== slot.teacherId ||
      !subject;
  }).map((slot) => {
    const cls = store.findClassById(slot.classId);
    return {
      ...slot,
      className: cls ? `${cls.name} - Section ${cls.section}` : 'Unknown class',
      reason: !slot.teacherId || !store.findTeacherById(slot.teacherId)
        ? 'Teacher unassigned'
        : 'Teacher no longer matches the subject assignment',
    };
  });
  success(res, 200, clashes);
}

export function checkTimetableConflict(req: AuthenticatedRequest, res: Response): void {
  const cls = store.findClassById(req.body.classId);
  const input = normalizeSlotInput(req.body, cls?.academicYear);
  if (!validateSlot(res, input)) return;
  const conflicts = store.checkTimetableConflicts(input as any, req.body.excludeSlotId || undefined);
  success(res, 200, { available: conflicts.length === 0, conflicts }, conflicts.length ? 'Timetable slot has conflicts.' : 'Timetable slot is available.');
}

export function getTimetableFormData(req: AuthenticatedRequest, res: Response): void {
  const classId = String(req.query.classId || '');
  const cls = store.findClassById(classId);
  if (!cls) {
    failure(res, 400, 'A valid classId is required.');
    return;
  }
  const subjects = store.getSubjects(classId).map((subject) => ({
    _id: subject._id,
    name: subject.name,
    code: subject.code,
    teacherId: store.getSubjectTeacherId(subject, classId),
    teacherName: store.findTeacherById(store.getSubjectTeacherId(subject, classId))?.name || '',
  }));
  const teacherIds = new Set(subjects.map((subject) => subject.teacherId).filter(Boolean));
  const teachers = store.getTeachers()
    .filter((teacher) => teacherIds.has(teacher._id))
    .map(({ _id, name, employeeId }) => ({ _id, name, employeeId }));
  const rooms = [...new Set([
    cls.roomNo,
    ...store.timetable.map((slot) => slot.room || slot.roomNo || '').filter(Boolean),
  ])].filter(Boolean);
  success(res, 200, { subjects, teachers, rooms });
}

function validateReferences(res: Response, input: ReturnType<typeof normalizeSlotInput>): boolean {
  const cls = store.findClassById(input.classId);
  const subject = store.getSubjects(input.classId).find((item) => item._id === input.subjectId);
  const teacher = store.findTeacherById(input.teacherId);
  if (!cls || !subject || !teacher) {
    failure(res, 400, 'Select a valid class, one of its subjects, and a valid teacher.');
    return false;
  }
  if (store.getSubjectTeacherId(subject, input.classId) !== input.teacherId) {
    failure(res, 400, 'The timetable teacher must be assigned to the selected class subject.');
    return false;
  }
  return true;
}

export function createTimetableSlot(req: AuthenticatedRequest, res: Response): void {
  const cls = store.findClassById(req.body.classId);
  const input = normalizeSlotInput(req.body, cls?.academicYear);
  if (!validateSlot(res, input) || !validateReferences(res, input)) return;
  const result = store.createTimetableSlot(input as any);
  if (result.error) {
    failure(res, 409, result.error);
    return;
  }
  success(res, 201, result.slot, 'Timetable slot created successfully.');
}

export function updateTimetableSlot(req: AuthenticatedRequest, res: Response): void {
  const cls = store.findClassById(req.body.classId);
  const input = normalizeSlotInput(req.body, cls?.academicYear);
  if (!validateSlot(res, input) || !validateReferences(res, input)) return;
  const result = store.updateTimetableSlot(req.params.id, input as any);
  if (result.error) {
    failure(res, result.error === 'Timetable slot not found.' ? 404 : 409, result.error);
    return;
  }
  success(res, 200, result.slot, 'Timetable slot updated successfully.');
}

export function deleteTimetableSlot(req: AuthenticatedRequest, res: Response): void {
  const deleted = store.deleteTimetableSlot(req.params.id);
  if (!deleted) {
    failure(res, 404, 'Timetable slot not found.');
    return;
  }
  success(res, 200, null, 'Timetable slot removed successfully.');
}
