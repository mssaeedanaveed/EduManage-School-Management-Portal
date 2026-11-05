import { Response } from 'express';
import bcrypt from 'bcryptjs';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { UserModel, TeacherModel } from '../models/index.js';
import mongoSync from '../services/mongoSync.js';
import { syncTeacherAssignments } from '../services/teacherAccess.js';

const relationshipStatuses = ['Single', 'Married', 'Divorced', 'Widowed', 'Other'] as const;
const designations = ['Class Teacher', 'Subject Teacher'] as const;

type SubjectAssignmentRow = { classId: string; subjectIds: string[] };

function readSubjectAssignments(body: Record<string, unknown>): SubjectAssignmentRow[] | string {
  if (body.subjectAssignments !== undefined) {
    if (!Array.isArray(body.subjectAssignments)) return 'Subject assignments must be grouped by class or section.';
    const rows: SubjectAssignmentRow[] = [];
    for (const item of body.subjectAssignments) {
      if (!item || typeof item !== 'object') return 'Each subject assignment must include a class and subject list.';
      const row = item as Record<string, unknown>;
      if (typeof row.classId !== 'string' || !Array.isArray(row.subjectIds) ||
          row.subjectIds.some((id) => typeof id !== 'string')) {
        return 'Each subject assignment must include a valid class and subject list.';
      }
      const subjectIds = [...new Set(row.subjectIds as string[])];
      if (!row.classId && !subjectIds.length) continue;
      if (!row.classId) return 'Select a class or section for each subject assignment.';
      rows.push({ classId: row.classId, subjectIds });
    }
    return rows;
  }
  if (!Array.isArray(body.assignedSubjectIds) ||
      body.assignedSubjectIds.some((id) => typeof id !== 'string')) {
    return 'Subject assignments must be provided as a list.';
  }
  const grouped = new Map<string, string[]>();
  for (const subjectId of body.assignedSubjectIds as string[]) {
    const subject = store.findSubjectById(subjectId);
    if (!subject) return `Subject ${subjectId} does not exist.`;
    grouped.set(subject.classId, [...(grouped.get(subject.classId) || []), subjectId]);
  }
  return [...grouped].map(([classId, subjectIds]) => ({ classId, subjectIds }));
}

function assignmentError(rows: SubjectAssignmentRow[], teacherId?: string): string | undefined {
  for (const row of rows) {
    const cls = store.findClassById(row.classId);
    if (!cls) return `Class or section ${row.classId} does not exist.`;
    for (const subjectId of row.subjectIds) {
      const subject = store.getSubjects(row.classId).find((item) => item._id === subjectId);
      if (!subject) return `Subject ${subjectId} is not assigned to ${cls.name} - Section ${cls.section}.`;
      if (subject.teacherId && subject.teacherId !== teacherId) {
        return `${subject.name} for ${cls.name} - Section ${cls.section} is already assigned to another teacher.`;
      }
    }
  }
  return undefined;
}

function setTeacherSubjects(teacherId: string, rows: SubjectAssignmentRow[]): void {
  const selected = new Set(rows.flatMap((row) => row.subjectIds.map((subjectId) => `${subjectId}:${row.classId}`)));
  for (const subject of store.getSubjects()) {
    const classIds = store.getSubjectClassIds(subject);
    const assignments = classIds.map((classId) => {
      const assignedTeacherId = store.getSubjectTeacherId(subject, classId);
      const isSelected = selected.has(`${subject._id}:${classId}`);
      if (assignedTeacherId === teacherId && !isSelected) {
        store.syncTimetableTeacher(subject._id, classId, '');
      }
      return { classId, teacherId: isSelected ? teacherId : assignedTeacherId === teacherId ? '' : assignedTeacherId };
    });
    if (assignments.length) store.updateSubject(subject._id, { sectionAssignments: assignments });
  }
  syncTeacherAssignments();
}

function teacherAssignmentRows(teacherId: string): SubjectAssignmentRow[] {
  const grouped = new Map<string, string[]>();
  for (const subject of store.getSubjectAssignments().filter((item) => item.teacherId === teacherId)) {
    grouped.set(subject.classId, [...(grouped.get(subject.classId) || []), subject._id]);
  }
  return [...grouped].map(([classId, subjectIds]) => ({ classId, subjectIds: [...new Set(subjectIds)] }));
}

function updateClassTeacherAssignment(teacherId: string, designation: string, targetClassId?: string): void {
  for (const cls of store.getClasses()) {
    const shouldAssign = designation === 'Class Teacher' && cls._id === targetClassId;
    if ((cls.classTeacherId === teacherId && !shouldAssign) || shouldAssign) {
      store.updateClass(cls._id, { classTeacherId: shouldAssign ? teacherId : '' });
    }
  }
}

