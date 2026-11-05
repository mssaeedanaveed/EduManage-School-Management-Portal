import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessClass, isClassTeacher, teachesSubject } from '../services/teacherAccess.js';

const EXAM_TERMS = ['1st Term', '2nd Term', 'Final Term', 'Other'];

function normalizeExamTerm(term: string): string {
  const normalized = String(term || '').trim();
  if (normalized === 'Term 1') return '1st Term';
  if (normalized === 'Term 2' || normalized === 'Term 2 (Final)' || normalized === 'Final') return 'Final Term';
  return normalized;
}

function isValidSession(session: string): boolean {
  const match = /^(\d{4})-(\d{4})$/.exec(session);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

export function getAllExams(req: AuthenticatedRequest, res: Response): void {
  const exams = req.user?.role === 'teacher'
    ? store.getExams().filter((exam) =>
        exam.subjectId
          ? Boolean(exam.classId && (
              isClassTeacher(req.user, exam.classId) ||
              teachesSubject(req.user, exam.classId, exam.subjectId)
            ))
          : !exam.classId || canAccessClass(req.user, exam.classId)
      )
    : store.getExams();
  res.status(200).json({ success: true, data: exams });
}

export function createExam(req: AuthenticatedRequest, res: Response): void {
  const { name, term, session, startDate, endDate, status, classId, subjectId, totalMarks, date, passPercentage } = req.body;

  const examDate = startDate || date;
  const examEndDate = endDate || examDate;
  if (!name || !term || !examDate || !examEndDate) {
    res.status(400).json({ success: false, message: 'Name, term, startDate, and endDate are required.' });
    return;
  }
  const normalizedTerm = normalizeExamTerm(term);
  if (!EXAM_TERMS.includes(normalizedTerm)) {
    res.status(400).json({ success: false, message: 'Term must be 1st Term, 2nd Term, Final Term, or Other.' });
    return;
  }
  if (!isValidSession(session || '')) {
    res.status(400).json({ success: false, message: 'Session must use the format YYYY-YYYY.' });
    return;
  }
  if (examEndDate < examDate) {
    res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
    return;
  }
  const passValue = passPercentage === undefined ? 40 : Number(passPercentage);
  if (!Number.isInteger(passValue) || passValue < 1 || passValue > 100) {
    res.status(400).json({ success: false, message: 'Pass percentage must be a whole number from 1 to 100.' });
    return;
  }
  if (store.getExams().some((exam) => normalizeExamTerm(exam.term) === normalizedTerm && exam.session === session)) {
    res.status(409).json({ success: false, message: `${normalizedTerm} ${session} already exists.` });
    return;
  }
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can create examinations.' });
    return;
  }

  const exam = store.createExam({
    name,
    term: normalizedTerm || name,
    session: session || '2025-2026',
    startDate: examDate,
    endDate: examEndDate,
    status: status || 'Upcoming',
    passPercentage: passValue,
    published: false,
  });

  if (req.user?.role === 'admin') {
    for (const teacher of store.getTeachers()) {
      if (teacher.userId) {
        store.createNotification({
          userId: teacher.userId,
          role: 'teacher',
          type: 'exam_created',
          title: 'New Examination Created',
          message: `${exam.name} (${exam.term}) runs from ${exam.startDate} to ${exam.endDate}. Marks entry is now available.`,
          link: '/results',
          isRead: false,
          metadata: { examId: exam._id, startDate: exam.startDate, endDate: exam.endDate },
        });
      }
    }
  }

  res.status(201).json({ success: true, message: 'Exam created successfully', data: exam });
}

