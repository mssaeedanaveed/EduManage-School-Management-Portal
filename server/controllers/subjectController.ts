import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessClass, getTeacherForUser, isClassTeacher, syncTeacherAssignments } from '../services/teacherAccess.js';

type SubjectValues = {
  name: string;
  code: string;
  classId: string;
  classIds: string[];
  className: string;
  academicYear: string;
  classGroupKey: string;
  teacherId: string;
  sectionAssignments: { classId: string; teacherId: string }[];
  credits: number;
};

function classGroup(classId: string) {
  const selectedClass = store.findClassById(classId);
  if (!selectedClass) return undefined;
  const classIds = store.getClasses()
    .filter((cls) =>
      cls.name.trim().toLowerCase() === selectedClass.name.trim().toLowerCase() &&
      cls.academicYear.trim().toLowerCase() === selectedClass.academicYear.trim().toLowerCase()
    )
    .map((cls) => cls._id);
  return {
    classId: selectedClass._id,
    classIds,
    className: selectedClass.name,
    academicYear: selectedClass.academicYear,
    classGroupKey: store.classGroupKey(selectedClass.name, selectedClass.academicYear),
  };
}

function validateSubject(
  body: Record<string, unknown>,
  current?: ReturnType<typeof store.findSubjectById>
): { message?: string; values?: SubjectValues } {
  const nameValue = Object.prototype.hasOwnProperty.call(body, 'name') ? body.name : current?.name;
  const codeValue = body.courseCode ?? body.code ?? current?.code;
  const classValue = Object.prototype.hasOwnProperty.call(body, 'classId') ? body.classId : current?.classId;
  const creditsValue = Object.prototype.hasOwnProperty.call(body, 'credits') ? body.credits : current?.credits;
  const teacherValue = Object.prototype.hasOwnProperty.call(body, 'teacherId') ? body.teacherId : undefined;
  const assignmentsValue = body.sectionAssignments;

  if (typeof nameValue !== 'string' || !nameValue.trim()) return { message: 'Subject name is required.' };
  if (typeof codeValue !== 'string' || !codeValue.trim()) return { message: 'Course code is required.' };
  if (typeof classValue !== 'string' || !classValue.trim()) return { message: 'Select an existing class.' };
  const group = classGroup(classValue);
  if (!group) return { message: 'Select an existing class.' };
  const credits = Number(creditsValue);
  if (creditsValue === undefined || creditsValue === null || creditsValue === '' ||
      !Number.isFinite(credits) || credits <= 0) {
    return { message: 'Academic credits must be a positive number.' };
  }

  let sectionAssignments: { classId: string; teacherId: string }[] = [];
  if (assignmentsValue !== undefined) {
    if (!Array.isArray(assignmentsValue) || assignmentsValue.some((item) =>
      !item || typeof item !== 'object' ||
      typeof (item as Record<string, unknown>).classId !== 'string' ||
      typeof (item as Record<string, unknown>).teacherId !== 'string'
    )) {
      return { message: 'Section teacher assignments must be a list of valid class and teacher selections.' };
    }
    const seenClassIds = new Set<string>();
    for (const raw of assignmentsValue as Record<string, string>[]) {
      const { classId, teacherId } = raw;
      if (!group.classIds.includes(classId) || seenClassIds.has(classId)) {
        return { message: 'Teacher assignments must reference each section of the selected class only once.' };
      }
      if (teacherId && !store.findTeacherById(teacherId)) {
        return { message: 'Select a teacher who currently exists in the Faculty Directory.' };
      }
      seenClassIds.add(classId);
      sectionAssignments.push({ classId, teacherId });
    }
  } else if (teacherValue !== undefined) {
    if (teacherValue !== '' && (typeof teacherValue !== 'string' || !store.findTeacherById(teacherValue))) {
      return { message: 'Select a teacher who currently exists in the Faculty Directory.' };
    }
    sectionAssignments = group.classIds.map((id) => ({
      classId: id,
      teacherId: id === group.classId && typeof teacherValue === 'string' ? teacherValue : '',
    }));
  } else if (current) {
    sectionAssignments = group.classIds.map((id) => ({
      classId: id,
      teacherId: store.getSubjectTeacherId(current, id),
    }));
  } else {
    sectionAssignments = group.classIds.map((id) => ({ classId: id, teacherId: '' }));
  }

  return {
    values: {
      name: nameValue.trim(),
      code: codeValue.trim().toUpperCase(),
      ...group,
      teacherId: '',
      sectionAssignments,
      credits,
    },
  };
}

