export type UserRole = 'admin' | 'accountant' | 'teacher' | 'student' | 'parent';

export interface IUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
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
  studentCount?: number;
  subjectCount?: number;
}

export interface ISubject {
  _id: string;
  name: string;
  code: string;
  classId: string;
  classIds?: string[];
  className?: string;
  teacherId?: string;
  teacherName?: string;
  credits?: number;
  academicYear?: string;
  classGroupKey?: string;
  sectionAssignments?: { classId: string; teacherId: string; teacherName?: string; section?: string }[];
  studentCount?: number;
  timetableCount?: number;
  attendanceCount?: number;
  resultCount?: number;
}

export interface ITeacher {
  _id: string;
  userId: string;
  name: string;
  email: string;
  employeeId: string;
  qualification: string;
  qualificationInstitution: string;
  address: string;
  alternatePhone?: string;
  relationshipStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Other';
  experienceYears: number;
  designation: string;
  phone: string;
  gender: string;
  joinedDate: string;
  assignedClassIds: string[];
  assignedSubjectIds: string[];
}

export interface IStudent {
  _id: string;
  userId: string;
  name: string;
  email: string;
  admissionNo: string;
  rollNo: string;
  classId: string;
  className?: string;
  section?: string;
  parentId?: string;
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
  teacherId?: string;
  subjectId?: string;
  date: string;
  status: 'Present' | 'Absent' | 'Leave';
  remarks?: string;
  markedBy?: string;
}

export interface IExam {
  _id: string;
  name: string;
  term: string;
  session: string;
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
  period: number;
  periodNo?: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  roomNo?: string;
  room?: string;
}

export interface IFeeStructure {
  _id: string;
  classId: string;
  className?: string;
  title: string;
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
  voucherNo: string;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  classId: string;
  className?: string;
  feeStructureId?: string;
  month: string;
  dueDate: string;
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
