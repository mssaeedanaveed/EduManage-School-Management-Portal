import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessClass, getTeacherForUser, isClassTeacher, syncTeacherAssignments } from '../services/teacherAccess.js';
import { AuditEntryModel, NotificationModel } from '../models/index.js';

type ClassForm = {
  name: string;
  section: string;
  roomNo: string;
  capacity: number;
  academicYear: string;
  classTeacherId: string;
  subjectIds: string[];
  newSubjects: string[];
};

function isAcademicYear(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{4}$/.test(value.trim());
}

function readClassForm(body: Record<string, unknown>, existing?: ReturnType<typeof store.findClassById>): ClassForm | string {
  const nameValue = body.className ?? body.name;
  const name = typeof nameValue === 'string' ? nameValue.trim() : existing?.name || '';
  const section = typeof body.section === 'string' ? body.section.trim() : existing?.section || '';
  const roomNo = typeof body.roomNo === 'string' ? body.roomNo.trim() : existing?.roomNo || '';
  const capacityValue = body.maxCapacity ?? body.capacity ?? existing?.capacity;
  const capacity = Number(capacityValue);
  const academicYearValue = body.academicYear ?? existing?.academicYear;
  const academicYear = typeof academicYearValue === 'string' ? academicYearValue.trim() : '';
  const classTeacherValue = body.classTeacher ?? body.classTeacherId ?? existing?.classTeacherId;
  const classTeacherId = typeof classTeacherValue === 'string' ? classTeacherValue.trim() : '';
  const subjectValue = body.subjectIds ?? body.subjects ?? (existing ? store.getSubjects(existing._id).map((subject) => subject._id) : []);
  const newSubjectValue = body.newSubjects ?? [];

  if (!name) return 'Class name is required.';
  if (!section) return 'Section is required.';
  if (!roomNo && (!existing || body.roomNo !== undefined)) return 'Room number is required.';
  if (!Number.isInteger(capacity) || capacity < 1) return 'Max capacity must be a positive whole number.';
  if (!isAcademicYear(academicYear)) return 'Academic year must use the format YYYY-YYYY, for example 2026-2027.';
  if (!classTeacherId && !existing) return 'Select a class teacher.';
  if (!Array.isArray(subjectValue) || subjectValue.some((id) => typeof id !== 'string')) {
    return 'Select at least one valid subject.';
  }
  if (!Array.isArray(newSubjectValue) || newSubjectValue.some((name) => typeof name !== 'string' || !name.trim())) {
    return 'New subject names must not be blank.';
  }
  const subjectIds = [...new Set(subjectValue as string[])];
  const newSubjects = [...new Set((newSubjectValue as string[]).map((name) => name.trim()))];
  if (new Set(newSubjects.map((name) => name.toLowerCase())).size !== newSubjects.length) {
    return 'New subject names must be unique.';
  }
  if (subjectIds.length + newSubjects.length === 0 && (!existing || body.subjectIds !== undefined || body.subjects !== undefined)) {
    return 'Select or add at least one subject.';
  }
  if (newSubjects.some((name) => subjectIds.some((id) =>
    store.findSubjectById(id)?.name.trim().toLowerCase() === name.toLowerCase()
  ))) {
    return 'A subject cannot be both selected and added as new.';
  }
  const duplicateExistingSubject = existing && store.getSubjects(existing._id).find((subject) =>
    newSubjects.some((name) => subject.name.trim().toLowerCase() === name.toLowerCase())
  );
  if (duplicateExistingSubject) {
    return `${duplicateExistingSubject.name} already exists in ${existing.name}.`;
  }
  return { name, section, roomNo, capacity, academicYear, classTeacherId, subjectIds, newSubjects };
}

function classDuplicate(name: string, section: string, academicYear: string, excludeId?: string) {
  return store.getClasses().find((cls) =>
    cls._id !== excludeId &&
    cls.name.trim().toLowerCase() === name.toLowerCase() &&
    cls.section.trim().toLowerCase() === section.toLowerCase() &&
    cls.academicYear.trim().toLowerCase() === academicYear.toLowerCase()
  );
}

