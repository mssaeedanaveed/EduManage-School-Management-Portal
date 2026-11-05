import { Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { StudentModel } from '../models/Student.js';
import { OldStudentModel } from '../models/OldStudent.js';
import { StudentSequenceModel } from '../models/StudentSequence.js';
import { AttendanceModel } from '../models/Attendance.js';
import { ResultModel } from '../models/Result.js';
import { FeePaymentModel } from '../models/FeePayment.js';
import { NotificationModel } from '../models/Notification.js';
import { canAccessClass, isClassTeacher, teachesSubject } from '../services/teacherAccess.js';

export function getAllStudents(req: AuthenticatedRequest, res: Response): void {
  const { classId, search, page = '1', limit = '50' } = req.query as {
    classId?: string;
    search?: string;
    page?: string;
    limit?: string;
  };

  let students = store.getStudents({ classId, search });

  // If user is parent, only show linked children
  if (req.user?.role === 'parent') {
    students = students.filter((s) => s.parentId === req.user?._id);
  }
  // If user is student, only show self
  if (req.user?.role === 'student') {
    students = students.filter((s) => s.userId === req.user?._id);
  }
  if (req.user?.role === 'teacher') {
    students = students.filter((s) => canAccessClass(req.user, s.classId));
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;
  const startIndex = (pageNum - 1) * limitNum;
  const total = students.length;
  const paginated = students.slice(startIndex, startIndex + limitNum);

  res.status(200).json({
    success: true,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    data: paginated.map((student) => {
      const cls = store.findClassById(student.classId);
      return cls ? { ...student, className: `${cls.name} - ${cls.section}`, section: cls.section } : student;
    }),
  });
}

export async function getStudentDirectoryClasses(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const counts = await StudentModel.aggregate([
      { $match: { archivedAt: { $in: ['', null] } } },
      { $group: { _id: '$classId', studentCount: { $sum: 1 } } },
    ]);
    const classCounts = new Map<string, number>(counts.map((item) => [item._id, item.studentCount]));
    const classes = store.getClasses().map((cls) => ({
      ...cls,
      studentCount: classCounts.get(cls._id) || 0,
      subjectCount: store.getSubjects(cls._id).length,
    }));
    res.status(200).json({ success: true, total: classes.length, data: classes });
  } catch (error) {
    console.error('[Students] Failed to load class student counts from MongoDB:', error);
    res.status(503).json({ success: false, message: 'Could not load class student counts from MongoDB.' });
  }
}

export function getStudentsByClass(req: AuthenticatedRequest, res: Response): void {
  const classId = req.params.className || req.params.classId;
  const { search = '', page = '1', limit = '50', section = '' } = req.query as {
    search?: string;
    page?: string;
    limit?: string;
    section?: string;
  };
  const matchingClasses = store.getClasses().filter((cls) => cls.name === classId);
  const selectedClass = store.findClassById(classId);
  const classIds = matchingClasses.length
    ? matchingClasses.filter((cls) => !section || cls.section === section).map((cls) => cls._id)
    : selectedClass ? [selectedClass._id] : [];
  if (!classIds.length) {
    res.status(404).json({ success: false, message: 'Class or section not found.' });
    return;
  }
  const students = classIds.flatMap((id) => store.getStudents({ classId: id, search }));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const startIndex = (pageNum - 1) * limitNum;
  res.status(200).json({
    success: true,
    total: students.length,
    page: pageNum,
    totalPages: Math.ceil(students.length / limitNum) || 1,
    data: students.slice(startIndex, startIndex + limitNum),
  });
}

export async function getStudentCount(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const total = await StudentModel.countDocuments({
      archivedAt: { $in: ['', null] },
    });
    res.status(200).json({ success: true, total, data: { totalStudents: total } });
  } catch (error) {
    console.error('[Students] Failed to count active students in MongoDB:', error);
    res.status(503).json({ success: false, message: 'Could not load the live student count from MongoDB.' });
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getOldStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const rawSearch = req.query.search;
  if (rawSearch !== undefined && typeof rawSearch !== 'string') {
    res.status(400).json({ success: false, message: 'search must be a single text value.' });
    return;
  }
  const search = rawSearch || '';
  const yearLeft = typeof req.query.yearLeft === 'string' ? req.query.yearLeft : '';
  if (req.query.yearLeft !== undefined && typeof req.query.yearLeft !== 'string') {
    res.status(400).json({ success: false, message: 'yearLeft must be a single four-digit year.' });
    return;
  }
  const query: Record<string, unknown> = {};
  if (search.trim()) {
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [{ fullName: pattern }, { admissionNo: pattern }];
  }
  if (yearLeft) {
    if (!/^\d{4}$/.test(yearLeft)) {
      res.status(400).json({ success: false, message: 'yearLeft must be a four-digit year.' });
      return;
    }
    query.dateLeft = { $gte: `${yearLeft}-01-01`, $lt: `${Number(yearLeft) + 1}-01-01` };
  }
  const rawPage = typeof req.query.page === 'string' ? req.query.page : '1';
  const rawLimit = typeof req.query.limit === 'string' ? req.query.limit : '50';
  const pageNum = Math.max(1, parseInt(rawPage, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 50));
  const startIndex = (pageNum - 1) * limitNum;
  try {
    const [students, total, dateValues] = await Promise.all([
      OldStudentModel.find(query, {
        _id: 1,
        fullName: 1,
        parentGuardianName: 1,
        contactNumber: 1,
        alternateNumber: 1,
        gender: 1,
        dob: 1,
        address: 1,
        admissionNo: 1,
        className: 1,
        dateLeft: 1,
      }).sort({ dateLeft: -1, fullName: 1 }).skip(startIndex).limit(limitNum).lean(),
      OldStudentModel.countDocuments(query),
      OldStudentModel.distinct('dateLeft'),
    ]);
    const years = [...new Set(dateValues.map((date) => String(date).slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))]
      .sort((a, b) => Number(b) - Number(a));
    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      years,
      data: students,
    });
  } catch (error) {
    console.error('[Students] Failed to load Old Students records:', error);
    res.status(503).json({ success: false, message: 'Could not load Old Students records from MongoDB.' });
  }
}