function validateProfile(body: Record<string, unknown>): string | undefined {
  const requiredFields = [
    ['name', 'Full name'],
    ['phone', 'Phone'],
    ['address', 'Address'],
    ['qualification', 'Qualification'],
    ['qualificationInstitution', 'University or institute'],
  ] as const;
  for (const [field, label] of requiredFields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) return `${label} is required.`;
  }
  const years = Number(body.experienceYears);
  if (body.experienceYears === undefined || body.experienceYears === '' || !Number.isFinite(years) || years < 0) {
    return 'Teaching experience must be a non-negative number of years.';
  }
  if (!designations.includes(body.designation as (typeof designations)[number])) {
    return 'Designation must be Class Teacher or Subject Teacher.';
  }
  if (body.relationshipStatus !== undefined &&
      !relationshipStatuses.includes(body.relationshipStatus as (typeof relationshipStatuses)[number])) {
    return 'Select a valid relationship status.';
  }
  return undefined;
}

export function getAllTeachers(req: AuthenticatedRequest, res: Response): void {
  const teachers = store.getTeachers();
  res.status(200).json({
    success: true,
    total: teachers.length,
    data: teachers,
  });
}

export function getAvailableSubjects(req: AuthenticatedRequest, res: Response): void {
  const { classId } = req.params;
  const teacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined;
  if (!store.findClassById(classId)) {
    res.status(404).json({ success: false, message: 'Class or section not found.' });
    return;
  }
  if (teacherId && !store.findTeacherById(teacherId)) {
    res.status(400).json({ success: false, message: 'The selected teacher profile was not found.' });
    return;
  }
  const subjects = store.getSubjects(classId).filter(
    (subject) => !subject.teacherId || !store.findTeacherById(subject.teacherId) || subject.teacherId === teacherId
  );
  res.status(200).json({ success: true, total: subjects.length, data: subjects });
}

export function getTeacherById(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const teacher = store.findTeacherById(id);

  if (!teacher) {
    res.status(404).json({ success: false, message: 'Teacher not found' });
    return;
  }

  // Get subjects taught by this teacher
  const subjects = store.getSubjectAssignments().filter((s) => s.teacherId === teacher._id);
  // Get timetable for this teacher
  const timetable = store.getTimetable(undefined, teacher._id);

  res.status(200).json({
    success: true,
    data: {
      ...teacher,
      subjects,
      timetable,
    },
  });
}

export async function createTeacher(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    name,
    email,
    password,
    qualification,
    qualificationInstitution,
    address,
    alternatePhone,
    relationshipStatus = 'Other',
    experienceYears,
    designation,
    phone,
    classTeacherClassId,
  } = req.body;

  const profileError = validateProfile(req.body);
  if (profileError) {
    res.status(400).json({ success: false, message: profileError });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    return;
  }
  const assignmentRows = readSubjectAssignments(req.body);
  if (typeof assignmentRows === 'string') {
    res.status(400).json({ success: false, message: assignmentRows });
    return;
  }
  const selectedSubjects = [...new Set(assignmentRows.flatMap((row) => row.subjectIds))];
  const subjectError = assignmentError(assignmentRows);
  if (subjectError) {
    res.status(409).json({ success: false, message: subjectError });
    return;
  }
  if (designation === 'Class Teacher' && !classTeacherClassId) {
    res.status(400).json({ success: false, message: 'Select a class or section for the class teacher.' });
    return;
  }
  if (designation === 'Class Teacher') {
    const targetClass = store.findClassById(String(classTeacherClassId));
    if (!targetClass) {
      res.status(400).json({ success: false, message: 'Select an existing class or section.' });
      return;
    }
    if (targetClass.classTeacherId) {
      res.status(409).json({
        success: false,
        message: `${targetClass.name} - Section ${targetClass.section} already has a class teacher. Remove that assignment first.`,
      });
      return;
    }
  }

  if (!mongoSync.isConnected()) {
    res.status(503).json({
      success: false,
      message: 'MongoDB is not connected. Connect Atlas before creating teacher accounts.',
    });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (await UserModel.exists({ email: normalizedEmail }) ||
      store.getUsers().some((user) => user.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    return;
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const teacherId = `tch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const employeeId = `TCH-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    _id: userId,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'teacher' as const,
    phone: phone || '',
    createdAt: new Date().toISOString(),
  };
  const newTeacher = {
    _id: teacherId,
    userId,
    name: String(name).trim(),
    email: normalizedEmail,
    employeeId,
    qualification: String(qualification).trim(),
    qualificationInstitution: String(qualificationInstitution).trim(),
    address: String(address).trim(),
    alternatePhone: typeof alternatePhone === 'string' ? alternatePhone.trim() : '',
    relationshipStatus,
    experienceYears: Number(experienceYears),
    designation,
    phone: String(phone).trim(),
    gender: 'Other',
    joinedDate: new Date().toISOString().split('T')[0],
    assignedClassIds: [...new Set(assignmentRows.map((row) => row.classId))],
    assignedSubjectIds: selectedSubjects,
  };

  try {
    await UserModel.create(newUser);
    try {
      await TeacherModel.create(newTeacher);
    } catch (error) {
      await UserModel.deleteOne({ _id: userId });
      throw error;
    }
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'A user with this email or a teacher with this employee ID already exists.',
      });
      return;
    }
    console.error('[Teachers] Failed to save teacher account to MongoDB:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save teacher account to MongoDB. No teacher account was created.',
    });
    return;
  }

  store.users.push(newUser);
  store.teachers.push(newTeacher);
  setTeacherSubjects(teacherId, assignmentRows);
  updateClassTeacherAssignment(teacherId, designation, classTeacherClassId ? String(classTeacherClassId) : undefined);

  res.status(201).json({
    success: true,
    message: 'Teacher added successfully',
    data: newTeacher,
  });
}