function roomDuplicate(roomNo: string, academicYear: string, excludeId?: string) {
  return store.getClasses().find((cls) =>
    cls._id !== excludeId &&
    cls.roomNo.trim().toLowerCase() === roomNo.toLowerCase() &&
    cls.academicYear.trim().toLowerCase() === academicYear.toLowerCase()
  );
}

function uniqueSubjectCode(name: string, classId: string): string {
  const base = name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'SUBJECT';
  const codes = new Set(store.getSubjects().map((subject) => subject.code.trim().toUpperCase()));
  let code = base;
  let suffix = 2;
  while (codes.has(code)) {
    code = `${base.slice(0, 10 - String(suffix).length)}${suffix}`;
    suffix += 1;
  }
  return code;
}

function createNewSubjects(classId: string, names: string[]): string[] {
  const cls = store.findClassById(classId);
  if (!cls) return [];
  const classIds = store.getClasses()
    .filter((item) =>
      item.name.trim().toLowerCase() === cls.name.trim().toLowerCase() &&
      item.academicYear.trim().toLowerCase() === cls.academicYear.trim().toLowerCase()
    )
    .map((item) => item._id);
  return names.map((name) => {
    const subject = store.createSubject({
      name,
      code: uniqueSubjectCode(name, classId),
      classId,
      classIds,
      className: cls.name,
      academicYear: cls.academicYear,
      classGroupKey: store.classGroupKey(cls.name, cls.academicYear),
      sectionAssignments: classIds.map((id) => ({ classId: id, teacherId: '' })),
      credits: 3,
    });
    store.setSubjectClassIds(subject._id, classIds);
    return subject._id;
  });
}

export function getAllClasses(req: AuthenticatedRequest, res: Response): void {
  const classes = req.user?.role === 'teacher'
    ? store.getClasses().filter((cls) => canAccessClass(req.user, cls._id))
    : store.getClasses();

  const enriched = classes.map((cls) => {
    const subjects = store.getSubjects(cls._id).filter((subject) =>
      req.user?.role !== 'teacher' || isClassTeacher(req.user, cls._id) ||
      subject.teacherId === getTeacherForUser(req.user)?._id
    );
    return {
      ...cls,
      studentCount: store.getStudents({ classId: cls._id }).length,
      subjectCount: subjects.length,
      subjects: subjects.map((subject) => subject._id),
    };
  });

  res.status(200).json({ success: true, total: enriched.length, data: enriched });
}

export function getAvailableClassTeachers(req: AuthenticatedRequest, res: Response): void {
  const excludeClassId = typeof req.query.excludeClassId === 'string' ? req.query.excludeClassId : '';
  if (excludeClassId && !store.findClassById(excludeClassId)) {
    res.status(404).json({ success: false, message: 'Class or section not found.' });
    return;
  }
  const assignedElsewhere = new Set(
    store.getClasses()
      .filter((cls) => cls._id !== excludeClassId && cls.classTeacherId)
      .map((cls) => cls.classTeacherId)
  );
  const currentTeacherId = excludeClassId ? store.findClassById(excludeClassId)?.classTeacherId : undefined;
  const teachers = store.getTeachers().filter((teacher) =>
    !assignedElsewhere.has(teacher._id) || teacher._id === currentTeacherId
  );
  res.status(200).json({ success: true, total: teachers.length, data: teachers });
}