export function getStudentById(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const student = store.findStudentById(id);

  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }
  if (student.archivedAt && req.user?.role !== 'admin') {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  // Access checks
  if (req.user?.role === 'student' && student.userId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied: You can only view your own profile.' });
    return;
  }
  if (req.user?.role === 'parent' && student.parentId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied: You can only view your linked children.' });
    return;
  }
  if (req.user?.role === 'teacher' && !canAccessClass(req.user, student.classId)) {
    res.status(403).json({ success: false, message: 'Access denied: This student is not in one of your assigned classes.' });
    return;
  }

  const attendanceSummary = store.getStudentAttendanceSummary(student._id);
  let results = store.getResults(undefined, undefined, student._id);
  if (req.user?.role === 'student' || req.user?.role === 'parent') {
    results = results.filter((result) => result.published);
  } else if (req.user?.role === 'teacher' && !isClassTeacher(req.user, student.classId)) {
    results = results
      .filter((result) => result.marks.some((mark) => teachesSubject(req.user, student.classId, mark.subjectId)))
      .map((result) => {
        const marks = result.marks.filter((mark) => teachesSubject(req.user, student.classId, mark.subjectId));
        const totalMarksObtained = marks.reduce((total, mark) => total + mark.marksObtained, 0);
        const totalMaxMarks = marks.reduce((total, mark) => total + mark.maxMarks, 0);
        return {
          ...result,
          marks,
          totalMarksObtained,
          totalMaxMarks,
          percentage: totalMaxMarks ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)) : 0,
          position: undefined,
          totalStudentsInClass: undefined,
          teacherRemarks: undefined,
        };
      });
  }
  const feePayments = req.user?.role === 'teacher' ? [] : store.getFeePayments({ studentId: student._id });

  res.status(200).json({
    success: true,
    data: {
      ...student,
      ...(store.findClassById(student.classId)
        ? {
            className: `${store.findClassById(student.classId)!.name} - ${store.findClassById(student.classId)!.section}`,
            section: store.findClassById(student.classId)!.section,
          }
        : {}),
      attendanceSummary,
      results,
      feePayments,
    },
  });
}

