import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

global.__MONGO_SERVER__ = null;

beforeAll(async () => {
  global.__MONGO_SERVER__ = await MongoMemoryServer.create({ binary: { version: '8.0.16' } });
  await mongoose.connect(global.__MONGO_SERVER__.getUri());

  const storeModule = await import('../../server/data/store.ts');
  const store = storeModule.default?.default || storeModule.default;
  const { UserModel } = await import('../../server/models/User.ts');
  const { ClassModel } = await import('../../server/models/Class.ts');
  const { StudentModel } = await import('../../server/models/Student.ts');

  store.resetToSeed();
  const hash = await bcrypt.hash('password123', 10);
  const users = [
    store.createUser({ name: 'TEST Admin', email: 'test.admin@school.local', passwordHash: hash, role: 'admin' }),
    store.createUser({ name: 'TEST Accountant', email: 'test.accountant@school.local', passwordHash: hash, role: 'accountant' }),
    store.createUser({ name: 'TEST Parent A', email: 'test.parent.a@school.local', passwordHash: hash, role: 'parent' }),
    store.createUser({ name: 'TEST Parent B', email: 'test.parent.b@school.local', passwordHash: hash, role: 'parent' }),
    store.createUser({ name: 'TEST Student A', email: 'test.student.a@school.local', passwordHash: hash, role: 'student' }),
    store.createUser({ name: 'TEST Student B', email: 'test.student.b@school.local', passwordHash: hash, role: 'student' }),
    store.createUser({ name: 'TEST Student C', email: 'test.student.c@school.local', passwordHash: hash, role: 'student' }),
  ];
  global.__TEST_USERS__ = Object.fromEntries(users.map((user) => [user.email, user]));

  await UserModel.insertMany(users.map((user) => ({ ...user, _id: user._id })));

  const classRecords = [
    { _id: 'TEST_CLASS_A', className: 'TEST Grade A', section: 'A', roomNo: 'TEST-A', maxCapacity: 40, academicYear: '2026-2027', classTeacher: '', subjects: [] },
    { _id: 'TEST_CLASS_B', className: 'TEST Grade B', section: 'B', roomNo: 'TEST-B', maxCapacity: 40, academicYear: '2026-2027', classTeacher: '', subjects: [] },
    { _id: 'TEST_CLASS_C', className: 'TEST Grade C', section: 'C', roomNo: 'TEST-C', maxCapacity: 40, academicYear: '2026-2027', classTeacher: '', subjects: [] },
  ];
  await ClassModel.insertMany(classRecords);

  const students = [
    {
      _id: 'TEST_STUDENT_A', userId: global.__TEST_USERS__['test.student.a@school.local']. _id,
      name: 'TEST Student A', email: 'test.student.a@school.local', admissionNo: 'TEST-SA',
      rollNo: 'TEST-A-1', classId: 'TEST_CLASS_A', className: 'TEST Grade A - A', parentId: global.__TEST_USERS__['test.parent.a@school.local']._id,
      status: 'Active',
    },
    {
      _id: 'TEST_STUDENT_B', userId: global.__TEST_USERS__['test.student.b@school.local']. _id,
      name: 'TEST Student B', email: 'test.student.b@school.local', admissionNo: 'TEST-SB',
      rollNo: 'TEST-B-1', classId: 'TEST_CLASS_B', className: 'TEST Grade B - B', parentId: global.__TEST_USERS__['test.parent.a@school.local']._id,
      status: 'Active',
    },
    {
      _id: 'TEST_STUDENT_C', userId: global.__TEST_USERS__['test.student.c@school.local']. _id,
      name: 'TEST Student C', email: 'test.student.c@school.local', admissionNo: 'TEST-SC',
      rollNo: 'TEST-C-1', classId: 'TEST_CLASS_C', className: 'TEST Grade C - C', parentId: global.__TEST_USERS__['test.parent.b@school.local']._id,
      status: 'Active',
    },
  ];
  await StudentModel.insertMany(students);
  global.__TEST_STUDENT_IDS__ = Object.fromEntries(students.map((student) => [student.name, student._id]));
  store.students.push(...students.map((student) => ({
    ...student,
    section: student.classId.slice(-1),
    parentName: 'TEST Parent',
    gender: 'Other',
    dateOfBirth: '2014-01-01',
    address: 'TEST',
    phone: '0000000000',
    guardianName: 'TEST Parent',
  })));
});

afterAll(async () => {
  await mongoose.disconnect();
  await global.__MONGO_SERVER__?.stop();
});