export function checkRoomAvailability(req: AuthenticatedRequest, res: Response): void {
  const { roomNo, academicYear, excludeClassId } = req.query;
  if (typeof roomNo !== 'string' || !roomNo.trim() || !isAcademicYear(academicYear)) {
    res.status(400).json({ success: false, message: 'Provide a room number and academic year in YYYY-YYYY format.' });
    return;
  }
  const occupied = roomDuplicate(roomNo.trim(), academicYear.trim(), typeof excludeClassId === 'string' ? excludeClassId : undefined);
  if (occupied) {
    res.status(409).json({
      success: false,
      available: false,
      message: `Room ${occupied.roomNo} is occupied by ${occupied.name} - Section ${occupied.section}.`,
      data: { classId: occupied._id, className: occupied.name, section: occupied.section },
    });
    return;
  }
  res.status(200).json({ success: true, available: true, message: 'Room is available.' });
}

export function getClassById(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const cls = store.findClassById(id);

  if (!cls) {
    res.status(404).json({ success: false, message: 'Class not found' });
    return;
  }
  if (req.user?.role === 'teacher' && !canAccessClass(req.user, cls._id)) {
    res.status(403).json({ success: false, message: 'Access denied: This class is not assigned to you.' });
    return;
  }

  const students = store.getStudents({ classId: cls._id });
  const teacher = getTeacherForUser(req.user);
  const subjects = store.getSubjects(cls._id).filter((subject) =>
    req.user?.role !== 'teacher' || isClassTeacher(req.user, cls._id) || subject.teacherId === teacher?._id
  );
  const timetable = store.getTimetable(cls._id).filter((slot) =>
    req.user?.role !== 'teacher' || isClassTeacher(req.user, cls._id) || slot.teacherId === teacher?._id
  );
  const feeStructure = req.user?.role === 'teacher' ? undefined : store.getFeeStructureByClass(cls._id);

  res.status(200).json({
    success: true,
    data: { ...cls, students, subjects, timetable, feeStructure },
  });
}

export function createClass(req: AuthenticatedRequest, res: Response): void {
  const form = readClassForm(req.body);
  if (typeof form === 'string') {
    res.status(400).json({ success: false, message: form });
    return;
  }
  if (form.classTeacherId && !store.findTeacherById(form.classTeacherId)) {
    res.status(400).json({ success: false, message: 'Select a class teacher who currently exists in the Faculty Directory.' });
    return;
  }
  if (form.classTeacherId && store.getClasses().some((cls) => cls.classTeacherId === form.classTeacherId)) {
    res.status(409).json({ success: false, message: 'This teacher is already the class teacher of another class or section.' });
    return;
  }
  const duplicate = classDuplicate(form.name, form.section, form.academicYear);
  if (duplicate) {
    res.status(409).json({
      success: false,
      message: `Section ${form.section} of ${form.name} is already created in the school.`,
    });
    return;
  }
  const occupied = roomDuplicate(form.roomNo, form.academicYear);
  if (occupied) {
    res.status(409).json({
      success: false,
      message: `Room ${occupied.roomNo} is occupied by ${occupied.name} - Section ${occupied.section}.`,
    });
    return;
  }
  const groupKey = store.classGroupKey(form.name, form.academicYear);
  const existingGroupClassIds = store.getClasses()
    .filter((cls) => store.classGroupKey(cls.name, cls.academicYear) === groupKey)
    .map((cls) => cls._id);
  if (form.subjectIds.some((subjectId) => {
    const subject = store.findSubjectById(subjectId);
    return !subject || (subject.classGroupKey !== groupKey &&
      !store.getSubjectClassIds(subject).some((classId) => existingGroupClassIds.includes(classId)));
  })) {
    res.status(400).json({ success: false, message: 'Select subjects that are already assigned to this class and academic year.' });
    return;
  }
  const duplicateNewSubject = form.newSubjects.find((name) =>
    store.getSubjects().some((subject) =>
      subject.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      (subject.classGroupKey === groupKey || store.getSubjectClassIds(subject).some((classId) => existingGroupClassIds.includes(classId)))
    )
  );
  if (duplicateNewSubject) {
    res.status(409).json({ success: false, message: `${duplicateNewSubject} already exists in ${form.name}.` });
    return;
  }

  const cls = store.createClass({
    name: form.name,
    section: form.section,
    roomNo: form.roomNo,
    capacity: form.capacity,
    academicYear: form.academicYear,
    classTeacherId: form.classTeacherId,
    subjects: [],
  });
  const newGroupClassIds = [...existingGroupClassIds, cls._id];
  const existingGroupSubjectIds = [...new Set(existingGroupClassIds.flatMap((classId) =>
    store.getSubjects(classId).map((subject) => subject._id)
  ))];
  for (const subjectId of [...new Set([...existingGroupSubjectIds, ...form.subjectIds])]) {
    const subject = store.findSubjectById(subjectId);
    if (subject) store.setSubjectClassIds(subjectId, [...new Set([...store.getSubjectClassIds(subject), ...newGroupClassIds])]);
  }
  const newSubjectIds = createNewSubjects(cls._id, form.newSubjects);
  const updated = store.updateClass(cls._id, {
    subjects: [...new Set([...existingGroupSubjectIds, ...form.subjectIds, ...newSubjectIds])],
  }) || cls;
  if (form.classTeacherId) store.updateTeacher(form.classTeacherId, { designation: 'Class Teacher' });
  syncTeacherAssignments();

  res.status(201).json({ success: true, message: 'Class created successfully', data: updated });
}

