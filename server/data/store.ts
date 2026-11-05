import {
  IUser,
  IClass,
  ISubject,
  ITeacher,
  IStudent,
  IAttendance,
  IExam,
  IResult,
  ITimetableSlot,
  IFeeStructure,
  IFeePayment,
  INotification,
} from '../types.js';
import {
  initialUsers,
  initialClasses,
  initialTeachers,
  initialSubjects,
  initialStudents,
  initialExams,
  initialResults,
  generateSeedAttendance,
  initialTimetable,
} from './seedData.js';

class DataStore {
  public users: IUser[] = [];
  public classes: IClass[] = [];
  public teachers: ITeacher[] = [];
  public subjects: ISubject[] = [];
  public students: IStudent[] = [];
  public attendance: IAttendance[] = [];
  public exams: IExam[] = [];
  public results: IResult[] = [];
  public timetable: ITimetableSlot[] = [];
  public feeStructures: IFeeStructure[] = [];
  public feePayments: IFeePayment[] = [];
  public notifications: INotification[] = [];
  public resultAuditLog: Array<{
    _id: string;
    examId: string;
    classId?: string;
    studentId?: string;
    action: string;
    actorId: string;
    reason?: string;
    createdAt: string;
  }> = [];

  private onMutation?: (
    collection: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    id: string,
    data?: any
  ) => void | Promise<void>;
  private pendingPersistence: Promise<void>[] = [];
  public setMutationListener(
    listener: (
      collection: string,
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      id: string,
      data?: any
    ) => void | Promise<void>
  ) {
    this.onMutation = listener;
  }

