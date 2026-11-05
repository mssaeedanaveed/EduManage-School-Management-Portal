import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export function getDashboardStats(req: AuthenticatedRequest, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  if (user.role === 'admin') {
    const stats = store.getAdminStats();
    res.status(200).json({
      success: true,
      role: 'admin',
      data: stats,
    });
    return;
  }

  if (user.role === 'teacher') {
    const teacher = store.findTeacherByUserId(user._id);
    const assignedClasses = teacher
      ? store.getClasses().filter((c) => teacher.assignedClassIds.includes(c._id))
      : [];
    const assignedSubjects = teacher
      ? store.getSubjectAssignments().filter((s) => s.teacherId === teacher._id)
      : [];
    const today = new Date().toISOString().split('T')[0];
    const timetableToday = teacher ? store.getTimetable(undefined, teacher._id) : [];

    res.status(200).json({
      success: true,
      role: 'teacher',
      data: {
        teacher,
        classes: assignedClasses,
        subjects: assignedSubjects,
        todayAttendanceDate: today,
        timetable: timetableToday,
      },
    });
    return;
  }

  if (user.role === 'student') {
    const student = store.findStudentByUserId(user._id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student profile not linked to user' });
      return;
    }

    const attendanceSummary = store.getStudentAttendanceSummary(student._id);
    const results = store.getResults(undefined, undefined, student._id);
    const subjects = store.getSubjects(student.classId);
    const timetable = store.getTimetable(student.classId);
    const feePayments = store.getFeePayments({ studentId: student._id });
    const pendingFees = feePayments
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.balance, 0);

    res.status(200).json({
      success: true,
      role: 'student',
      data: {
        student,
        subjects,
        attendanceSummary,
        latestResult: results.length ? results[results.length - 1] : null,
        results,
        timetable,
        timetableIsEmpty: timetable.length === 0,
        pendingFees,
        vouchers: feePayments,
        lastUpdated: new Date().toISOString(),
      },
    });
    return;
  }

  if (user.role === 'parent') {
    const children = store.findStudentsByParentId(user._id);
    const childrenData = children.map((child) => {
      const attendanceSummary = store.getStudentAttendanceSummary(child._id);
      const results = store.getResults(undefined, undefined, child._id);
      const timetable = store.getTimetable(child.classId);
      const vouchers = store.getFeePayments({ studentId: child._id });
      const pendingFees = vouchers
        .filter((p) => p.status !== 'Paid')
        .reduce((sum, p) => sum + p.balance, 0);

      return {
        student: child,
        attendanceSummary,
        latestResult: results[results.length - 1] || null,
        results,
        timetable,
        timetableIsEmpty: timetable.length === 0,
        pendingFees,
        vouchers,
        lastUpdated: new Date().toISOString(),
      };
    });

    res.status(200).json({
      success: true,
      role: 'parent',
      data: {
        childrenCount: children.length,
        children: childrenData,
      },
    });
    return;
  }

  res.status(400).json({ success: false, message: 'Unknown role' });
}