export function createClassSections(req: AuthenticatedRequest, res: Response): void {
  const { name, sections, roomNo, capacity, academicYear } = req.body as {
    name?: unknown;
    sections?: unknown;
    roomNo?: unknown;
    capacity?: unknown;
    academicYear?: unknown;
  };
  const year = typeof academicYear === 'string' && academicYear.trim() ? academicYear.trim() : '2026-2027';
  const room = typeof roomNo === 'string' ? roomNo.trim() : '';
  const sectionCapacity = Number(capacity ?? 40);
  if (typeof name !== 'string' || !name.trim() || !Array.isArray(sections) || sections.length === 0 ||
      sections.some((section) => typeof section !== 'string' || !section.trim())) {
    res.status(400).json({ success: false, message: 'Provide a class name and at least one valid section.' });
    return;
  }
  if (!isAcademicYear(year)) {
    res.status(400).json({ success: false, message: 'Academic year must use the format YYYY-YYYY, for example 2026-2027.' });
    return;
  }
  if (!Number.isInteger(sectionCapacity) || sectionCapacity < 1) {
    res.status(400).json({ success: false, message: 'Max capacity must be a positive whole number.' });
    return;
  }
  const normalizedSections = (sections as string[]).map((section) => section.trim());
  if (new Set(normalizedSections.map((section) => section.toLowerCase())).size !== normalizedSections.length) {
    res.status(409).json({ success: false, message: 'The section list contains duplicates.' });
    return;
  }
  const duplicate = normalizedSections.find((section) =>
    classDuplicate(name.trim(), section, year)
  );
  if (duplicate) {
    res.status(409).json({
      success: false,
      message: `Section ${duplicate} of ${name.trim()} is already created in the school.`,
    });
    return;
  }
  const occupied = room ? roomDuplicate(room, year) : undefined;
  if (occupied) {
    res.status(409).json({
      success: false,
      message: `Room ${occupied.roomNo} is occupied by ${occupied.name} - Section ${occupied.section}.`,
    });
    return;
  }
  const created = normalizedSections.map((section) => store.createClass({
    name: name.trim(),
    section,
    roomNo: room,
    capacity: sectionCapacity,
    academicYear: year,
    classTeacherId: undefined,
    subjects: [],
  }));
  const existingGroupClassIds = store.getClasses()
    .filter((cls) =>
      cls.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      cls.academicYear.trim().toLowerCase() === year.toLowerCase() &&
      !created.some((newClass) => newClass._id === cls._id)
    )
    .map((cls) => cls._id);
  const groupSubjectIds = [...new Set(existingGroupClassIds.flatMap((classId) =>
    store.getSubjects(classId).map((subject) => subject._id)
  ))];
  const allGroupClassIds = [...existingGroupClassIds, ...created.map((cls) => cls._id)];
  for (const subjectId of groupSubjectIds) {
    store.setSubjectClassIds(subjectId, allGroupClassIds);
  }
  for (const cls of created) store.updateClass(cls._id, { subjects: groupSubjectIds });
  res.status(201).json({
    success: true,
    message: `Created ${created.length} section${created.length === 1 ? '' : 's'} for ${name.trim()}.`,
    total: created.length,
    data: created,
  });
}