export async function updateTeacher(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const teacher = store.findTeacherById(id);

  if (!teacher) {
    res.status(404).json({ success: false, message: 'Teacher not found' });
    return;
  }

  const profileError = validateProfile(req.body);
  if (profileError) {
    res.status(400).json({ success: false, message: profileError });
    return;
  }
  if (typeof req.body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }
  const assignmentRows = readSubjectAssignments(req.body);
  if (typeof assignmentRows === 'string') {
    res.status(400).json({ success: false, message: assignmentRows });
    return;
  }
  const selectedSubjects = [...new Set(assignmentRows.flatMap((row) => row.subjectIds))];
  const subjectError = assignmentError(assignmentRows, id);
  if (subjectError) {
    res.status(409).json({ success: false, message: subjectError });
    return;
  }

  const designation = req.body.designation as string;
  const classTeacherClassId = req.body.classTeacherClassId ? String(req.body.classTeacherClassId) : undefined;
  if (designation === 'Class Teacher' && !classTeacherClassId) {
    res.status(400).json({ success: false, message: 'Select a class or section for the class teacher.' });
    return;
  }
  if (designation === 'Class Teacher') {
    const targetClass = store.findClassById(classTeacherClassId!);
    if (!targetClass) {
      res.status(400).json({ success: false, message: 'Select an existing class or section.' });
      return;
    }
    if (targetClass.classTeacherId && targetClass.classTeacherId !== id) {
      res.status(409).json({
        success: false,
        message: `${targetClass.name} - Section ${targetClass.section} already has a class teacher. Remove that assignment first.`,
      });
      return;
    }
  }

  const user = store.findUserById(teacher.userId);
  if (!user) {
    res.status(409).json({ success: false, message: 'The linked teacher login account was not found; this profile cannot be updated.' });
    return;
  }
  const normalizedEmail = String(req.body.email).trim().toLowerCase();
  if (await UserModel.exists({ email: normalizedEmail, _id: { $ne: teacher.userId } }) ||
      store.getUsers().some((candidate) => candidate._id !== teacher.userId && candidate.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    return;
  }
  let passwordHash: string | undefined;
  if (req.body.password) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }
    passwordHash = await bcrypt.hash(req.body.password, 10);
  }

  try {
    if (user) {
      const userUpdate: Partial<typeof user> = {
        name: String(req.body.name).trim(),
        email: normalizedEmail,
        phone: String(req.body.phone).trim(),
      };
      if (passwordHash) userUpdate.passwordHash = passwordHash;
      store.updateUser(user._id, userUpdate);
    }
  } catch (error) {
    console.error('[Teachers] Failed to update linked MongoDB user:', error);
    res.status(500).json({ success: false, message: 'Failed to update teacher account in MongoDB.' });
    return;
  }

  const updated = store.updateTeacher(id, {
    name: String(req.body.name).trim(),
    email: normalizedEmail,
    phone: String(req.body.phone).trim(),
    address: String(req.body.address).trim(),
    alternatePhone: typeof req.body.alternatePhone === 'string' ? req.body.alternatePhone.trim() : '',
    relationshipStatus: req.body.relationshipStatus,
    qualification: String(req.body.qualification).trim(),
    qualificationInstitution: String(req.body.qualificationInstitution).trim(),
    experienceYears: Number(req.body.experienceYears),
    designation,
    assignedSubjectIds: selectedSubjects,
    assignedClassIds: [...new Set(assignmentRows.map((row) => row.classId))],
  });
  setTeacherSubjects(id, assignmentRows);
  updateClassTeacherAssignment(id, designation, classTeacherClassId);

  res.status(200).json({
    success: true,
    message: 'Teacher updated successfully',
    data: updated,
  });
}

export function deleteTeacher(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const teacher = store.findTeacherById(id);

  if (!teacher) {
    res.status(404).json({ success: false, message: 'Teacher not found' });
    return;
  }

  setTeacherSubjects(id, []);
  updateClassTeacherAssignment(id, 'Subject Teacher');
  for (const slot of store.getTimetable(undefined, id)) {
    store.syncTimetableTeacher(slot.subjectId, slot.classId, '');
  }
  store.deleteUser(teacher.userId);
  store.deleteTeacher(id);
  syncTeacherAssignments();
  res.status(200).json({ success: true, message: 'Teacher deleted successfully' });
}