function duplicateError(values: SubjectValues, excludeId?: string): string | undefined {
  const subjects = store.getSubjects();
  const duplicateCode = subjects.find((subject) =>
    subject._id !== excludeId && subject.code.trim().toLowerCase() === values.code.trim().toLowerCase()
  );
  if (duplicateCode) {
    const cls = store.findClassById(duplicateCode.classId);
    return `Course code ${values.code} already exists for ${duplicateCode.name} (${cls?.name || duplicateCode.className || 'Unknown class'}).`;
  }
  const duplicateName = subjects.find((subject) =>
    subject._id !== excludeId &&
    (subject.classGroupKey
      ? subject.classGroupKey === values.classGroupKey
      : values.classIds.includes(subject.classId)) &&
    subject.name.trim().toLowerCase() === values.name.trim().toLowerCase()
  );
  if (duplicateName) return `${duplicateName.name} already exists in ${values.className}.`;
  return undefined;
}

function getSubjectImpact(subjectId: string) {
  const subject = store.findSubjectById(subjectId);
  const classIds = subject ? store.getSubjectClassIds(subject) : [];
  const studentIds = new Set(classIds.flatMap((classId) =>
    store.getStudents({ classId }).map((student) => student._id)
  ));
  const attendanceCount = store.attendance.filter((record) => record.subjectId === subjectId).length;
  const results = store.results.filter((result) =>
    result.marks.some((mark) => mark.subjectId === subjectId)
  );
  const timetableCount = store.getTimetable().filter((slot) => slot.subjectId === subjectId).length;
  const assignments = subject
    ? store.getSubjectClassIds(subject).map((classId) => ({
      classId,
      teacherId: store.getSubjectTeacherId(subject, classId),
    }))
    : [];
  return {
    studentCount: studentIds.size,
    attendanceCount,
    resultCount: results.length,
    timetableCount,
    teacherAssignments: assignments.map((assignment) => {
      const cls = store.findClassById(assignment.classId);
      const teacher = assignment.teacherId ? store.findTeacherById(assignment.teacherId) : undefined;
      return {
        ...assignment,
        section: cls?.section || '',
        teacherName: teacher?.name || '',
      };
    }),
  };
}

function enrichSubject(subject: ReturnType<typeof store.findSubjectById>) {
  if (!subject) return undefined;
  const classIds = store.getSubjectClassIds(subject);
  const classes = classIds.map((classId) => store.findClassById(classId)).filter(Boolean);
  return {
    ...subject,
    classIds,
    className: classes[0]?.name || subject.className || '',
    academicYear: classes[0]?.academicYear || subject.academicYear || '',
    sectionAssignments: classIds.map((classId) => {
      const cls = store.findClassById(classId);
      const teacherId = store.getSubjectTeacherId(subject, classId);
      const teacher = teacherId ? store.findTeacherById(teacherId) : undefined;
      return {
        classId,
        teacherId,
        section: cls?.section || '',
        teacherName: teacher?.name || '',
      };
    }),
    ...getSubjectImpact(subject._id),
  };
}