export function updateClass(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const existing = store.findClassById(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Class not found' });
    return;
  }
  const form = readClassForm(req.body, existing);
  if (typeof form === 'string') {
    res.status(400).json({ success: false, message: form });
    return;
  }
  if (form.classTeacherId && !store.findTeacherById(form.classTeacherId)) {
    res.status(400).json({ success: false, message: 'Select a class teacher who currently exists in the Faculty Directory.' });
    return;
  }
  if (form.classTeacherId && store.getClasses().some((cls) => cls._id !== id && cls.classTeacherId === form.classTeacherId)) {
    res.status(409).json({ success: false, message: 'This teacher is already the class teacher of another class or section.' });
    return;
  }
  if (classDuplicate(form.name, form.section, form.academicYear, id)) {
    res.status(409).json({
      success: false,
      message: `Section ${form.section} of ${form.name} is already created in the school.`,
    });
    return;
  }
  const occupied = roomDuplicate(form.roomNo, form.academicYear, id);
  if (occupied) {
    res.status(409).json({
      success: false,
      message: `Room ${occupied.roomNo} is occupied by ${occupied.name} - Section ${occupied.section}.`,
    });
    return;
  }
  const studentCount = store.getStudents({ classId: id }).length;
  if (form.capacity < studentCount) {
    res.status(409).json({
      success: false,
      message: `Max capacity cannot be less than the ${studentCount} students currently enrolled in this class.`,
    });
    return;
  }
  const nextGroupKey = store.classGroupKey(form.name, form.academicYear);
  const targetGroupClassIds = store.getClasses()
    .filter((cls) => cls._id === id || store.classGroupKey(cls.name, cls.academicYear) === nextGroupKey)
    .map((cls) => cls._id);
  const invalidSubject = form.subjectIds.find((subjectId) => {
    const subject = store.findSubjectById(subjectId);
    return !subject || (subject.classGroupKey !== nextGroupKey &&
      !store.getSubjectClassIds(subject).some((classId) => targetGroupClassIds.includes(classId)));
  });
  if (invalidSubject) {
    res.status(400).json({ success: false, message: 'Subjects must belong to this class and academic year.' });
    return;
  }

  const previousTeacherId = existing.classTeacherId;
  const previousGroupKey = store.classGroupKey(existing.name, existing.academicYear);
  const previousSubjectIds = store.getSubjects(id).map((subject) => subject._id);
  const existingGroupSubjectIds = previousGroupKey === nextGroupKey
    ? []
    : store.getClasses()
      .filter((cls) => store.classGroupKey(cls.name, cls.academicYear) === nextGroupKey)
      .flatMap((cls) => store.getSubjects(cls._id).map((subject) => subject._id));
  const duplicateNewSubject = form.newSubjects.find((name) =>
    store.getSubjects().some((subject) =>
      subject.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      (subject.classGroupKey === nextGroupKey ||
        store.getSubjectClassIds(subject).some((classId) => targetGroupClassIds.includes(classId)))
    )
  );
  if (duplicateNewSubject) {
    res.status(409).json({ success: false, message: `${duplicateNewSubject} already exists in ${form.name}.` });
    return;
  }
  const nextSubjectIds = [...new Set([...existingGroupSubjectIds, ...form.subjectIds])];
  const removedFromGroup = previousGroupKey === nextGroupKey
    ? previousSubjectIds.filter((subjectId) => !nextSubjectIds.includes(subjectId))
    : [];
  const removalBlockers = removedFromGroup.flatMap((subjectId) => {
    const attendanceCount = store.attendance.filter((record) => record.subjectId === subjectId).length;
    const resultCount = store.results.filter((result) => result.marks.some((mark) => mark.subjectId === subjectId)).length;
    return [
      attendanceCount ? `${store.findSubjectById(subjectId)?.name}: ${attendanceCount} attendance record(s).` : '',
      resultCount ? `${store.findSubjectById(subjectId)?.name}: ${resultCount} result record(s).` : '',
    ].filter(Boolean);
  });
  if (removalBlockers.length) {
    res.status(409).json({
      success: false,
      message: 'Cannot remove class subjects while attendance or result records exist.',
      blockers: removalBlockers,
    });
    return;
  }
  const updated = store.updateClass(id, {
    name: form.name,
    section: form.section,
    roomNo: form.roomNo,
    capacity: form.capacity,
    academicYear: form.academicYear,
    classTeacherId: form.classTeacherId,
    subjects: [],
  });
  if (!updated) {
    res.status(404).json({ success: false, message: 'Class not found' });
    return;
  }
  const currentGroupClassIds = store.getClasses()
    .filter((cls) => store.classGroupKey(cls.name, cls.academicYear) === nextGroupKey)
    .map((cls) => cls._id);
  const newSubjectIds = createNewSubjects(id, form.newSubjects);
  const finalSubjectIds = [...new Set([...nextSubjectIds, ...newSubjectIds])];
  for (const subjectId of finalSubjectIds) {
    const subject = store.findSubjectById(subjectId);
    if (subject) store.setSubjectClassIds(subjectId, [...new Set([...store.getSubjectClassIds(subject), ...currentGroupClassIds])]);
  }
  for (const subjectId of previousSubjectIds.filter((subjectId) => !finalSubjectIds.includes(subjectId))) {
    if (previousGroupKey === nextGroupKey) {
      for (const slot of store.getTimetable().filter((item) => item.subjectId === subjectId)) {
        store.deleteTimetableSlot(slot._id);
      }
      store.deleteSubject(subjectId);
    } else {
      const subject = store.findSubjectById(subjectId);
      if (subject) store.setSubjectClassIds(subjectId, store.getSubjectClassIds(subject).filter((classId) => classId !== id));
    }
  }
  store.updateClass(id, { subjects: finalSubjectIds });
  if (previousTeacherId && previousTeacherId !== form.classTeacherId &&
      !store.getClasses().some((cls) => cls.classTeacherId === previousTeacherId)) {
    store.updateTeacher(previousTeacherId, { designation: 'Subject Teacher' });
  }
  if (form.classTeacherId) store.updateTeacher(form.classTeacherId, { designation: 'Class Teacher' });
  syncTeacherAssignments();

  res.status(200).json({ success: true, message: 'Class updated successfully', data: updated });
}