  public async flushPendingPersistence(): Promise<void> {
    const pending = this.pendingPersistence.splice(0);
    const results = await Promise.allSettled(pending);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) {
      throw new Error('One or more database writes failed.', { cause: failed.reason });
    }
  }

  public ensureHafsaKhan() {
    const hasHafsa = this.students.some(
      (s) => s.name.toLowerCase().includes('hafsa') || s._id === 'stu_hafsa'
    );
    if (!hasHafsa) {
      const hafsaStudent: IStudent = {
        _id: 'stu_hafsa',
        userId: 'usr_student_hafsa',
        name: 'Hafsa Khan',
        email: 'hafsa.khan@student.school.edu',
        admissionNo: 'ADM-2024-005',
        rollNo: '9A-05',
        classId: 'cls_9a',
        className: 'Grade 9 - A',
        section: 'A',
        parentId: 'usr_parent_hafsa',
        parentName: 'Tariq Khan',
        parentPhone: '+1 (555) 345-6789',
        parentEmail: 'tariq.khan@parent.school.edu',
        dob: '2011-05-18',
        gender: 'Female',
        phone: '+1 (555) 345-6789',
        address: '142 Willow Creek Rd, Springfield',
        bloodGroup: 'B+',
        emergencyContact: '+1 (555) 345-6789',
        alternateContact: '',
      };
      this.students.push(hafsaStudent);

      // Student user
      if (!this.users.some((u) => u._id === 'usr_student_hafsa')) {
        this.users.push({
          _id: 'usr_student_hafsa',
          name: 'Hafsa Khan',
          email: 'hafsa.khan@student.school.edu',
          passwordHash: initialUsers[0].passwordHash,
          role: 'student',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          phone: '+1 (555) 345-6789',
          createdAt: new Date().toISOString(),
        });
      }

      // Parent user
      if (!this.users.some((u) => u._id === 'usr_parent_hafsa')) {
        this.users.push({
          _id: 'usr_parent_hafsa',
          name: 'Tariq Khan',
          email: 'tariq.khan@parent.school.edu',
          passwordHash: initialUsers[0].passwordHash,
          role: 'parent',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          phone: '+1 (555) 345-6789',
          createdAt: new Date().toISOString(),
        });
      }

    }
  }

  private notify(
    collection: string,
    op: 'INSERT' | 'UPDATE' | 'DELETE',
    id: string,
    data?: any
  ) {
    try {
      const persistence = this.onMutation?.(collection, op, id, data);
      if (persistence) {
        this.pendingPersistence.push(persistence);
        void persistence.catch(() => undefined);
      }
    } catch (e) {
      console.error('[Store Mutation] Could not queue database persistence:', e);
      throw e;
    }
  }

  constructor() {
    this.resetToSeed();
    this.ensureHafsaKhan();
  }

  public resetToSeed() {
    this.users = JSON.parse(JSON.stringify(initialUsers));
    this.classes = JSON.parse(JSON.stringify(initialClasses));
    this.teachers = JSON.parse(JSON.stringify(initialTeachers));
    this.subjects = JSON.parse(JSON.stringify(initialSubjects));
    this.students = JSON.parse(JSON.stringify(initialStudents));
    this.attendance = JSON.parse(JSON.stringify(generateSeedAttendance()));
    this.exams = JSON.parse(JSON.stringify(initialExams));
    this.results = JSON.parse(JSON.stringify(initialResults));
    this.timetable = JSON.parse(JSON.stringify(initialTimetable));
    this.feeStructures = [];
    this.feePayments = [];
    this.notifications = [
      {
        _id: 'notif_init_01',
        userId: 'usr_admin_001',
        role: 'admin',
        type: 'fee_monthly_alert',
        title: 'Fee Vouchers Ready',
        message: 'Fee vouchers for next month are ready to be generated and sent.',
        link: '/fees',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        _id: 'notif_init_02',
        userId: 'usr_stu_001',
        role: 'student',
        type: 'fee_voucher_published',
        title: 'Fee Voucher Available',
        message: 'Your fee voucher for October 2026 is available. Please pay before 2026-10-10.',
        link: '/fees',
        isRead: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        _id: 'notif_init_03',
        userId: 'usr_parent_001',
        role: 'parent',
        type: 'fee_voucher_published',
        title: 'Fee Voucher Available',
        message: 'Your fee voucher for October 2026 is available. Please pay before 2026-10-10.',
        link: '/fees',
        isRead: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
    this.ensureHafsaKhan();
  }

  // --- Users ---
  public getUsers(): IUser[] {
    return this.users;
  }

  public findUserById(id: string): IUser | undefined {
    return this.users.find((u) => u._id === id);
  }

  public updateUser(id: string, update: Partial<IUser>): IUser | null {
    const index = this.users.findIndex((user) => user._id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...update };
    this.notify('users', 'UPDATE', id, this.users[index]);
    return this.users[index];
  }

  public deleteUser(id: string): boolean {
    const previousLength = this.users.length;
    this.users = this.users.filter((user) => user._id !== id);
    if (this.users.length < previousLength) {
      this.notify('users', 'DELETE', id);
      return true;
    }
    return false;
  }

  public findUserByEmail(email: string): IUser | undefined {
    const q = email.toLowerCase().trim();
    if (q === 'teacher@school.edu') {
      return this.users.find((u) => u.email === 'marcus.sterling@school.edu' || u.email === 'teacher@school.edu');
    }
    if (q === 'student@school.edu') {
      return this.users.find((u) => u.email === 'aria.montgomery@school.edu' || u.email === 'student@school.edu');
    }
    if (q === 'parent@school.edu') {
      return this.users.find((u) => u.email === 'robert.montgomery@school.edu' || u.email === 'parent@school.edu');
    }
    return this.users.find((u) => u.email.toLowerCase() === q);
  }

  public createUser(userData: Omit<IUser, '_id' | 'createdAt'>): IUser {
    const newUser: IUser = {
      ...userData,
      _id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.notify('users', 'INSERT', newUser._id, newUser);
    return newUser;
  }

  // --- Classes ---
  public getClasses(): IClass[] {
    return this.classes;
  }

  public findClassById(id: string): IClass | undefined {
    return this.classes.find((c) => c._id === id);
  }

  public createClass(data: Omit<IClass, '_id'>): IClass {
    const newClass: IClass = {
      ...data,
      _id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    if (newClass.classTeacherId) {
      const teacher = this.findTeacherById(newClass.classTeacherId);
      if (teacher) newClass.classTeacherName = teacher.name;
    }
    this.classes.push(newClass);
    this.notify('classes', 'INSERT', newClass._id, newClass);
    return newClass;
  }

  public updateClass(id: string, update: Partial<IClass>): IClass | null {
    const index = this.classes.findIndex((c) => c._id === id);
    if (index === -1) return null;
    if (Object.prototype.hasOwnProperty.call(update, 'classTeacherId')) {
      const teacher = update.classTeacherId ? this.findTeacherById(update.classTeacherId) : undefined;
      update.classTeacherName = teacher?.name || '';
    }
    this.classes[index] = { ...this.classes[index], ...update };
    this.notify('classes', 'UPDATE', id, this.classes[index]);
    for (const student of this.getStudents({ classId: id })) {
      this.updateStudent(student._id, { classId: id });
    }
    return this.classes[index];
  }

  public deleteClass(id: string): boolean {
    const prevLen = this.classes.length;
    this.classes = this.classes.filter((c) => c._id !== id);
    if (this.classes.length < prevLen) {
      this.notify('classes', 'DELETE', id);
      return true;
    }
    return false;
  }

  // --- Subjects ---
  public getSubjectClassIds(subject: ISubject): string[] {
    if (Array.isArray(subject.classIds)) return [...new Set(subject.classIds)];
    if (subject.classGroupKey) {
      return this.classes
        .filter((cls) => this.classGroupKey(cls.name, cls.academicYear) === subject.classGroupKey)
        .map((cls) => cls._id);
    }
    return subject.classId ? [subject.classId] : [];
  }

  public classGroupKey(className: string, academicYear: string): string {
    return `${className.trim().toLowerCase()}::${academicYear.trim().toLowerCase()}`;
  }

  public getSubjectTeacherId(subject: ISubject, classId: string): string {
    const assignment = subject.sectionAssignments?.find((item) => item.classId === classId);
    if (assignment) return assignment.teacherId || '';
    return subject.classId === classId ? subject.teacherId || '' : '';
  }

  public getSubjectAssignments(): ISubject[] {
    return this.subjects.flatMap((subject) =>
      this.getSubjectClassIds(subject).map((classId) => {
        const cls = this.findClassById(classId);
        const teacherId = this.getSubjectTeacherId(subject, classId);
        const teacher = teacherId ? this.findTeacherById(teacherId) : undefined;
        return {
          ...subject,
          classId,
          className: cls ? `${cls.name} - ${cls.section}` : subject.className,
          teacherId,
          teacherName: teacher?.name || '',
        };
      })
    );
  }

  public setSubjectClassIds(subjectId: string, classIds: string[]): ISubject | null {
    const subject = this.findSubjectById(subjectId);
    if (!subject) return null;
    const uniqueClassIds = [...new Set(classIds)];
    const previousAssignments = subject.sectionAssignments || [];
    const assignments = uniqueClassIds.map((classId) => ({
      classId,
      teacherId: previousAssignments.find((item) => item.classId === classId)?.teacherId ||
        (subject.classId === classId ? subject.teacherId || '' : ''),
    }));
    const updated = this.updateSubject(subjectId, {
      classIds: uniqueClassIds,
      sectionAssignments: assignments,
    });
    for (const cls of this.classes) {
      const currentSubjects = cls.subjects || [];
      const shouldLink = uniqueClassIds.includes(cls._id);
      if (shouldLink && !currentSubjects.includes(subjectId)) {
        this.updateClass(cls._id, { subjects: [...currentSubjects, subjectId] });
      } else if (!shouldLink && currentSubjects.includes(subjectId)) {
        this.updateClass(cls._id, { subjects: currentSubjects.filter((id) => id !== subjectId) });
      }
    }
    return updated;
  }

  public getSubjects(classId?: string): ISubject[] {
    if (classId) {
      const classRecord = this.findClassById(classId);
      return this.subjects
        .filter((subject) =>
          (classRecord?.subjects?.includes(subject._id) ?? false) ||
          this.getSubjectClassIds(subject).includes(classId) ||
          subject.classId === classId
        )
        .map((subject) => ({
          ...subject,
          className: classRecord ? `${classRecord.name} - ${classRecord.section}` : subject.className,
          classId,
          teacherId: this.getSubjectTeacherId(subject, classId),
          teacherName: this.findTeacherById(this.getSubjectTeacherId(subject, classId))?.name || '',
        }));
    }
    return this.subjects;
  }

  public findSubjectById(id: string): ISubject | undefined {
    return this.subjects.find((s) => s._id === id);
  }

  public createSubject(data: Omit<ISubject, '_id'>): ISubject {
    const cls = this.findClassById(data.classId);
    const newSubj: ISubject = {
      ...data,
      _id: `sbj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      className: cls ? cls.name : '',
    };
    this.subjects.push(newSubj);
    this.notify('subjects', 'INSERT', newSubj._id, newSubj);
    return newSubj;
  }

  public updateSubject(id: string, update: Partial<ISubject>): ISubject | null {
    const index = this.subjects.findIndex((s) => s._id === id);
    if (index === -1) return null;
    this.subjects[index] = { ...this.subjects[index], ...update };
    this.notify('subjects', 'UPDATE', id, this.subjects[index]);
    return this.subjects[index];
  }

  public deleteSubject(id: string): boolean {
    for (const cls of this.classes.filter((item) => item.subjects?.includes(id))) {
      this.updateClass(cls._id, { subjects: cls.subjects?.filter((subjectId) => subjectId !== id) });
    }
    const prev = this.subjects.length;
    this.subjects = this.subjects.filter((s) => s._id !== id);
    if (this.subjects.length < prev) {
      this.notify('subjects', 'DELETE', id);
      return true;
    }
    return false;
  }

  // --- Teachers ---
  public getTeachers(): ITeacher[] {
    return this.teachers;
  }

  public findTeacherById(id: string): ITeacher | undefined {
    return this.teachers.find((t) => t._id === id);
  }

  public findTeacherByUserId(userId: string): ITeacher | undefined {
    return this.teachers.find((t) => t.userId === userId);
  }

  public createTeacher(teacherData: Omit<ITeacher, '_id'>): ITeacher {
    const newTeacher: ITeacher = {
      ...teacherData,
      _id: `tch_${Date.now()}`,
    };
    this.teachers.push(newTeacher);
    this.notify('teachers', 'INSERT', newTeacher._id, newTeacher);
    return newTeacher;
  }

  public updateTeacher(id: string, update: Partial<ITeacher>): ITeacher | null {
    const index = this.teachers.findIndex((t) => t._id === id);
    if (index === -1) return null;
    this.teachers[index] = { ...this.teachers[index], ...update };
    this.notify('teachers', 'UPDATE', id, this.teachers[index]);
    return this.teachers[index];
  }

  public deleteTeacher(id: string): boolean {
    const prev = this.teachers.length;
    this.teachers = this.teachers.filter((t) => t._id !== id);
    if (this.teachers.length < prev) {
      this.notify('teachers', 'DELETE', id);
      return true;
    }
    return false;
  }

  // --- Students ---
  public getStudents(filter?: { classId?: string; search?: string }): IStudent[] {
    let list = this.students.filter((student) => !student.archivedAt);
    if (filter?.classId) {
      list = list.filter((s) => s.classId === filter.classId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      );
    }
    return list.map((student) => {
      const cls = this.findClassById(student.classId);
      return cls
        ? { ...student, className: `${cls.name} - ${cls.section}`, section: cls.section }
        : student;
    });
  }

  public findStudentById(id: string): IStudent | undefined {
    const student = this.students.find((s) => s._id === id);
    if (!student) return undefined;
    const cls = this.findClassById(student.classId);
    return cls ? { ...student, className: `${cls.name} - ${cls.section}`, section: cls.section } : student;
  }

  public findStudentByUserId(userId: string): IStudent | undefined {
    const student = this.students.find((s) => s.userId === userId && !s.archivedAt);
    return student ? this.findStudentById(student._id) : undefined;
  }

  public findStudentsByParentId(parentId: string): IStudent[] {
    return this.getStudents().filter((s) => s.parentId === parentId);
  }

  public createStudent(studentData: Omit<IStudent, '_id'>): IStudent {
    const cls = this.findClassById(studentData.classId);
    const newStudent: IStudent = {
      ...studentData,
      _id: `stu_${Date.now()}`,
      className: cls ? `${cls.name} - ${cls.section}` : studentData.className,
      section: cls ? cls.section : studentData.section,
    };
    this.students.push(newStudent);
    this.notify('students', 'INSERT', newStudent._id, newStudent);
    return newStudent;
  }

  public updateStudent(id: string, update: Partial<IStudent>): IStudent | null {
    const index = this.students.findIndex((s) => s._id === id);
    if (index === -1) return null;
    if (update.classId) {
      const cls = this.findClassById(update.classId);
      if (cls) {
        update.className = `${cls.name} - ${cls.section}`;
        update.section = cls.section;
      }
    }
    if (update.parentId) {
      const parentUser = this.findUserById(update.parentId);
      if (parentUser) {
        update.parentName = parentUser.name;
        update.parentEmail = parentUser.email;
        update.parentPhone = parentUser.phone;
      }
    }
    this.students[index] = { ...this.students[index], ...update };
    this.notify('students', 'UPDATE', id, this.students[index]);
    return this.students[index];
  }

  // --- Attendance ---
  public getAttendanceByClassAndDate(
    classId: string,
    date: string,
    teacherId?: string,
    subjectId?: string
  ): IAttendance[] {
    return this.attendance.filter((record) =>
      record.classId === classId &&
      record.date === date &&
      (teacherId === undefined || record.teacherId === teacherId) &&
      (subjectId === undefined || record.subjectId === subjectId)
    );
  }

  public markBatchAttendance(
    classId: string,
    date: string,
    records: { studentId: string; status: 'Present' | 'Absent' | 'Leave'; remarks?: string }[],
    markedBy: string,
    teacherId?: string,
    subjectId?: string
  ): IAttendance[] {
    const updatedOrCreated: IAttendance[] = [];

    for (const rec of records) {
      const student = this.findStudentById(rec.studentId);
      const existingIdx = this.attendance.findIndex(
        (a) =>
          a.studentId === rec.studentId &&
          a.classId === classId &&
          a.date === date &&
          (a.teacherId || undefined) === teacherId &&
          (a.subjectId || undefined) === subjectId
      );

      if (existingIdx >= 0) {
        this.attendance[existingIdx].status = rec.status;
        this.attendance[existingIdx].remarks = rec.remarks || this.attendance[existingIdx].remarks;
        this.attendance[existingIdx].markedBy = markedBy;
        updatedOrCreated.push(this.attendance[existingIdx]);
      } else {
        const newRecord: IAttendance = {
          _id: `att_${teacherId || 'class'}_${subjectId || 'all'}_${rec.studentId}_${date}`,
          studentId: rec.studentId,
          studentName: student ? student.name : 'Unknown',
          rollNo: student ? student.rollNo : '',
          classId,
          ...(teacherId ? { teacherId } : {}),
          ...(subjectId ? { subjectId } : {}),
          date,
          status: rec.status,
          remarks: rec.remarks || '',
          markedBy,
        };
        this.attendance.push(newRecord);
        updatedOrCreated.push(newRecord);
      }
    }
    for (const rec of updatedOrCreated) {
      this.notify('attendance', 'UPDATE', rec._id, rec);
    }
    return updatedOrCreated;
  }

  public getMonthlyAttendanceReport(
    classId: string,
    yearMonth: string,
    teacherId?: string,
    subjectId?: string
  ) {
    // yearMonth = "2026-10"
    const studentsInClass = this.getStudents({ classId });
    const monthRecords = this.attendance.filter(
      (a) =>
        a.classId === classId &&
        a.date.startsWith(yearMonth) &&
        (teacherId === undefined || a.teacherId === teacherId) &&
        (subjectId === undefined || a.subjectId === subjectId)
    );
    const totalClassDays = new Set(monthRecords.map((record) => record.date)).size;
    const cls = this.findClassById(classId);

    const report = studentsInClass.map((student) => {
      const studentRecords = monthRecords.filter((a) => a.studentId === student._id);
      const totalDays = studentRecords.length;
      const presentDays = studentRecords.filter((a) => a.status === 'Present').length;
      const absentDays = studentRecords.filter((a) => a.status === 'Absent').length;
      const leaveDays = studentRecords.filter((a) => a.status === 'Leave').length;
      const totalEverRecords = this.attendance.filter((a) => a.studentId === student._id).length;
      const isNewStudent = totalEverRecords === 0;
      const percentage = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : null;

      return {
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        percentage,
        isNewStudent,
        records: studentRecords,
      };
    });

    return {
      classId,
      yearMonth,
      totalStudents: studentsInClass.length,
      totalClassDays,
      isFinalized: Boolean(cls?.finalizedAttendanceMonths?.includes(yearMonth)),
      report,
    };
  }

  public getClassMonthlyAttendanceReport(classId: string, yearMonth: string) {
    const studentsInClass = this.getStudents({ classId });
    const monthRecords = this.attendance.filter(
      (record) => record.classId === classId && record.date.startsWith(yearMonth)
    );
    const totalClassDays = new Set(monthRecords.map((record) => record.date)).size;
    const report = studentsInClass.map((student) => {
      const studentRecords = monthRecords.filter((record) => record.studentId === student._id);
      const recordsByDate = new Map<string, IAttendance[]>();
      for (const record of studentRecords) {
        const dayRecords = recordsByDate.get(record.date) || [];
        dayRecords.push(record);
        recordsByDate.set(record.date, dayRecords);
      }

      const dailyStatuses = [...recordsByDate.entries()].map(([date, dayRecords]) => ({
        date,
        status: dayRecords.some((record) => record.status === 'Present')
          ? 'Present' as const
          : dayRecords.some((record) => record.status === 'Leave')
            ? 'Leave' as const
            : 'Absent' as const,
      }));
      const presentDays = dailyStatuses.filter((record) => record.status === 'Present').length;
      const absentDays = dailyStatuses.filter((record) => record.status === 'Absent').length;
      const leaveDays = dailyStatuses.filter((record) => record.status === 'Leave').length;
      const totalDays = dailyStatuses.length;
      const totalEverRecords = this.attendance.filter((record) => record.studentId === student._id).length;

      return {
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        percentage: totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : null,
        isNewStudent: totalEverRecords === 0,
        records: dailyStatuses,
      };
    });
    const cls = this.findClassById(classId);

    return {
      classId,
      yearMonth,
      totalStudents: studentsInClass.length,
      totalClassDays,
      isFinalized: Boolean(cls?.finalizedAttendanceMonths?.includes(yearMonth)),
      report,
    };
  }

  public setAttendanceMonthFinalized(classId: string, yearMonth: string, finalized: boolean): IClass | null {
    const cls = this.findClassById(classId);
    if (!cls) return null;
    const months = new Set(cls.finalizedAttendanceMonths || []);
    if (finalized) months.add(yearMonth);
    else months.delete(yearMonth);
    return this.updateClass(classId, { finalizedAttendanceMonths: [...months] });
  }

  public getStudentAttendanceSummary(studentId: string, teacherId?: string) {
    const records = this.attendance.filter((record) =>
      record.studentId === studentId && (teacherId === undefined || record.teacherId === teacherId)
    );
    const totalDays = records.length;
    const presentDays = records.filter((a) => a.status === 'Present').length;
    const absentDays = records.filter((a) => a.status === 'Absent').length;
    const leaveDays = records.filter((a) => a.status === 'Leave').length;
    const hasRecords = totalDays > 0;
    const percentage = hasRecords ? Number(((presentDays / totalDays) * 100).toFixed(1)) : null;

    return {
      studentId,
      totalDays,
      presentDays,
      absentDays,
      leaveDays,
      percentage,
      hasRecords,
      isNewStudent: !hasRecords,
      records: records.slice(0, 30), // recent 30
    };
  }

  // --- Exams & Results ---
  public getExams(): IExam[] {
    return this.exams;
  }

  public findExamById(id: string): IExam | undefined {
    return this.exams.find((e) => e._id === id);
  }

  public createExam(data: Omit<IExam, '_id'>): IExam {
    const newExam: IExam = {
      ...data,
      _id: `exm_${Date.now()}`,
    };
    this.exams.push(newExam);
    this.notify('exams', 'INSERT', newExam._id, newExam);
    return newExam;
  }

  public updateExam(id: string, data: Partial<Omit<IExam, '_id'>>): IExam | null {
    const index = this.exams.findIndex((exam) => exam._id === id);
    if (index < 0) return null;
    this.exams[index] = { ...this.exams[index], ...data };
    this.notify('exams', 'UPDATE', id, this.exams[index]);
    return this.exams[index];
  }

  public deleteExam(id: string): boolean {
    const previousLength = this.exams.length;
    this.exams = this.exams.filter((exam) => exam._id !== id);
    if (this.exams.length === previousLength) return false;
    this.notify('exams', 'DELETE', id, undefined);
    return true;
  }

  public getResults(examId?: string, classId?: string, studentId?: string): IResult[] {
    let list = this.results;
    if (examId) list = list.filter((r) => r.examId === examId);
    if (classId) list = list.filter((r) => r.classId === classId);
    if (studentId) list = list.filter((r) => r.studentId === studentId);
    return list;
  }

  public saveResult(data: {
    examId: string;
    studentId: string;
    classId: string;
    marks: { subjectId: string; subjectName: string; marksObtained: number; maxMarks: number; grade: string; remarks?: string }[];
    teacherRemarks?: string;
    published?: boolean;
    notifyStudents?: boolean;
  }): IResult {
    const exam = this.findExamById(data.examId);
    const student = this.findStudentById(data.studentId);
    const cls = this.findClassById(data.classId);

    const scoredMarks = data.marks.filter((mark) => (mark as any).status !== 'Absent');
    const totalMarksObtained = scoredMarks.reduce((sum, m) => sum + m.marksObtained, 0);
    const totalMaxMarks = scoredMarks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = totalMaxMarks > 0 ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)) : 0;

    let overallGrade = 'F';
    if (percentage >= 90) overallGrade = 'A+';
    else if (percentage >= 80) overallGrade = 'A';
    else if (percentage >= 70) overallGrade = 'B+';
    else if (percentage >= 60) overallGrade = 'B';
    else if (percentage >= 50) overallGrade = 'C';
    else if (percentage >= 40) overallGrade = 'D';

    const existingIdx = this.results.findIndex(
      (r) => r.examId === data.examId && r.studentId === data.studentId
    );

    const resultObj: IResult = {
      _id: existingIdx >= 0 ? this.results[existingIdx]._id : `res_${Date.now()}`,
      examId: data.examId,
      examName: exam?.name || 'Examination',
      studentId: data.studentId,
      studentName: student?.name || '',
      rollNo: student?.rollNo || '',
      classId: data.classId,
      className: cls ? `${cls.name} - ${cls.section}` : '',
      marks: data.marks,
      totalMarksObtained,
      totalMaxMarks,
      percentage,
      grade: overallGrade,
      published: data.published ?? (existingIdx >= 0 ? this.results[existingIdx].published : true),
      teacherRemarks: data.teacherRemarks || '',
   
         locked: existingIdx >= 0 ? this.results[existingIdx].locked || false : false,
    };

    if (existingIdx >= 0) {
      this.results[existingIdx] = resultObj;
    } else {
      this.results.push(resultObj);
    }

    // Recompute positions for this exam & class
    this.recomputePositions(data.examId, data.classId);

    const saved = this.results.find((r) => r._id === resultObj._id)!;

    if (saved.published && data.notifyStudents !== false && student?.userId) {
      this.createNotification({
        userId: student.userId,
        role: 'student',
        type: 'marks_entered',
        title: 'Exam Results Available',
        message: `Marks for ${exam?.name || 'an examination'} have been entered.`,
        link: '/results',
        isRead: false,
        metadata: { studentId: student._id, examId: data.examId },
      });
    }
    if (saved.published && data.notifyStudents !== false && student?.parentId) {
      this.createNotification({
        userId: student.parentId,
        role: 'parent',
        type: 'marks_entered',
        title: 'Exam Results Available',
        message: `Marks for ${exam?.name || 'an examination'} have been entered for ${student.name}.`,
        link: '/results',
        isRead: false,
        metadata: { studentId: student._id, examId: data.examId },
      });
    }
    return saved;
  }

  public finalizeClassResults(examId: string, classId: string): IResult[] {
    const finalized: IResult[] = [];
    for (const result of this.results) {
      if (result.examId !== examId || result.classId !== classId) continue;
      result.published = true;
      finalized.push(result);
      this.notify('results', 'UPDATE', result._id, result);
    }
    this.recomputePositions(examId, classId);
    return finalized;
  }

  public recomputePositions(examId: string, classId: string) {
    const classResults = this.results
      .filter((r) => r.examId === examId && r.classId === classId)
      .sort((a, b) => b.percentage - a.percentage || String(a.rollNo || '').localeCompare(String(b.rollNo || '')));

    const totalStudentsInClass = classResults.length;
    classResults.forEach((res, index) => {
      const previous = classResults[index - 1];
      res.position = previous && previous.percentage === res.percentage
        ? previous.position
        : index + 1;
      res.totalStudentsInClass = totalStudentsInClass;
      this.notify('results', 'UPDATE', res._id, res);
    });
  }

  public unlockClassResults(examId: string, classId: string): number {
    let unlocked = 0;
    this.results.forEach((result) => {
      if (result.examId === examId && result.classId === classId && result.locked) {
        result.locked = false;
        unlocked++;
      }
    });
    return unlocked;
  }

  public auditResult(
    action: string,
    examId: string,
    classId: string,
    actorId: string,
    reason?: string,
    studentId?: string
  ): void {
    this.resultAuditLog.push({
      _id: `audit_${Date.now()}_${this.resultAuditLog.length}`,
      examId,
      classId,
      studentId,
      action,
      actorId,
      reason,
      createdAt: new Date().toISOString(),
    });
    this.notify(
      'resultAuditLogs',
      'INSERT',
      this.resultAuditLog[this.resultAuditLog.length - 1]._id,
      {
        _id: this.resultAuditLog[this.resultAuditLog.length - 1]._id,
        examId,
        classId,
        studentId,
        action,
        performedBy: actorId,
        reason,
        details: reason ? { reason } : {},
        createdAt: this.resultAuditLog[this.resultAuditLog.length - 1].createdAt,
      }
    );
  }

  public unlockClassResultsForEdit(examId: string, classId: string, actorId: string, reason?: string): number {
    let count = 0;
    this.results.forEach((result) => {
      if (result.examId === examId && result.classId === classId) {
        result.locked = false;
        result.portalPublished = false;
        result.status = 'Draft';
        result.publishedAt = undefined;
        result.publishedBy = undefined;
        count++;
      }
    });
    this.auditResult('unlock_approved', examId, classId, actorId, reason);
    this.auditResult('unpublished', examId, classId, actorId, reason);
    return count;
  }

  public rejectClassUnlock(examId: string, classId: string, actorId: string, reason?: string): void {
    this.auditResult('unlock_rejected', examId, classId, actorId, reason);
  }

  public setClassResultsPortalPublished(
    examId: string,
    classId: string,
    published: boolean,
    publishedBy: string
  ): void {
    const publishedAt = new Date().toISOString();
    this.auditResult(published ? 'published' : 'unpublished', examId, classId, publishedBy);
    this.results.forEach((result) => {
      if (result.examId !== examId || result.classId !== classId) return;
      result.portalPublished = published;
      result.publishedBy = published ? publishedBy : undefined;
      result.publishedAt = published ? publishedAt : undefined;
      this.notify('results', 'UPDATE', result._id, {
        ...result,
        portalAction: published ? 'PUBLISH' : 'UNPUBLISH',
      });
    });
  }

  // --- Timetable ---
  public getTimetable(classId?: string, teacherId?: string): ITimetableSlot[] {
    let list = this.timetable;
    if (classId) list = list.filter((t) => t.classId === classId);
    if (teacherId) list = list.filter((t) => t.teacherId === teacherId);
    return list;
  }

  public checkTeacherDoubleBooking(
    teacherId: string,
    day: string,
    period: number,
    excludeSlotId?: string
  ): boolean {
    return this.timetable.some(
      (slot) =>
        slot.teacherId === teacherId &&
        slot.day === day &&
        slot.period === period &&
        slot._id !== excludeSlotId
    );
  }

  public checkClassDoubleBooking(
    classId: string,
    day: string,
    period: number,
    excludeSlotId?: string
  ): boolean {
    return this.timetable.some(
      (slot) =>
        slot.classId === classId &&
        slot.day === day &&
        slot.period === period &&
        slot._id !== excludeSlotId
    );
  }

  public checkTimetableConflicts(data: ITimetableSlot, excludeSlotId?: string): string[] {
    const conflicts: string[] = [];
    const period = data.periodNo ?? data.period;
    const cls = this.findClassById(data.classId);
    const classLabel = cls ? `${cls.name} - Section ${cls.section}` : 'This class';
    const daySlots = this.timetable.filter((slot) =>
      slot.day === data.day &&
      slot._id !== excludeSlotId &&
      (slot.academicYear || data.academicYear) === data.academicYear
    );

    const sameClassPeriod = daySlots.find((slot) =>
      slot.classId === data.classId && (slot.periodNo ?? slot.period) === period
    );
    const overlappingClassSlot = daySlots.find((slot) =>
      slot.classId === data.classId && this.timesOverlap(slot, data)
    );
    if (overlappingClassSlot) {
      const subject = this.findSubjectById(overlappingClassSlot.subjectId)?.name || 'a subject';
      conflicts.push(`${classLabel} already has ${subject} on ${data.day}, ${overlappingClassSlot.startTime}-${overlappingClassSlot.endTime}. Please change the day, period or time.`);
    } else if (sameClassPeriod) {
      const subject = this.findSubjectById(sameClassPeriod.subjectId)?.name || 'a subject';
      conflicts.push(`${classLabel} already has ${subject} on ${data.day}, ${sameClassPeriod.startTime}-${sameClassPeriod.endTime}. Please change the day, period or time.`);
    }
    const bookedTeacherSlot = daySlots.find((slot) =>
      slot.teacherId === data.teacherId && this.timesOverlap(slot, data)
    );
    if (bookedTeacherSlot) {
      const teacher = this.findTeacherById(data.teacherId)?.name || 'The selected teacher';
      const bookedClass = this.findClassById(bookedTeacherSlot.classId);
      const bookedClassLabel = bookedClass ? `${bookedClass.name} - Section ${bookedClass.section}` : 'another class';
      const subject = this.findSubjectById(bookedTeacherSlot.subjectId)?.name || 'a subject';
      conflicts.push(`${teacher} is already teaching ${subject} in ${bookedClassLabel} on ${data.day}, ${bookedTeacherSlot.startTime}-${bookedTeacherSlot.endTime}. Please choose another time or teacher.`);
    }
    const room = data.room || data.roomNo;
    const bookedRoomSlot = room
      ? daySlots.find((slot) => (slot.room || slot.roomNo) === room && this.timesOverlap(slot, data))
      : undefined;
    if (bookedRoomSlot) {
      const bookedClass = this.findClassById(bookedRoomSlot.classId);
      const bookedClassLabel = bookedClass ? `${bookedClass.name} - Section ${bookedClass.section}` : 'another class';
      conflicts.push(`Room ${room} is booked by ${bookedClassLabel} on ${data.day}, ${bookedRoomSlot.startTime}-${bookedRoomSlot.endTime}. Please choose another room or time.`);
    }
    return conflicts;
  }

  private timesOverlap(a: ITimetableSlot, b: ITimetableSlot): boolean {
    const toMinutes = (time: string) => {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
      if (!match) return null;
      return Number(match[1]) * 60 + Number(match[2]);
    };
    const aStart = toMinutes(a.startTime);
    const aEnd = toMinutes(a.endTime);
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    return aStart !== null && aEnd !== null && bStart !== null && bEnd !== null &&
      aStart < bEnd && bStart < aEnd;
  }

  public createTimetableSlot(data: Omit<ITimetableSlot, '_id'>): { slot?: ITimetableSlot; error?: string } {
    const conflict = this.checkTimetableConflicts(data as ITimetableSlot);
    if (conflict.length) return { error: conflict.join(' ') };

    const subj = this.findSubjectById(data.subjectId);
    const teacher = this.findTeacherById(data.teacherId);

    const newSlot: ITimetableSlot = {
      ...data,
      _id: `tt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      periodNo: data.periodNo ?? data.period,
      period: data.period ?? data.periodNo ?? 1,
      room: data.room ?? data.roomNo ?? '',
      subjectName: subj?.name || '',
      teacherName: teacher?.name || '',
    };
    this.timetable.push(newSlot);
    this.notify('timetable', 'INSERT', newSlot._id, newSlot);
    return { slot: newSlot };
  }

  public updateTimetableSlot(
    id: string,
    data: Omit<ITimetableSlot, '_id'>
  ): { slot?: ITimetableSlot; error?: string } {
    const index = this.timetable.findIndex((slot) => slot._id === id);
    if (index < 0) return { error: 'Timetable slot not found.' };
    const conflict = this.checkTimetableConflicts({ ...data, _id: id }, id);
    if (conflict.length) return { error: conflict.join(' ') };

    const subject = this.findSubjectById(data.subjectId);
    const teacher = this.findTeacherById(data.teacherId);
    const updatedSlot: ITimetableSlot = {
      ...data,
      _id: id,
      periodNo: data.periodNo ?? data.period,
      period: data.period ?? data.periodNo ?? 1,
      room: data.room ?? data.roomNo ?? '',
      subjectName: subject?.name || '',
      teacherName: teacher?.name || '',
    };
    this.timetable[index] = updatedSlot;
    this.notify('timetable', 'UPDATE', id, updatedSlot);
    return { slot: updatedSlot };
  }

  public deleteTimetableSlot(id: string): boolean {
    const prev = this.timetable.length;
    this.timetable = this.timetable.filter((t) => t._id !== id);
    if (this.timetable.length < prev) {
      this.notify('timetable', 'DELETE', id);
      return true;
    }
    return false;
  }

  public syncTimetableTeacher(subjectId: string, classId: string, teacherId: string): void {
    for (const slot of this.timetable.filter((item) =>
      item.subjectId === subjectId && item.classId === classId
    )) {
      const nextTeacherId = teacherId && this.findTeacherById(teacherId) ? teacherId : '';
      if (!nextTeacherId) {
        slot.teacherId = '';
        slot.teacherName = 'Teacher unassigned';
        this.notify('timetable', 'UPDATE', slot._id, slot);
        continue;
      }
      const conflicts = this.checkTimetableConflicts({ ...slot, teacherId: nextTeacherId }, slot._id);
      if (!conflicts.some((message) => message.includes('already teaching') || message.includes('Room ') || message.includes('already has'))) {
        slot.teacherId = nextTeacherId;
        slot.teacherName = this.findTeacherById(nextTeacherId)?.name || '';
        this.notify('timetable', 'UPDATE', slot._id, slot);
      } else {
        slot.teacherId = '';
        slot.teacherName = 'Teacher unassigned';
        this.notify('timetable', 'UPDATE', slot._id, slot);
      }
    }
  }

  // --- Fee Management ---
  public getFeeStructures(): IFeeStructure[] {
    return this.feeStructures;
  }

  public getFeeStructureByClass(classId: string): IFeeStructure | undefined {
    return this.feeStructures.find((f) => f.classId === classId);
  }

  public saveFeeStructure(data: Omit<IFeeStructure, '_id'>): IFeeStructure {
    const cls = this.findClassById(data.classId);
    const totalAmount =
      data.tuitionFee +
      (data.transportFee || 0) +
      (data.labFee || 0) +
      (data.libraryFee || 0) +
      (data.examFee || 0) +
      (data.otherCharges || 0);

    const existingIdx = this.feeStructures.findIndex((f) => f.classId === data.classId);
    const obj: IFeeStructure = {
      ...data,
      _id: existingIdx >= 0 ? this.feeStructures[existingIdx]._id : `fee_str_${Date.now()}`,
      className: cls ? `${cls.name} - ${cls.section}` : '',
      totalAmount,
    };

    if (existingIdx >= 0) {
      this.feeStructures[existingIdx] = obj;
    } else {
      this.feeStructures.push(obj);
    }
    this.notify('feestructures', 'UPDATE', obj._id, obj);
    return obj;
  }

  public getFeePayments(filter?: { classId?: string; studentId?: string; status?: string }): IFeePayment[] {
    let list = this.feePayments;
    if (filter?.classId) list = list.filter((p) => p.classId === filter.classId);
    if (filter?.studentId) list = list.filter((p) => p.studentId === filter.studentId);
    if (filter?.status) list = list.filter((p) => p.status === filter.status);
    return list;
  }

  public getFeeDefaulters(): IFeePayment[] {
    return this.feePayments.filter((p) => p.status === 'Unpaid' || p.status === 'Partial');
  }

  public recordFeePayment(
    voucherNo: string,
    paidAmount: number,
    paymentMethod: 'Cash' | 'Bank Transfer' | 'Online Card' | 'Cheque',
    transactionRef?: string,
    remarks?: string
  ): IFeePayment | null {
    const payment = this.feePayments.find((p) => p.voucherNo === voucherNo);
    if (!payment) return null;

    const newAmountPaid = (payment.amountPaid || 0) + paidAmount;
    const newBalance = Math.max(0, payment.totalDue - newAmountPaid);

    payment.amountPaid = newAmountPaid;
    payment.balance = newBalance;
    payment.status = newBalance === 0 ? 'Paid' : newAmountPaid > 0 ? 'Partial' : 'Unpaid';
    payment.paymentDate = new Date().toISOString().split('T')[0];
    payment.paymentMethod = paymentMethod;
    if (transactionRef) payment.transactionRef = transactionRef;
    if (remarks) payment.remarks = remarks;

    if (payment.status === 'Paid') {
      // Stop reminders automatically once voucher is paid
      for (const n of this.notifications) {
        if (n.metadata?.voucherNo === voucherNo) {
          n.isRead = true;
        }
      }
    }

    this.notify('feepayments', 'UPDATE', payment._id, payment);
    return payment;
  }

  public generateFeeVouchersForMonth(
    classId: string | undefined,
    month: string,
    dueDate: string
  ): IFeePayment[] {
    const targetMonth = month;
    const targetDueDate = dueDate;

    let students = this.getStudents();
    if (classId && classId !== 'all') {
      students = students.filter((s) => s.classId === classId);
    }

    const studentsWithoutFees = students.filter((student) =>
      !this.feePayments.some((payment) => payment.studentId === student._id && payment.month === targetMonth) &&
      !this.getFeeStructureByClass(student.classId)
    );
    if (studentsWithoutFees.length > 0) {
      throw new Error('Configure a fee structure for every selected class before publishing vouchers.');
    }

    const newVouchers: IFeePayment[] = [];

    for (const stu of students) {
      // Skip if voucher already exists for this student and month
      const existing = this.feePayments.find(
        (p) => p.studentId === stu._id && p.month === targetMonth
      );
      if (existing) continue;

      const feeStructure = this.getFeeStructureByClass(stu.classId);
      const currentFee = feeStructure!.totalAmount;

      // Calculate unpaid balance from earlier months as "Previous dues"
      const earlierUnpaid = this.feePayments.filter(
        (p) => p.studentId === stu._id && p.month !== targetMonth && p.status !== 'Paid'
      );
      const previousDues = earlierUnpaid.reduce((sum, p) => sum + (p.balance || 0), 0);
      const totalDue = currentFee + previousDues;

      const voucherNo = `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const payment: IFeePayment = {
        _id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        voucherNo,
        studentId: stu._id,
        studentName: stu.name,
        rollNo: stu.rollNo,
        classId: stu.classId,
        className: stu.className,
        feeStructureId: feeStructure?._id,
        month: targetMonth,
        dueDate: targetDueDate,
        currentFee,
        previousDues,
        totalDue,
        amountPaid: 0,
        balance: totalDue,
        status: 'Unpaid',
      };

      this.feePayments.push(payment);
      newVouchers.push(payment);
      this.notify('feepayments', 'INSERT', payment._id, payment);

      // Notification for Student
      if (stu.userId) {
        this.createNotification({
          userId: stu.userId,
          role: 'student',
          type: 'fee_voucher_published',
          title: 'Fee Voucher Available',
          message: `Your fee voucher for ${targetMonth} is available. Please pay before ${targetDueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo, month: targetMonth, dueDate: targetDueDate },
        });
      }

      // Notification for Parent
      if (stu.parentId) {
        this.createNotification({
          userId: stu.parentId,
          role: 'parent',
          type: 'fee_voucher_published',
          title: 'Fee Voucher Available',
          message: `Your fee voucher for ${targetMonth} is available for ${stu.name}. Please pay before ${targetDueDate}.`,
          link: '/fees',
          isRead: false,
          metadata: { voucherNo, month: targetMonth, dueDate: targetDueDate, studentId: stu._id },
        });
      }
    }

    return newVouchers;
  }

  // --- Notifications ---
  public getNotifications(userId?: string, role?: string): INotification[] {
    let list = this.notifications;
    if (userId) {
      list = list.filter((n) => n.userId === userId || (!n.userId && n.role === role));
    } else if (role) {
      list = list.filter((n) => n.role === role);
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public createNotification(data: Omit<INotification, '_id' | 'createdAt'>): INotification {
    const newNotif: INotification = {
      ...data,
      _id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(newNotif);
    this.notify('notifications', 'INSERT', newNotif._id, newNotif);
    return newNotif;
  }

  public markNotificationRead(id: string, userId?: string): INotification | null {
    const notif = this.notifications.find(
      (n) => n._id === id && (!userId || n.userId === userId)
    );
    if (!notif) return null;
    notif.isRead = true;
    this.notify('notifications', 'UPDATE', notif._id, notif);
    return notif;
  }

  public markAllNotificationsRead(userId: string): number {
    let count = 0;
    for (const notif of this.notifications) {
      if (notif.userId === userId && !notif.isRead) {
        notif.isRead = true;
        count++;
        this.notify('notifications', 'UPDATE', notif._id, notif);
      }
    }
    return count;
  }

  public hasNotificationToday(userId: string, type: string, uniqueKey?: string): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.notifications.some((n) => {
      if (n.userId !== userId || n.type !== type) return false;
      if (!n.createdAt.startsWith(todayStr)) return false;
      if (uniqueKey && n.metadata) {
        const storedKey = n.metadata.reminderKey || n.metadata.voucherNo;
        if (storedKey && storedKey !== uniqueKey) return false;
      }
      return true;
    });
  }

  // --- Statistics for Dashboards ---
  public getAdminStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = this.attendance.filter((a) => a.date === today);
    const totalAttendanceMarked = todayAttendance.length;
    const presentCount = todayAttendance.filter((a) => a.status === 'Present').length;
    const attendancePercentage =
      totalAttendanceMarked > 0 ? Number(((presentCount / totalAttendanceMarked) * 100).toFixed(1)) : null;

    const totalFeesCollected = this.feePayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalFeesPending = this.feePayments.reduce((sum, p) => sum + (p.balance || 0), 0);

    return {
      totalStudents: this.getStudents().length,
      totalTeachers: this.teachers.length,
      totalClasses: this.classes.length,
      totalSubjects: this.subjects.length,
      todayAttendanceRate: attendancePercentage,
      totalFeesCollected,
      totalFeesPending,
      defaultersCount: this.getFeeDefaulters().length,
      recentPayments: this.feePayments.slice(-5).reverse(),
    };
  }
}

export const store = new DataStore();
export default store;