export function updateExam(req: AuthenticatedRequest, res: Response): void {
  const { examId } = req.params;
  const { name, term, session, startDate, endDate, passPercentage } = req.body;
  const exam = store.findExamById(examId);
  if (!exam) {
    res.status(404).json({ success: false, message: 'Exam not found.' });
    return;
  }
  if (!name?.trim() || !term || !session || !startDate || !endDate) {
    res.status(400).json({ success: false, message: 'Name, term, session, start date, and end date are required.' });
    return;
  }
  const normalizedTerm = normalizeExamTerm(term);
  if (!EXAM_TERMS.includes(normalizedTerm)) {
    res.status(400).json({ success: false, message: 'Term must be 1st Term, 2nd Term, Final Term, or Other.' });
    return;
  }
  if (!isValidSession(session)) {
    res.status(400).json({ success: false, message: 'Session must use the format YYYY-YYYY.' });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
    return;
  }
  const hasSubmittedResults = store.getResults(examId).length > 0;
  if (hasSubmittedResults && passPercentage !== undefined && Number(passPercentage) !== (exam.passPercentage ?? 40)) {
    res.status(409).json({ success: false, message: 'Pass percentage cannot be changed after results have been submitted.' });
    return;
  }
  if (store.getExams().some((item) => item._id !== examId && normalizeExamTerm(item.term) === normalizedTerm && item.session === session)) {
    res.status(409).json({ success: false, message: `${normalizedTerm} ${session} already exists.` });
    return;
  }
  const passValue = passPercentage === undefined ? exam.passPercentage ?? 40 : Number(passPercentage);
  if (!Number.isInteger(passValue) || passValue < 1 || passValue > 100) {
    res.status(400).json({ success: false, message: 'Pass percentage must be a whole number from 1 to 100.' });
    return;
  }
  const updated = store.updateExam(examId, { name: name.trim(), term: normalizedTerm, session, startDate, endDate, passPercentage: passValue });
  res.status(200).json({ success: true, message: 'Exam updated successfully.', data: updated });
}

export function deleteExam(req: AuthenticatedRequest, res: Response): void {
  const exam = store.findExamById(req.params.examId);
  if (!exam) {
    res.status(404).json({ success: false, message: 'Exam not found.' });
    return;
  }
  if (store.getResults(exam._id).length > 0) {
    res.status(409).json({ success: false, message: 'Exam cannot be deleted because marks have already been entered.' });
    return;
  }
  store.deleteExam(exam._id);
  res.status(200).json({ success: true, message: 'Exam deleted successfully.' });
}