export async function setClassTeacher(req: AuthenticatedRequest, res: Response): Promise<void> {
  const cls = store.findClassById(req.params.id);
  if (!cls) {
    res.status(404).json({ success: false, message: 'Class or section not found.' });
    return;
  }

  const body = req.body as { classTeacherId?: string | null };
  const newTeacherId = typeof body.classTeacherId === 'string' ? body.classTeacherId.trim() : '';
  const oldTeacherId = cls.classTeacherId || '';

  if (newTeacherId && !store.findTeacherById(newTeacherId)) {
    res.status(400).json({ success: false, message: 'The selected teacher does not exist.' });
    return;
  }
  const otherAssignment = store.getClasses().find((item) =>
    item._id !== cls._id && item.classTeacherId === newTeacherId
  );
  if (newTeacherId && otherAssignment) {
    res.status(409).json({
      success: false,
      message: 'This teacher already teaches another class or section. Please reassign them first.',
    });
    return;
  }

  const updated = store.updateClass(cls._id, {
    classTeacherId: newTeacherId || undefined,
    classTeacherName: newTeacherId ? store.findTeacherById(newTeacherId)?.name || '' : '',
  });
  syncTeacherAssignments();
  const now = new Date();
  await AuditEntryModel.create({
    _id: `audit_${now.getTime()}_${cls._id}`,
    type: 'class_teacher_changed',
    entityType: 'class',
    entityId: cls._id,
    actorId: req.user!._id,
    before: oldTeacherId ? { classTeacherId: oldTeacherId } : null,
    after: newTeacherId ? { classTeacherId: newTeacherId } : null,
  });

  const notify = async (teacherId: string, assigned: boolean) => {
    const teacher = store.findTeacherById(teacherId);
    if (!teacher?.userId) return;
    await NotificationModel.create({
      _id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: teacher.userId,
      role: 'teacher',
      type: assigned ? 'class_teacher_assigned' : 'class_teacher_removed',
      title: assigned ? 'Class teacher assignment' : 'Class teacher assignment removed',
      message: assigned
        ? `You have been assigned as class teacher for ${cls.name} - Section ${cls.section}.`
        : `Your class teacher assignment for ${cls.name} - Section ${cls.section} has been removed.`,
      link: '/attendance',
      isRead: false,
      read: false,
    });
  };
  if (oldTeacherId && oldTeacherId !== newTeacherId) await notify(oldTeacherId, false);
  if (newTeacherId && oldTeacherId !== newTeacherId) await notify(newTeacherId, true);

  res.status(200).json({ success: true, message: 'Class teacher assignment updated.', data: updated });
}

