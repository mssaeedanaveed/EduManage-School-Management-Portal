import bcrypt from 'bcryptjs';

beforeAll(async () => {
  const storeModule = await import('../../server/data/store.ts');
  const store = storeModule.default?.default || storeModule.default;
  const { UserModel } = await import('../../server/models/User.ts');
  const { ClassModel } = await import('../../server/models/Class.ts');
  const { TeacherModel } = await import('../../server/models/Teacher.ts');
  const { StudentModel } = await import('../../server/models/Student.ts');

  store.resetToSeed();
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [
    { _id: 'att_admin', name: 'Attendance Admin', email: 'attendance.admin@test.local', passwordHash, role: 'admin', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_teacher_1_user', name: 'Class Teacher One', email: 'attendance.teacher1@test.local', passwordHash, role: 'teacher', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_teacher_2_user', name: 'Subject Teacher Two', email: 'attendance.teacher2@test.local', passwordHash, role: 'teacher', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_parent_user', name: 'Attendance Parent', email: 'attendance.parent@test.local', passwordHash, role: 'parent', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_student_1_user', name: 'Student One', email: 'attendance.student1@test.local', passwordHash, role: 'student', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_student_2_user', name: 'Student Two', email: 'attendance.student2@test.local', passwordHash, role: 'student', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_student_3_user', name: 'Student Three', email: 'attendance.student3@test.local', passwordHash, role: 'student', phone: '', createdAt: new Date().toISOString() },
    { _id: 'att_student_4_user', name: 'Student Four', email: 'attendance.student4@test.local', passwordHash, role: 'student', phone: '', createdAt: new Date().toISOString() },
  ];
  users.forEach((user) => store.users.push(user));
  await UserModel.insertMany(users);

  const classes = [
    { _id: 'att_class_a', className: 'Attendance Grade 1', section: 'A', roomNo: 'ATT-A', maxCapacity: 40, academicYear: '2026-2027', classTeacherId: '', subjects: [] },
    { _id: 'att_class_b', className: 'Attendance Grade 2', section: 'B', roomNo: 'ATT-B', maxCapacity: 40, academicYear: '2026-2027', classTeacherId: '', subjects: [] },
  ];
  store.classes.push(...classes.map((item) => ({
    ...item,
    name: item.className,
    capacity: item.maxCapacity,
    classTeacherId: '',
  })));
  await ClassModel.insertMany(classes);

  const teachers = [
    { _id: 'att_teacher_1', userId: 'att_teacher_1_user', name: 'Class Teacher One', email: 'attendance.teacher1@test.local', employeeId: 'ATT-T1', qualification: 'BEd', qualificationInstitution: 'Test University', address: 'Test', experienceYears: 5, designation: 'Class Teacher', phone: '1', assignedClassIds: [], assignedSubjectIds: [] },
    { _id: 'att_teacher_2', userId: 'att_teacher_2_user', name: 'Subject Teacher Two', email: 'attendance.teacher2@test.local', employeeId: 'ATT-T2', qualification: 'BEd', qualificationInstitution: 'Test University', address: 'Test', experienceYears: 5, designation: 'Subject Teacher', phone: '2', assignedClassIds: [], assignedSubjectIds: [] },
  ];
  store.teachers.push(...teachers);
  await TeacherModel.insertMany(teachers);

  const students = [
    { _id: 'att_student_1', userId: 'att_student_1_user', name: 'Student One', email: 'attendance.student1@test.local', admissionNo: 'ATT-S1', rollNo: '1', classId: 'att_class_a', className: 'Attendance Grade 1', section: 'A', parentId: 'att_parent_user', parentName: 'Attendance Parent', status: 'Active', archivedAt: '' },
    { _id: 'att_student_2', userId: 'att_student_2_user', name: 'Student Two', email: 'attendance.student2@test.local', admissionNo: 'ATT-S2', rollNo: '2', classId: 'att_class_a', className: 'Attendance Grade 1', section: 'A', parentId: 'att_parent_user', parentName: 'Attendance Parent', status: 'Active', archivedAt: '' },
    { _id: 'att_student_3', userId: 'att_student_3_user', name: 'Student Three', email: 'attendance.student3@test.local', admissionNo: 'ATT-S3', rollNo: '3', classId: 'att_class_a', className: 'Attendance Grade 1', section: 'A', parentId: 'att_parent_user', parentName: 'Attendance Parent', status: 'Active', archivedAt: '' },
    { _id: 'att_student_4', userId: 'att_student_4_user', name: 'Student Four', email: 'attendance.student4@test.local', admissionNo: 'ATT-S4', rollNo: '4', classId: 'att_class_a', className: 'Attendance Grade 1', section: 'A', parentId: 'att_parent_user', parentName: 'Attendance Parent', status: 'Active', archivedAt: '' },
    { _id: 'att_student_withdrawn', userId: 'att_student_withdrawn_user', name: 'Withdrawn Student', email: 'attendance.withdrawn@test.local', admissionNo: 'ATT-SW', rollNo: '5', classId: 'att_class_a', className: 'Attendance Grade 1', section: 'A', parentId: 'att_parent_user', parentName: 'Attendance Parent', status: 'Withdrawn', archivedAt: '' },
  ];
  store.students.push(...students);
  await StudentModel.insertMany(students);
  global.__ATTENDANCE_READY__ = true;
});