export function requestResultUnlock(req: AuthenticatedRequest, res: Response): void {
  const { examId, classId, reason } = req.body as { examId?: string; classId?: string; reason?: string };
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (!examId || !classId || !reason?.trim()) {
    res.status(400).json({ success: false, message: 'examId, classId, and reason are required.' });
    return;
  }
  if (!isClassTeacher(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Only the class teacher can request this result unlock.' });
    return;
  }
  const results = store.getResults(examId, classId);
  if (results.length === 0 || !results.every((result) => result.locked)) {
    res.status(409).json({ success: false, message: 'Only submitted class results can be unlocked.' });
    return;
  }
  store.auditResult('unlock_requested', examId, classId, req.user._id, reason.trim());
  for (const admin of store.getUsers().filter((user) => user.role === 'admin')) {
    store.createNotification({
      userId: admin._id,
      role: 'admin',
      type: 'result_unlock_request',
      title: 'Result Unlock Request',
      message: `${store.findTeacherByUserId(req.user._id)?.name || 'Class teacher'} requested unlock for ${store.findExamById(examId)?.name || 'exam'}: ${reason.trim()}`,
      link: '/results',
      isRead: false,
      metadata: { examId, classId, reason: reason.trim(), requestedBy: req.user._id },
    });
  }
  res.status(201).json({ success: true, message: 'Unlock request sent to administration.' });
}

export function setExamPublished(req: AuthenticatedRequest, res: Response): void {
  const { published, classId } = req.body as { published?: boolean; classId?: string };
  const exam = store.findExamById(req.params.examId);
  if (!exam) {
    res.status(404).json({ success: false, message: 'Exam not found.' });
    return;
  }
  if (typeof published !== 'boolean') {
    res.status(400).json({ success: false, message: 'published must be true or false.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (classId) {
    const results = store.getResults(exam._id, classId);
    if (published && (results.length === 0 || !results.every((result) => result.published))) {
      res.status(409).json({ success: false, message: 'Results can be published only after the class teacher submits them.' });
      return;
    }
    store.setClassResultsPortalPublished(exam._id, classId, published, req.user._id);
    if (published) {
      for (const student of store.getStudents({ classId })) {
        if (student.userId) {
          store.createNotification({
            userId: student.userId, role: 'student', type: 'result_published',
            title: 'Results Published', message: `${exam.name} results have been published.`,
            link: '/results', isRead: false, metadata: { examId: exam._id, classId, studentId: student._id },
          });
        }
        if (student.parentId) {
          store.createNotification({
            userId: student.parentId, role: 'parent', type: 'result_published',
            title: 'Child Result Published', message: `${student.name}'s ${exam.name} result has been published.`,
            link: '/results', isRead: false, metadata: { examId: exam._id, classId, studentId: student._id },
          });
        }
      }
    }
    res.status(200).json({
      success: true,
      message: published ? 'Class results published to student and parent portals.' : 'Class results unpublished.',
      data: { examId: exam._id, classId, published, publishedBy: published ? req.user._id : undefined, publishedAt: published ? new Date().toISOString() : undefined },
    });
    return;
  }
  const updated = store.updateExam(exam._id, { published });
  res.status(200).json({ success: true, message: published ? 'Exam published.' : 'Exam unpublished.', data: updated });
}

export function approveResultUnlock(req: AuthenticatedRequest, res: Response): void {
  const { examId, classId, approved, notificationId } = req.body as {
    examId?: string;
    classId?: string;
    approved?: boolean;
    notificationId?: string;
  };
  if (!examId || !classId || typeof approved !== 'boolean') {
    res.status(400).json({ success: false, message: 'examId, classId, and approved are required.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  const notification = notificationId ? store.getNotifications(req.user._id, 'admin')
    .find((item) => item._id === notificationId) : undefined;
  const reason = String(notification?.metadata?.reason || '');
  const count = approved
    ? store.unlockClassResultsForEdit(examId, classId, req.user._id, reason)
    : 0;
  if (!approved) store.rejectClassUnlock(examId, classId, req.user._id, reason);
  if (notificationId) store.markNotificationRead(notificationId, req.user?._id);
  const requestedBy = notification?.metadata?.requestedBy;
  if (requestedBy) {
    store.createNotification({
      userId: requestedBy,
      role: 'teacher',
      type: approved ? 'result_unlock_approved' : 'result_unlock_rejected',
      title: approved ? 'Result Unlock Approved' : 'Result Unlock Rejected',
      message: `${store.findExamById(examId)?.name || 'The exam'} result for ${store.findClassById(classId)?.name || 'your class'} was ${approved ? 'approved for editing' : 'rejected'}.${reason ? ` Reason: ${reason}` : ''}`,
      link: '/results',
      isRead: false,
      metadata: { examId, classId, reason },
    });
  }
  res.status(200).json({
    success: true,
    message: approved ? `${count} locked result(s) unlocked.` : 'Unlock request denied.',
  });
}

export function getResultUnlockRequests(req: AuthenticatedRequest, res: Response): void {
  const admin = req.user;
  if (!admin || admin.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Administrator access required.' });
    return;
  }
  const requests = store.getNotifications(admin._id, 'admin')
    .filter((notification) => notification.type === 'result_unlock_request' && !notification.isRead)
    .map((notification) => {
      const exam = store.findExamById(notification.metadata?.examId);
      const cls = store.findClassById(notification.metadata?.classId);
      const teacher = store.findTeacherByUserId(notification.metadata?.requestedBy);
      return {
        id: notification._id,
        examId: notification.metadata?.examId,
        examName: exam?.name || '',
        classId: notification.metadata?.classId,
        className: cls?.name || '',
        section: cls?.section || '',
        reason: notification.metadata?.reason,
        requestedBy: notification.metadata?.requestedBy,
        teacherName: teacher?.name || 'Class teacher',
        createdAt: notification.createdAt,
        message: notification.message,
      };
    });
  res.status(200).json({ success: true, data: requests });
}

export function getResultAudit(req: AuthenticatedRequest, res: Response): void {
  const examId = String(req.query.examId || '');
  const classId = String(req.query.classId || '');
  const data = store.resultAuditLog
    .filter((entry) => (!examId || entry.examId === examId) && (!classId || entry.classId === classId))
    .map((entry) => {
      const user = store.findUserById(entry.actorId);
      return {
        ...entry,
        actorName: user?.name || 'System',
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  res.status(200).json({ success: true, data });
}

export function getAdminResultTracker(req: AuthenticatedRequest, res: Response): void {
  const examId = String(req.query.examId || '');
  const exam = examId ? store.findExamById(examId) : undefined;
  if (!examId || !exam) {
    res.status(400).json({ success: false, message: 'examId is required.' });
    return;
  }
  const classFilter = String(req.query.classId || '');
  const teacherFilter = String(req.query.teacherId || '');
  const statusFilter = String(req.query.status || '');
  const today = new Date().toISOString().slice(0, 10);
  const overdue = exam.endDate < today;
  const rows = store.getClasses().filter((classItem) => !classFilter || classItem._id === classFilter).flatMap((classItem) => {
    const students = store.getStudents({ classId: classItem._id });
    const subjects = store.getSubjects(classItem._id);
    const results = store.getResults(examId, classItem._id)
      .filter((result) => students.some((student) => student._id === result.studentId));
    return subjects.map((subject) => {
      const entered = results.filter((result) =>
        result.marks.some((mark) => mark.subjectId === subject._id)
      ).length;
      const status = entered === 0 ? 'Not started' : entered >= students.length ? 'Completed' : 'In progress';
      const teacher = subject.teacherId ? store.findTeacherById(subject.teacherId) : undefined;
      return {
        classId: classItem._id,
        className: classItem.name,
        section: classItem.section,
        subjectId: subject._id,
        subjectName: subject.name,
        teacherId: subject.teacherId || null,
        teacherName: teacher?.name || 'Unassigned',
        status,
        entered,
        total: students.length,
        overdue,
      };
    });
  });
  const data = rows.filter((row) =>
    (!teacherFilter || row.teacherId === teacherFilter) &&
    (!statusFilter || row.status === statusFilter)
  );
  res.status(200).json({ success: true, data });
}

export function getAdminResultSummary(req: AuthenticatedRequest, res: Response): void {
  const examId = String(req.query.examId || '');
  const classId = String(req.query.classId || '');
  const exam = examId ? store.findExamById(examId) : undefined;
  if (!exam || !classId) {
    res.status(400).json({ success: false, message: 'examId and classId are required.' });
    return;
  }
  const students = store.getStudents({ classId });
  const subjects = store.getSubjects(classId);
  const allResults = store.getResults(examId, classId)
    .filter((result) => students.some((student) => student._id === result.studentId));
  const submitted = allResults.length > 0 && allResults.every((result) => result.published) &&
    students.every((student) => {
      const result = allResults.find((item) => item.studentId === student._id);
      return result && subjects.every((subject) => result.marks.some((mark) => mark.subjectId === subject._id));
    });
  const pendingSubjects = subjects.filter((subject) =>
    students.some((student) =>
      !allResults.some((result) =>
        result.studentId === student._id &&
        result.marks.some((mark) => mark.subjectId === subject._id)
      )
    )
  ).map((subject) => subject.name);
  if (!submitted) {
    res.status(200).json({
      success: true,
      submitted: false,
      pendingSubjects,
      message: 'Result not submitted yet by the class teacher',
    });
    return;
  }
  const passPercentage = exam.passPercentage ?? 40;
  const studentResults = allResults.map((result) => ({
    studentId: result.studentId,
    name: result.studentName || '',
    rollNo: result.rollNo || '',
    percentage: result.percentage,
    position: result.position,
    status: result.percentage >= passPercentage ? 'Pass' : 'Fail',
  })).sort((left, right) => right.percentage - left.percentage || left.rollNo.localeCompare(right.rollNo));
  const percentages = studentResults.map((student) => student.percentage);
  res.status(200).json({
    success: true,
    submitted: true,
    status: exam.published ? 'Published' : allResults.every((result) => result.locked) ? 'Locked' : 'Submitted',
    summary: {
      overallPercentage: percentages.length ? Number((percentages.reduce((sum, value) => sum + value, 0) / percentages.length).toFixed(1)) : 0,
      totalStudents: studentResults.length,
      passCount: studentResults.filter((student) => student.status === 'Pass').length,
      failCount: studentResults.filter((student) => student.status === 'Fail').length,
      highestPercentage: percentages.length ? Math.max(...percentages) : 0,
      lowestPercentage: percentages.length ? Math.min(...percentages) : 0,
    },
    students: studentResults,
  });
}

export function getResults(req: AuthenticatedRequest, res: Response): void {
  const { examId, classId, studentId } = req.query as {
    examId?: string;
    classId?: string;
    studentId?: string;
  };

  let results = store.getResults(examId, classId, studentId);

  if (req.user?.role === 'admin') {
    results = results.filter((result) => result.published && Boolean(store.findStudentById(result.studentId) && !store.findStudentById(result.studentId)?.archivedAt));
  }

  // If student role, restrict to own result
  if (req.user?.role === 'student') {
    const student = store.findStudentByUserId(req.user._id);
    results = student ? results.filter((r) => r.studentId === student._id && r.published && r.portalPublished) : [];
  }

  // If parent role, restrict to their children's results
  if (req.user?.role === 'parent') {
    const children = store.findStudentsByParentId(req.user._id);
    const childIds = children.map((c) => c._id);
    results = results.filter((r) => childIds.includes(r.studentId) && r.published && r.portalPublished);
  }
  if (req.user?.role === 'teacher') {
    const teacher = store.findTeacherByUserId(req.user._id);
    results = results
      .filter((result) => teacher && (
        isClassTeacher(req.user, result.classId) ||
        result.marks.some((mark) => teachesSubject(req.user, result.classId, mark.subjectId))
      ))
      .map((result) => {
        if (isClassTeacher(req.user, result.classId)) return result;
        const marks = result.marks.filter((mark) => teachesSubject(req.user, result.classId, mark.subjectId));
        const totalMarksObtained = marks.reduce((total, mark) => total + mark.marksObtained, 0);
        const totalMaxMarks = marks.reduce((total, mark) => total + mark.maxMarks, 0);
        const percentage = totalMaxMarks ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)) : 0;
        let grade = 'F';
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B+';
        else if (percentage >= 60) grade = 'B';
        else if (percentage >= 50) grade = 'C';
        else if (percentage >= 40) grade = 'D';
        return {
          ...result,
          marks,
          totalMarksObtained,
          totalMaxMarks,
          percentage,
          grade,
          position: undefined,
          totalStudentsInClass: undefined,
          teacherRemarks: undefined,
        };
      });
  }

  res.status(200).json({
    success: true,
    total: results.length,
    data: results,
  });
}

export function saveResult(req: AuthenticatedRequest, res: Response): void {
  if (req.user?.role !== 'teacher') {
    res.status(403).json({ success: false, message: 'Only teachers may enter or edit examination marks.' });
    return;
  }
  const { examId, studentId, classId, marks, teacherRemarks } = req.body;

  if (!examId || !studentId || !classId || !Array.isArray(marks) || marks.length === 0) {
    res.status(400).json({
      success: false,
      message: 'examId, studentId, classId, and marks array are required.',
    });
    return;
  }

  const student = store.findStudentById(studentId);
  if (!student || student.classId !== classId) {
    res.status(400).json({ success: false, message: 'The student must belong to the selected class.' });
    return;
  }
  const exam = store.findExamById(examId);
  if (!exam) {
    res.status(404).json({ success: false, message: 'Exam not found.' });
    return;
  }
  const classSubjectIds = new Set(store.getSubjects(classId).map((subject) => subject._id));
  if (marks.some((mark: any) => typeof mark.subjectId !== 'string' || !classSubjectIds.has(mark.subjectId))) {
    res.status(400).json({ success: false, message: 'Every mark must reference a subject assigned to the selected class.' });
    return;
  }
  const existing = store.getResults(examId, classId, studentId)[0];
  if (existing?.locked) {
    res.status(409).json({ success: false, message: 'This result is locked. Submit an unlock request before editing.' });
    return;
  }
  if (req.user?.role === 'teacher') {
    const teacher = store.findTeacherByUserId(req.user._id);
    if (!teacher || !marks.every((mark: any) =>
      typeof mark.subjectId === 'string' &&
      (teachesSubject(req.user, classId, mark.subjectId) || (exam.isFinal && isClassTeacher(req.user, classId))) &&
      (!exam.subjectId || exam.subjectId === mark.subjectId) &&
      (!exam.classId || exam.classId === classId)
    )) {
      res.status(403).json({ success: false, message: 'Marks can only be entered for your assigned subjects and classes.' });
      return;
    }
    if (existing?.published && !isClassTeacher(req.user, classId)) {
      res.status(409).json({ success: false, message: 'Finalized results can only be changed by the class teacher.' });
      return;
    }
  }
  if (marks.some((mark: any) =>
    !Number.isFinite(Number(mark.marksObtained)) ||
    !Number.isFinite(Number(mark.maxMarks)) ||
    Number(mark.maxMarks) <= 0 ||
    Number(mark.marksObtained) < 0 ||
    Number(mark.marksObtained) > Number(mark.maxMarks) ||
    (exam.totalMarks && Number(mark.maxMarks) > exam.totalMarks)
  )) {
    res.status(400).json({
      success: false,
      message: 'Each mark must be a number between zero and its maximum marks.',
    });
    return;
  }

  if (marks.some((mark: any) => mark.status === 'Absent' && mark.marksObtained !== undefined && Number(mark.marksObtained) !== 0)) {
    res.status(400).json({ success: false, message: 'Absent subjects cannot include marks.' });
    return;
  }

  // Auto-fill letter grade for individual subject marks if not provided
  const processedMarks = marks.map((m: any) => {
    const subject = store.findSubjectById(m.subjectId);
    const pct = m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0;
    let grade = 'F';
    if (pct >= 90) grade = 'A+';
    else if (pct >= 80) grade = 'A';
    else if (pct >= 70) grade = 'B+';
    else if (pct >= 60) grade = 'B';
    else if (pct >= 50) grade = 'C';
    else if (pct >= 40) grade = 'D';

    return {
      subjectId: m.subjectId,
      subjectName: subject?.name || m.subjectName || 'Subject',
      marksObtained: Number(m.marksObtained),
      maxMarks: Number(m.maxMarks) || 100,
      grade: m.grade || grade,
      remarks: m.remarks || '',
      status: m.status === 'Absent' ? 'Absent' : 'Present',
    };
  });

  const marksToSave = req.user?.role === 'teacher' && existing
    ? [
        ...existing.marks.filter((existingMark) =>
          !processedMarks.some((mark) => mark.subjectId === existingMark.subjectId)
        ),
        ...processedMarks,
      ]
    : processedMarks;
  const savedResult = store.saveResult({
    examId,
    studentId,
    classId,
    marks: marksToSave,
    teacherRemarks,
    published: req.user?.role === 'teacher' ? Boolean(existing?.published && isClassTeacher(req.user, classId)) : existing?.published ?? true,
    notifyStudents: req.user?.role !== 'teacher',
  });

  res.status(200).json({
    success: true,
    message: 'Exam result saved and positions calculated successfully.',
    data: savedResult,
  });
}

export function finalizeClassResults(req: AuthenticatedRequest, res: Response): void {
  const { examId, classId } = req.body as { examId?: string; classId?: string };
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  if (!examId || !classId) {
    res.status(400).json({ success: false, message: 'examId and classId are required.' });
    return;
  }
  if (!req.user || !isClassTeacher(req.user, classId)) {
    res.status(403).json({ success: false, message: 'Only the assigned class teacher can finalize this class result.' });
    return;
  }
  const exam = store.findExamById(examId);
  if (!exam || (exam.classId && exam.classId !== classId)) {
    res.status(404).json({ success: false, message: 'Exam not found for this class.' });
    return;
  }
  const students = store.getStudents({ classId });
  const subjects = store.getSubjects(classId);
  if (students.length === 0 || subjects.length === 0) {
    res.status(409).json({ success: false, message: 'This class has no students or subjects to finalize.' });
    return;
  }

  let finalExamId = examId;
  let finalized;
  if (exam.subjectId) {
    const subjectExams = subjects.map((subject) => {
      const candidates = store.getExams()
        .filter((candidate) =>
          candidate.classId === classId &&
          candidate.subjectId === subject._id &&
          candidate.name === exam.name &&
          candidate.term === exam.term &&
          candidate.session === exam.session
        )
        .sort((left, right) => right.endDate.localeCompare(left.endDate));
      return candidates.find((candidate) =>
        students.every((student) => {
          const result = store.getResults(candidate._id, classId, student._id)[0];
          return result?.marks.some((mark) => mark.subjectId === subject._id);
        })
      );
    });
    if (subjectExams.some((candidate) => !candidate)) {
      res.status(409).json({
        success: false,
        message: `Every class subject needs marks for every student under ${exam.term} before finalization.`,
      });
      return;
    }
    const finalExam = store.getExams().find((candidate) =>
      candidate.classId === classId &&
      candidate.name === `${exam.name} Final Results` &&
      candidate.term === exam.term &&
      candidate.session === exam.session &&
      candidate.isFinal
    ) || store.createExam({
      name: `${exam.name} Final Results`,
      term: exam.term,
      session: exam.session,
      startDate: exam.startDate,
      endDate: exam.endDate,
      status: 'Completed',
      classId,
      totalMarks: subjects.reduce((sum, subject) => {
        const sourceExam = subjectExams.find((item) => item?.subjectId === subject._id);
        return sum + (sourceExam?.totalMarks || 100);
      }, 0),
      isFinal: true,
    });
    finalExamId = finalExam._id;
    for (const student of students) {
      const finalMarks = subjects.map((subject) => {
        const sourceExam = subjectExams.find((item) => item?.subjectId === subject._id)!;
        const sourceResult = store.getResults(sourceExam._id, classId, student._id)[0];
        return sourceResult!.marks.find((mark) => mark.subjectId === subject._id)!;
      });
      store.saveResult({
        examId: finalExamId,
        studentId: student._id,
        classId,
        marks: finalMarks,
        teacherRemarks: 'Finalized by class teacher.',
        published: true,
        notifyStudents: false,
      });
    }
    finalized = store.getResults(finalExamId, classId);
    subjectExams.forEach((subjectExam) => {
      if (subjectExam) {
        store.getResults(subjectExam._id, classId).forEach((result) => {
          result.locked = true;
        });
      }
    });
  } else {
    const classResults = store.getResults(examId, classId);
    const allComplete = students.every((student) => {
      const result = classResults.find((item) => item.studentId === student._id);
      return result && subjects.every((subject) => result.marks.some((mark) => mark.subjectId === subject._id));
    });
    if (!allComplete) {
      res.status(409).json({
        success: false,
        message: 'Every student must have marks recorded for every class subject before results can be finalized.',
      });
      return;
    }
    if (classResults.every((result) => result.published)) {
      res.status(409).json({ success: false, message: 'These class results are already finalized.' });
      return;
    }
    finalized = store.finalizeClassResults(examId, classId);
  }
  finalized.forEach((result) => {
    result.locked = true;
    result.status = 'Locked';
  });
  store.auditResult('submitted', finalExamId, classId, req.user._id);
  store.auditResult('locked', finalExamId, classId, req.user._id);
  store.recomputePositions(finalExamId, classId);
  for (const result of finalized) {
    const student = store.findStudentById(result.studentId);
    if (student?.userId) {
      store.createNotification({
        userId: student.userId,
        role: 'student',
        type: 'results_published',
        title: 'Final Results Published',
        message: `Final results for ${exam.name} are now available.`,
        link: '/results',
        isRead: false,
        metadata: { examId: finalExamId, studentId: student._id },
      });
    }
    if (student?.parentId) {
      store.createNotification({
        userId: student.parentId,
        role: 'parent',
        type: 'results_published',
        title: 'Final Results Published',
        message: `Final results for ${exam.name} are now available for ${student.name}.`,
        link: '/results',
        isRead: false,
        metadata: { examId: finalExamId, studentId: student._id },
      });
    }
  }
  res.status(200).json({
    success: true,
    message: 'Class results finalized and published.',
    examId: finalExamId,
    data: finalized,
  });
}

export function getReportCard(req: AuthenticatedRequest, res: Response): void {
  const { studentId, examId } = req.params;
  if (req.user?.role === 'admin') {
    res.status(403).json({ success: false, message: 'Administrators may view result summaries but cannot open report cards.' });
    return;
  }

  const student = store.findStudentById(studentId);
  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  // Permission check
  if (req.user?.role === 'student' && student.userId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied: You cannot view other students.' });
    return;
  }
  if (req.user?.role === 'parent' && student.parentId !== req.user._id) {
    res.status(403).json({ success: false, message: 'Access denied: You can only view your linked children.' });
    return;
  }
  if (req.user?.role === 'teacher' && !isClassTeacher(req.user, student.classId)) {
    res.status(403).json({ success: false, message: 'Only the class teacher can view and publish this class report card.' });
    return;
  }

  const exam = store.findExamById(examId);
  const results = store.getResults(examId, undefined, studentId);
  const result = results[0];

  if (!result) {
    res.status(404).json({ success: false, message: 'No result recorded for this student and exam.' });
    return;
  }
  if (!result.published && req.user?.role === 'teacher') {
    res.status(404).json({ success: false, message: 'The class teacher has not finalized this report card yet.' });
    return;
  }
  if (!result.published && req.user?.role !== 'teacher') {
    res.status(404).json({ success: false, message: 'Final results have not been published for this student.' });
    return;
  }
  if (!result.portalPublished && (req.user?.role === 'student' || req.user?.role === 'parent')) {
    res.status(404).json({ success: false, message: 'Final results have not been published for this student.' });
    return;
  }

  const cls = store.findClassById(student.classId);
  const attendanceSummary = store.getStudentAttendanceSummary(student._id);

  res.status(200).json({
    success: true,
    data: {
      reportCardId: `RC-${examId}-${studentId}`,
      schoolInfo: {},
      student: {
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        admissionNo: student.admissionNo,
        className: student.className || `${cls?.name} - ${cls?.section}`,
        gender: student.gender,
        dob: student.dob,
        parentName: student.parentName,
      },
      exam: {
        id: exam?._id,
        name: exam?.name || result.examName,
        term: exam?.term,
        session: exam?.session,
      },
      result: {
        marks: result.marks,
        totalMarksObtained: result.totalMarksObtained,
        totalMaxMarks: result.totalMaxMarks,
        percentage: result.percentage,
        grade: result.grade,
        position: result.position,
        totalStudentsInClass: result.totalStudentsInClass,
        teacherRemarks: result.teacherRemarks,
      },
      attendance: {
        attendancePercentage: attendanceSummary.percentage,
        daysPresent: attendanceSummary.presentDays,
        totalDays: attendanceSummary.totalDays,
      },
      gradingScale: [
        { grade: 'A+', range: '90% - 100%', remarks: 'Outstanding' },
        { grade: 'A', range: '80% - 89%', remarks: 'Excellent' },
        { grade: 'B+', range: '70% - 79%', remarks: 'Very Good' },
        { grade: 'B', range: '60% - 69%', remarks: 'Good' },
        { grade: 'C', range: '50% - 59%', remarks: 'Satisfactory' },
        { grade: 'D', range: '40% - 49%', remarks: 'Passing' },
        { grade: 'F', range: '< 40%', remarks: 'Needs Improvement' },
      ],
      generatedAt: new Date().toISOString(),
    },
  });
}
