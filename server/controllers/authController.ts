import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import store from '../data/store.js';
import { generateToken, AuthenticatedRequest } from '../middleware/auth.js';
import mongoSync from '../services/mongoSync.js';
import { UserModel } from '../models/User.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    res.status(400).json({ success: false, message: 'Please provide email and password' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const demoEmailAliases: Record<string, string> = {
    'teacher@school.edu': 'marcus.sterling@school.edu',
    'student@school.edu': 'aria.montgomery@school.edu',
    'parent@school.edu': 'robert.montgomery@school.edu',
  };
  const lookupEmail = demoEmailAliases[normalizedEmail] || normalizedEmail;
  const user = mongoSync.isConnected()
    ? await UserModel.findOne({ email: lookupEmail }).lean()
    : store.findUserByEmail(lookupEmail);
  if (!user) {
    res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return;
  }

  const token = generateToken(user);

  // Attach associated profile details (studentId, teacherId, children for parent)
  let profileData: any = {};
  if (user.role === 'teacher') {
    const teacher = store.findTeacherByUserId(user._id);
    profileData.teacher = teacher;
  } else if (user.role === 'student') {
    const student = store.findStudentByUserId(user._id);
    if (!student) {
      res.status(403).json({ success: false, message: 'This student account is no longer active.' });
      return;
    }
    profileData.student = student;
  } else if (user.role === 'parent') {
    const children = store.findStudentsByParentId(user._id);
    profileData.children = children;
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
    },
    profile: profileData,
  });
}

export function getMe(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  let profileData: any = {};
  if (req.user.role === 'teacher') {
    const teacher = store.findTeacherByUserId(req.user._id);
    profileData.teacher = teacher;
  } else if (req.user.role === 'student') {
    const student = store.findStudentByUserId(req.user._id);
    profileData.student = student;
  } else if (req.user.role === 'parent') {
    const children = store.findStudentsByParentId(req.user._id);
    profileData.children = children;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      avatar: req.user.avatar,
      phone: req.user.phone,
    },
    profile: profileData,
  });
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }
  if (typeof currentPassword !== 'string' || !currentPassword ||
      typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Current password is required and the new password must be at least 8 characters long.',
    });
    return;
  }
  if (!await bcrypt.compare(currentPassword, req.user.passwordHash)) {
    res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  store.updateUser(req.user._id, { passwordHash });
  res.status(200).json({ success: true, message: 'Password changed successfully.' });
}

export async function resetDemoData(_req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!mongoSync.isConnected()) {
    res.status(503).json({ success: false, message: 'MongoDB is unavailable. Demo data was not reset.' });
    return;
  }

  store.resetToSeed();
  try {
    const result = await mongoSync.syncAllToMongo(true);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.counts,
    });
  } catch (error) {
    console.error('[Auth] Failed to reset MongoDB demo data:', error);
    res.status(500).json({ success: false, message: 'Failed to reset demo data in MongoDB.' });
  }
}

export function getDirectoryAccounts(req: Request, res: Response): void {
  const users = store.getUsers();
  const teachers = store.getTeachers();
  const students = store.getStudents();
  const classes = store.getClasses();
  const subjects = store.getSubjectAssignments();

  const accounts = users.map((u) => {
    let detail = '';
    let badge = '';

    if (u.role === 'teacher') {
      const teacher = teachers.find((t) => t.userId === u._id);
      if (teacher) {
        const assignedClassNames = classes
          .filter((c) => teacher.assignedClassIds?.includes(c._id))
          .map((c) => `${c.name}-${c.section}`)
          .join(', ');
        const assignedSubjNames = subjects
          .filter((subject) => subject.teacherId === teacher._id)
          .map((subject) => `${subject.name} (${store.findClassById(subject.classId)?.section || ''})`)
          .join(', ');
        badge = `${teacher.employeeId} • ${teacher.designation || 'Teacher'}`;
        detail = `Classes: ${assignedClassNames || 'None'} • Subjects: ${assignedSubjNames || 'None'}`;
      } else {
        badge = 'Faculty';
        detail = 'Teacher Account';
      }
    } else if (u.role === 'student') {
      const student = students.find((s) => s.userId === u._id);
      if (student) {
        badge = `Roll: ${student.rollNo} • Class: ${student.className || 'Grade 10'}`;
        detail = `Parent: ${student.parentName || 'N/A'} • Adm: ${student.admissionNo}`;
      } else {
        badge = 'Student';
        detail = 'Student Account';
      }
    } else if (u.role === 'parent') {
      const children = students.filter((s) => s.parentId === u._id);
      const childNames = children.map((c) => `${c.name} (${c.rollNo})`).join(', ');
      badge = `Parent (${children.length} Student${children.length === 1 ? '' : 's'})`;
      detail = children.length > 0 ? `Children: ${childNames}` : 'Family Account';
    } else if (u.role === 'admin') {
      badge = 'Principal Administrator';
      detail = 'Full Administrative Control over campus operations';
    }

    return {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      badge,
      detail,
      defaultPassword: 'password123',
    };
  });

  res.status(200).json({ success: true, data: accounts });
}