export function deleteClass(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const cls = store.findClassById(id);

  if (!cls) {
    res.status(404).json({ success: false, message: 'Class not found' });
    return;
  }
  const blockers: string[] = [];
  const enrolledStudents = store.getStudents({ classId: id });
  if (enrolledStudents.length > 0) {
    blockers.push(`${enrolledStudents.length} student${enrolledStudents.length === 1 ? '' : 's'} enrolled.`);
  }
  if (req.query.confirm !== 'true') {
    const timetableEntries = store.getTimetable(id);
    if (timetableEntries.length > 0) {
      res.status(409).json({
        success: false,
        confirmationRequired: true,
        message: `${timetableEntries.length} timetable slot(s) will also be deleted.`,
        blockers: [],
      });
      return;
    }
  }
  const assignedSubjects = store.getSubjects(id)
    .filter((subject) => subject.teacherId && store.findTeacherById(subject.teacherId));
  if (assignedSubjects.length > 0) {
    const assignments = assignedSubjects.map((subject) => {
      const teacher = store.findTeacherById(subject.teacherId || '');
      return `${subject.name} (${teacher?.name || 'teacher assigned'})`;
    });
    blockers.push(`Subject teacher assignments: ${assignments.join(', ')}.`);
  }
  if (blockers.length > 0) {
    res.status(409).json({
      success: false,
      message: `Cannot delete ${cls.name} - Section ${cls.section} until its current dependencies are removed.`,
      blockers,
    });
    return;
  }

  const linkedSubjectIds = new Set(store.getSubjects(id).map((subject) => subject._id));
  for (const subjectId of linkedSubjectIds) {
    const subject = store.findSubjectById(subjectId);
    if (!subject) continue;
    const remainingClassIds = store.getSubjectClassIds(subject).filter((classId) => classId !== id);
    store.setSubjectClassIds(subjectId, remainingClassIds);
    if (!remainingClassIds.length) store.deleteSubject(subjectId);
  }
  for (const slot of store.getTimetable(id)) {
    store.deleteTimetableSlot(slot._id);
  }
  store.deleteClass(id);
  if (cls.classTeacherId && !store.getClasses().some((item) => item.classTeacherId === cls.classTeacherId)) {
    store.updateTeacher(cls.classTeacherId, { designation: 'Subject Teacher' });
  }
  syncTeacherAssignments();
  res.status(200).json({ success: true, message: 'Class deleted successfully' });
}
