export type UserRole = 'admin' | 'accountant' | 'teacher' | 'student' | 'parent';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  createdAt: string;
}

export interface IClass {
  _id: string;
  name: string;
  section: string;
  roomNo: string;
  capacity: number;
  classTeacherId?: string;
  classTeacherName?: string;
  academicYear: string;
  subjects?: string[];
  finalizedAttendanceMonths?: string[];
}

export interface ISubject {
  _id: string;
  name: string;
  code: string;
  classId: string;
  classIds?: string[];
  className?: string;
  academicYear?: string;
  classGroupKey?: string;
  teacherId?: string;
  teacherName?: string;
  credits?: number;
  sectionAssignments?: { classId: string; teacherId: string }[];
  studentCount?: number;
  timetableCount?: number;
  attendanceCount?: number;
  resultCount?: number;
}

export interface ITeacher {
  _id: string;
  userId: string;     // User _id
  name: string;
  email: string;
  employeeId: string; // e.g., "TCH-1001"
  qualification: string;
  qualificationInstitution: string;
  address: string;
  alternatePhone?: string;
  relationshipStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Other';
  experienceYears: number;
  designation: string; // e.g., "Senior Science Lecturer"
  phone: string;
  gender: string;
  joinedDate: string;
  assignedClassIds: string[];
  assignedSubjectIds: string[];
}

export interface IStudent {
  _id: string;
  userId: string;     // User _id
  name: string;
  email: string;
  admissionNo: string;// e.g., "ADM-2024-001"
  rollNo: string;     // e.g., "10-01"
  classId: string;    // Class _id
  className?: string;
  section?: string;
  parentId?: string;  // Parent User _id
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  alternateContact?: string;
  archivedAt?: string;
}

export interface IAttendance {
  _id: string;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  classId: string;
  teacherId?: string;  // Teacher _id for subject-scoped attendance
  subjectId?: string;  // Subject _id; optional on legacy class-wide records
  date: string;       // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Leave' | 'Late' | 'OnLeave';
  remarks?: string;
  markedBy: string;   // Teacher / Admin user ID
}

export interface IExam {
  _id: string;
  name: string;       // e.g. "Midterm Examination 2026"
  term: string;       // "Term 1", "Term 2", "Final"
  session: string;    // "2025-2026"
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  classId?: string;
  subjectId?: string;
  totalMarks?: number;
  isFinal?: boolean;
  passPercentage?: number;
  published?: boolean;
}

export interface ISubjectMark {
  subjectId: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  grade: string;
  remarks?: string;
  status?: 'Present' | 'Absent';
}

export interface IResult {
  _id: string;
  examId: string;
  examName?: string;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  classId: string;
  className?: string;
  marks: ISubjectMark[];
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  grade: string;
  position?: number;
  totalStudentsInClass?: number;
  published: boolean;
  portalPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;
  status?: 'Draft' | 'Submitted' | 'Locked';
  teacherRemarks?: string;
  locked?: boolean;
}

export interface ITimetableSlot {
  _id: string;
  classId: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  period: number;     // 1 to 8
  periodNo?: number;
  startTime: string;  // e.g. "08:30"
  endTime: string;    // e.g. "09:15"
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  roomNo?: string;
  room?: string;
  academicYear?: string;
}

export interface IFeeStructure {
  _id: string;
  classId: string;
  className?: string;
  title: string;       // "Standard Academic Fee 2026"
  academicYear: string;
  tuitionFee: number;
  transportFee: number;
  labFee: number;
  libraryFee: number;
  examFee: number;
  otherCharges: number;
  totalAmount: number;
}

export interface IFeePayment {
  _id: string;
  voucherNo: string;   // e.g. "VCH-2026-081"
  studentId: string;
  studentName?: string;
  rollNo?: string;
  classId: string;
  className?: string;
  feeStructureId?: string;
  month: string;       // e.g. "October 2026"
  dueDate: string;     // YYYY-MM-DD
  totalDue: number;
  currentFee?: number;
  previousDues?: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Overdue';
  paymentDate?: string;
  paymentMethod?: 'Cash' | 'Bank Transfer' | 'Online Card' | 'Cheque';
  transactionRef?: string;
  remarks?: string;
}

export interface INotification {
  _id: string;
  userId: string;
  role?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}