export function getAllSubjects(req: AuthenticatedRequest, res: Response): void {
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const teacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

  if (req.user?.role === 'teacher' && classId && !canAccessClass(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Access denied: This class is not assigned to you.' });
    return;
  }

  const source = classId
    ? store.getSubjects(classId)
    : req.user?.role === 'teacher'
      ? store.getSubjectAssignments().filter((subject) =>
        subject.teacherId === getTeacherForUser(req.user)?._id ||
        isClassTeacher(req.user, subject.classId)
      )
      : store.getSubjects();
  const teacher = getTeacherForUser(req.user);
  const filtered = source.filter((subject) =>
    (req.user?.role !== 'teacher' || subject.teacherId === teacher?._id || isClassTeacher(req.user, subject.classId)) &&
    (!teacherId || (classId
      ? teacherId === 'unassigned' ? !subject.teacherId : subject.teacherId === teacherId
      : store.getSubjectClassIds(subject).some((sectionId) => {
        const assignedTeacherId = store.getSubjectTeacherId(subject, sectionId);
        return teacherId === 'unassigned' ? !assignedTeacherId : assignedTeacherId === teacherId;
      })
    )) &&
    (!search || subject.name.toLowerCase().includes(search) || subject.code.toLowerCase().includes(search))
  );
  const subjects = filtered.map((subject) => enrichSubject(subject)!).filter(Boolean);

  res.status(200).json({ success: true, total: subjects.length, data: subjects });
}

export function checkCourseCodeAvailability(req: AuthenticatedRequest, res: Response): void {
  const courseCode = typeof req.query.courseCode === 'string' ? req.query.courseCode.trim() : '';
  const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;
  if (!courseCode) {
    res.status(400).json({ success: false, available: false, message: 'Course code is required.' });
    return;
  }
  const duplicate = store.getSubjects().find((subject) =>
    subject._id !== excludeId && subject.code.trim().toLowerCase() === courseCode.toLowerCase()
  );
  if (duplicate) {
    const cls = store.findClassById(duplicate.classId);
    res.status(409).json({
      success: true,
      available: false,
      message: `Course code ${courseCode.toUpperCase()} already exists for ${duplicate.name} (${cls?.name || 'Unknown class'}).`,
    });
    return;
  }
  res.status(200).json({ success: true, available: true, message: 'Course code is available.' });
}

export function getSubjectById(req: AuthenticatedRequest, res: Response): void {
  const subject = store.findSubjectById(req.params.id);
  if (!subject) {
    res.status(404).json({ success: false, message: 'Subject not found' });
    return;
  }
  if (req.user?.role === 'teacher' &&
      !store.getSubjectClassIds(subject).some((classId) =>
        store.getSubjectTeacherId(subject, classId) === getTeacherForUser(req.user)?._id ||
        store.findClassById(classId)?.classTeacherId === getTeacherForUser(req.user)?._id
      )) {
    res.status(403).json({ success: false, message: 'Access denied: This subject is not assigned to you.' });
    return;
  }
  res.status(200).json({ success: true, data: enrichSubject(subject) });
}

function attachSubjectToClassIds(subjectId: string, classIds: string[]): void {
  for (const cls of store.getClasses()) {
    const shouldLink = classIds.includes(cls._id);
    const subjects = cls.subjects || [];
    if (shouldLink && !subjects.includes(subjectId)) {
      store.updateClass(cls._id, { subjects: [...subjects, subjectId] });
    } else if (!shouldLink && subjects.includes(subjectId)) {
      store.updateClass(cls._id, { subjects: subjects.filter((id) => id !== subjectId) });
    }
  }
}

export function createSubject(req: AuthenticatedRequest, res: Response): void {
  const validation = validateSubject(req.body);
  if (validation.message || !validation.values) {
    res.status(400).json({ success: false, message: validation.message });
    return;
  }
  const duplicate = duplicateError(validation.values);
  if (duplicate) {
    res.status(409).json({ success: false, message: duplicate });
    return;
  }
  const values = validation.values;
  const created = store.createSubject({
    name: values.name,
    code: values.code,
    classId: values.classId,
    classIds: values.classIds,
    className: values.className,
    academicYear: values.academicYear,
    classGroupKey: values.classGroupKey,
    sectionAssignments: values.sectionAssignments,
    credits: values.credits,
  });
  attachSubjectToClassIds(created._id, values.classIds);
  syncTeacherAssignments();

  res.status(201).json({
    success: true,
    message: 'Subject created successfully for all sections.',
    data: enrichSubject(created),
  });
}

export function updateSubject(req: AuthenticatedRequest, res: Response): void {
  const id = req.params.id;
  const current = store.findSubjectById(id);
  if (!current) {
    res.status(404).json({ success: false, message: 'Subject not found' });
    return;
  }
  const validation = validateSubject(req.body, current);
  if (validation.message || !validation.values) {
    res.status(400).json({ success: false, message: validation.message });
    return;
  }
  const values = validation.values;
  const duplicate = duplicateError(values, id);
  if (duplicate) {
    res.status(409).json({ success: false, message: duplicate });
    return;
  }

  const oldClassIds = store.getSubjectClassIds(current);
  const oldClass = store.findClassById(current.classId);
  const currentGroupKey = current.classGroupKey ||
    (oldClass ? store.classGroupKey(oldClass.name, oldClass.academicYear) : '');
  const classChanged = currentGroupKey !== values.classGroupKey;
  if (classChanged) {
    const impact = getSubjectImpact(id);
    if (impact.attendanceCount || impact.resultCount || impact.timetableCount) {
      const blockers = [
        impact.attendanceCount ? `${impact.attendanceCount} attendance record(s)` : '',
        impact.resultCount ? `${impact.resultCount} result record(s)` : '',
        impact.timetableCount ? `${impact.timetableCount} timetable entr(y/ies)` : '',
      ].filter(Boolean);
      res.status(409).json({
        success: false,
        message: `Cannot change the subject's class while ${blockers.join(', ')} exist.`,
        blockers,
      });
      return;
    }
  }

  const nextAssignmentByClass = new Map(values.sectionAssignments.map((item) => [item.classId, item.teacherId]));
  for (const classId of oldClassIds) {
    const previousTeacherId = store.getSubjectTeacherId(current, classId);
    const nextTeacherId = nextAssignmentByClass.get(classId) || '';
    if (previousTeacherId !== nextTeacherId) {
      store.syncTimetableTeacher(id, classId, nextTeacherId);
    }
  }
  attachSubjectToClassIds(id, values.classIds);
  const updated = store.updateSubject(id, {
    name: values.name,
    code: values.code,
    classId: values.classId,
    classIds: values.classIds,
    className: values.className,
    academicYear: values.academicYear,
    classGroupKey: values.classGroupKey,
    sectionAssignments: values.sectionAssignments,
    teacherId: '',
    teacherName: '',
    credits: values.credits,
  });
  if (!updated) {
    res.status(404).json({ success: false, message: 'Subject not found' });
    return;
  }
  syncTeacherAssignments();
  res.status(200).json({
    success: true,
    message: 'Subject updated successfully.',
    data: enrichSubject(updated),
  });
}

export function deleteSubject(req: AuthenticatedRequest, res: Response): void {
  const subject = store.findSubjectById(req.params.id);
  if (!subject) {
    res.status(404).json({ success: false, message: 'Subject not found' });
    return;
  }
  const impact = getSubjectImpact(subject._id);
  const blockers = [
    impact.attendanceCount ? `${impact.attendanceCount} attendance record(s) exist for this subject.` : '',
    impact.resultCount ? `${impact.resultCount} result record(s) contain marks for this subject.` : '',
  ].filter(Boolean);
  if (blockers.length) {
    res.status(409).json({
      success: false,
      message: `Cannot delete ${subject.name} until its attendance and result records are removed.`,
      blockers,
      data: impact,
    });
    return;
  }
  for (const slot of store.getTimetable().filter((item) => item.subjectId === subject._id)) {
    store.deleteTimetableSlot(slot._id);
  }
  store.deleteSubject(subject._id);
  syncTeacherAssignments();
  res.status(200).json({
    success: true,
    message: 'Subject deleted successfully.',
    data: impact,
  });
}