function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim();
  const regex = /^(\+?[0-9\s\-().]{7,20})$/;
  const digits = cleaned.replace(/\D/g, '');
  return regex.test(cleaned) && digits.length >= 7 && digits.length <= 15;
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidDateOfBirth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    date.getTime() <= Date.now();
}

async function nextSequenceValue(key: string, initialValue: number): Promise<number> {
  try {
    await StudentSequenceModel.updateOne(
      { _id: key },
      { $setOnInsert: { value: initialValue } },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  await StudentSequenceModel.updateOne({ _id: key }, { $max: { value: initialValue } });
  const sequence = await StudentSequenceModel.findOneAndUpdate(
    { _id: key },
    { $inc: { value: 1 } },
    { new: true }
  ).lean();
  if (!sequence) throw new Error('Could not allocate an admission number.');
  return sequence.value;
}

async function generateAdmissionNo(): Promise<string> {
  const year = String(new Date().getFullYear());
  const pattern = new RegExp(`^ADM-${year}-(\\d+)$`, 'i');
  const existingNumbers = await StudentModel.find({ admissionNo: pattern }).select('admissionNo').lean();
  const maxFromDatabase = existingNumbers.reduce((max, student) => {
    const match = student.admissionNo.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const maxFromStore = store.students.reduce((max, student) => {
    const match = student.admissionNo.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const sequence = await nextSequenceValue(`admission:${year}`, Math.max(maxFromDatabase, maxFromStore));
  return `ADM-${year}-${String(sequence).padStart(3, '0')}`;
}

async function generateRollNo(classId: string): Promise<string> {
  const cls = store.findClassById(classId);
  if (!cls) throw new Error('Select a valid class and section.');
  const classLabel = cls.name.replace(/^(grade|class)\s*/i, '').trim().replace(/\s+/g, '-');
  const sectionLabel = cls.section.trim().toUpperCase().replace(/\s+/g, '-');
  const prefix = `${classLabel}-${sectionLabel}-`;
  const existingStudents = await StudentModel.find({ classId }).select('rollNo').lean();
  const maxFromDatabase = existingStudents.reduce((max, student) => {
    if (!student.rollNo.startsWith(prefix)) return max;
    const suffix = Number(student.rollNo.slice(prefix.length));
    return Number.isInteger(suffix) ? Math.max(max, suffix) : max;
  }, 0);
  const maxFromStore = store.students.reduce((max, student) => {
    if (student.classId !== classId || !student.rollNo.startsWith(prefix)) return max;
    const suffix = Number(student.rollNo.slice(prefix.length));
    return Number.isInteger(suffix) ? Math.max(max, suffix) : max;
  }, 0);
  const sequence = await nextSequenceValue(`roll:${classId}`, Math.max(maxFromDatabase, maxFromStore));
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}

export async function createStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    name,
    email,
    classId,
    parentEmail,
    parentName,
    dob,
    gender,
    phone,
    address,
    bloodGroup,
    alternateContact,
  } = req.body;
  const password = req.body.password ?? 'password123';

  if (typeof name !== 'string' || !name.trim() ||
      typeof parentName !== 'string' || !parentName.trim() ||
      !isValidEmail(email) ||
      typeof phone !== 'string' || !isValidPhone(phone) ||
      !isValidDateOfBirth(dob) ||
      typeof address !== 'string' || !address.trim() ||
      typeof password !== 'string' || password.length < 8 ||
      !['Male', 'Female', 'Other'].includes(gender) ||
      typeof classId !== 'string' || !classId.trim()) {
    res.status(400).json({ success: false, message: 'Provide valid name, student email, parent/guardian name, contact number, date of birth, address, gender, class/section, and an account password of at least 8 characters.' });
    return;
  }

  const selectedClass = store.findClassById(classId);
  if (!selectedClass) {
    res.status(400).json({ success: false, message: 'Select a valid class before enrolling the student.' });
    return;
  }
  if (store.getStudents({ classId }).length >= selectedClass.capacity) {
    res.status(409).json({
      success: false,
      message: `${selectedClass.name} - Section ${selectedClass.section} has reached its maximum capacity.`,
    });
    return;
  }
  if (parentEmail && !isValidEmail(parentEmail)) {
    res.status(400).json({ success: false, message: 'Provide a valid parent portal email address or leave it blank.' });
    return;
  }

  if (alternateContact && (!isValidPhone(alternateContact) || !alternateContact.trim())) {
    res.status(400).json({ success: false, message: 'Provide a valid alternate contact number or leave it blank.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedParentEmail = typeof parentEmail === 'string' ? parentEmail.trim().toLowerCase() : '';
  if (normalizedParentEmail && normalizedParentEmail === normalizedEmail) {
    res.status(409).json({ success: false, message: 'Student and parent portal accounts must use different email addresses.' });
    return;
  }
  if (store.findUserByEmail(normalizedEmail)) {
    res.status(409).json({ success: false, message: 'A user with this student email already exists.' });
    return;
  }

  let resolvedParent = normalizedParentEmail ? store.findUserByEmail(normalizedParentEmail) : undefined;
  if (resolvedParent && resolvedParent.role !== 'parent') {
    res.status(409).json({ success: false, message: 'The supplied parent portal email belongs to a non-parent account.' });
    return;
  }
  if (!resolvedParent && normalizedParentEmail && store.findUserByEmail(normalizedParentEmail)) {
    res.status(409).json({ success: false, message: 'A user with this parent portal email already exists.' });
    return;
  }

  if (!resolvedParent && !normalizedParentEmail) {
    resolvedParent = store.getUsers().find(
      (user) => user.role === 'parent' &&
        (user.phone === phone.trim() || user.name.toLowerCase() === parentName.trim().toLowerCase())
    );
  }

  const admissionNo = await generateAdmissionNo();
  const rollNo = await generateRollNo(classId);
  let generatedParentEmail = '';
  if (!resolvedParent) {
    generatedParentEmail = normalizedParentEmail ||
      `parent.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@parent.school.edu`;
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = store.createUser({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'student',
    phone: phone.trim(),
  });
  if (!resolvedParent) {
    resolvedParent = store.createUser({
      name: parentName.trim(),
      email: generatedParentEmail,
      passwordHash: bcrypt.hashSync('password123', 10),
      role: 'parent',
      phone: phone.trim(),
    });
  }

  const newStudent = store.createStudent({
    userId: newUser._id,
    name: name.trim(),
    email: normalizedEmail,
    admissionNo,
    rollNo,
    classId,
    parentId: resolvedParent._id,
    parentName: resolvedParent.name,
    parentEmail: resolvedParent.email,
    parentPhone: resolvedParent.phone || phone.trim(),
    dob,
    gender,
    phone: phone.trim(),
    address: address.trim(),
    bloodGroup: bloodGroup || 'O+',
    emergencyContact: phone.trim(),
    alternateContact: alternateContact?.trim() || '',
  });

  res.status(201).json({
    success: true,
    message: 'Student enrolled successfully and parent account linked.',
    data: {
      ...newStudent,
      credentials: {
        student: { email: normalizedEmail, temporaryPassword: password },
        parent: { email: resolvedParent.email, temporaryPassword: generatedParentEmail ? 'password123' : undefined },
      },
    },
  });
}

export async function updateStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const student = store.findStudentById(id);
  if (!student || student.archivedAt) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  const { emergencyContact, alternateContact, parentName } = req.body;
  const nextClassId = typeof req.body.classId === 'string' ? req.body.classId : student.classId;
  const nextPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : student.phone;
  const nextClass = store.findClassById(nextClassId);
  if (!nextClass) {
    res.status(400).json({ success: false, message: 'Select a valid class and section.' });
    return;
  }
  if (nextClassId !== student.classId && store.getStudents({ classId: nextClassId }).length >= nextClass.capacity) {
    res.status(409).json({
      success: false,
      message: `${nextClass.name} - Section ${nextClass.section} has reached its maximum capacity.`,
    });
    return;
  }
  if (typeof req.body.name !== 'string' || !req.body.name.trim() ||
      typeof parentName !== 'string' || !parentName.trim() ||
      !isValidPhone(nextPhone) ||
      !isValidDateOfBirth(req.body.dob ?? student.dob) ||
      typeof req.body.address !== 'string' || !req.body.address.trim() ||
      !['Male', 'Female', 'Other'].includes(req.body.gender ?? student.gender)) {
    res.status(400).json({ success: false, message: 'Provide valid name, parent/guardian name, contact number, date of birth, address, and gender.' });
    return;
  }
  if (emergencyContact !== undefined && emergencyContact !== '' && !isValidPhone(emergencyContact)) {
    res.status(400).json({ success: false, message: 'Please provide a valid contact number.' });
    return;
  }
  if (alternateContact && !isValidPhone(alternateContact)) {
    res.status(400).json({ success: false, message: 'Provide a valid alternate contact number or leave it blank.' });
    return;
  }

  const nextRollNo = nextClassId === student.classId ? student.rollNo : await generateRollNo(nextClassId);
  if (store.getStudents({ classId: nextClassId }).some((record) =>
    record._id !== id && record.rollNo === nextRollNo
  )) {
    res.status(409).json({ success: false, message: 'This roll number is already used in the selected class.' });
    return;
  }

  const userUpdates: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, string> } } }> = [];
  const studentUser = store.findUserById(student.userId);
  if (studentUser) {
    const set: Record<string, string> = {};
    set.name = req.body.name.trim();
    set.phone = nextPhone;
    userUpdates.push({ updateOne: { filter: { _id: studentUser._id }, update: { $set: set } } });
  }
  const parentUser = student.parentId ? store.findUserById(student.parentId) : undefined;
  if (parentUser) {
    const set: Record<string, string> = {};
    set.name = parentName.trim();
    set.phone = (emergencyContact || nextPhone).trim();
    userUpdates.push({ updateOne: { filter: { _id: parentUser._id }, update: { $set: set } } });
  }

  try {
    if (userUpdates.length) await UserModel.bulkWrite(userUpdates);
  } catch (error) {
    console.error('[Students] Failed to update linked MongoDB accounts:', error);
    res.status(500).json({ success: false, message: 'Failed to update linked account details in MongoDB.' });
    return;
  }

  const updated = store.updateStudent(id, {
    ...req.body,
    name: req.body.name.trim(),
    parentName: parentName.trim(),
    classId: nextClassId,
    rollNo: nextRollNo,
    phone: nextPhone,
    emergencyContact: (emergencyContact || nextPhone).trim(),
    parentPhone: (emergencyContact || nextPhone).trim(),
  });

  if (!updated) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  // If name or phone changed, also update the linked student user
  if (studentUser) {
    studentUser.name = req.body.name.trim();
    studentUser.phone = nextPhone;
  }

  if (parentUser) {
    parentUser.name = parentName.trim();
    parentUser.phone = (emergencyContact || nextPhone).trim();
  }

  res.status(200).json({
    success: true,
    message: 'Student updated successfully',
    data: updated,
  });
}

export async function deleteStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  let session: mongoose.ClientSession | undefined;
  let removedStudentId = '';
  let removedUserId = '';
  let removedParentId = '';
  try {
    const transactionSession = await mongoose.startSession();
    session = transactionSession;
    await transactionSession.withTransaction(async () => {
      const student = await StudentModel.findById(id).session(transactionSession).lean();
      if (!student || student.archivedAt) {
        const error = new Error('Student not found.');
        error.name = 'StudentNotFoundError';
        throw error;
      }

      const cls = store.findClassById(student.classId);
      const oldStudent = {
        _id: `old_${new mongoose.Types.ObjectId().toString()}`,
        fullName: student.name,
        parentGuardianName: student.parentName || '',
        contactNumber: student.phone || student.emergencyContact || '',
        alternateNumber: student.alternateContact || '',
        gender: student.gender,
        dob: student.dob,
        address: student.address,
        admissionNo: student.admissionNo,
        className: cls ? `${cls.name} - ${cls.section}` : student.className || '',
        dateLeft: new Date().toISOString().slice(0, 10),
      };

      await OldStudentModel.create([oldStudent], { session: transactionSession });
      await AttendanceModel.deleteMany({ studentId: student._id }, { session: transactionSession });
      await ResultModel.deleteMany({ studentId: student._id }, { session: transactionSession });
      await FeePaymentModel.deleteMany({ studentId: student._id }, { session: transactionSession });
      await StudentModel.deleteOne({ _id: student._id }, { session: transactionSession });
      await UserModel.deleteOne({ _id: student.userId }, { session: transactionSession });

      let deleteParentLogin = false;
      if (student.parentId) {
        const otherStudentCount = await StudentModel.countDocuments({
          parentId: student.parentId,
          _id: { $ne: student._id },
          archivedAt: { $in: ['', null] },
        }).session(transactionSession);
        deleteParentLogin = otherStudentCount === 0;
        if (deleteParentLogin) {
          await UserModel.deleteOne({ _id: student.parentId, role: 'parent' }, { session: transactionSession });
        }
      }

      const removedUserIds = [student.userId, ...(deleteParentLogin && student.parentId ? [student.parentId] : [])];
      if (removedUserIds.length) {
        await NotificationModel.deleteMany({ userId: { $in: removedUserIds } }, { session: transactionSession });
      }
      removedStudentId = student._id;
      removedUserId = student.userId;
      removedParentId = deleteParentLogin ? student.parentId || '' : '';
    });
  } catch (error) {
    if ((error as Error).name === 'StudentNotFoundError') {
      res.status(404).json({ success: false, message: (error as Error).message });
      return;
    }
    console.error('[Students] Transactional removal failed:', error);
    const transactionUnavailable = error instanceof Error &&
      /transaction numbers are only allowed|does not support transactions|replica set|mongos/i.test(error.message);
    const message = transactionUnavailable
      ? 'Student removal requires MongoDB transaction support. No records were changed.'
      : 'Student removal failed and all changes were rolled back. Please retry or contact support.';
    res.status(transactionUnavailable ? 503 : 500).json({ success: false, message });
    return;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (error) {
        console.error('[Students] Failed to close MongoDB removal session:', error);
      }
    }
  }

  store.students = store.students.filter((student) => student._id !== removedStudentId);
  store.users = store.users.filter((user) => user._id !== removedUserId && (!removedParentId || user._id !== removedParentId));
  store.attendance = store.attendance.filter((record) => record.studentId !== removedStudentId);
  store.results = store.results.filter((record) => record.studentId !== removedStudentId);
  store.feePayments = store.feePayments.filter((record) => record.studentId !== removedStudentId);
  const removedUsers = new Set([removedUserId, ...(removedParentId ? [removedParentId] : [])]);
  store.notifications = store.notifications.filter((notification) => !removedUsers.has(notification.userId));
  res.status(200).json({ success: true, message: 'Student removed successfully and saved to Old Students.' });
}
