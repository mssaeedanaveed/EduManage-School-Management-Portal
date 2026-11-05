import mongoose, { Schema } from 'mongoose';

const AttendanceSchema = new Schema(
  {
    _id: { type: String, required: true },
    classId: { type: String, ref: 'Class', required: true },
    section: { type: String, default: '' },
    date: { type: String, required: true },
    takenBy: { type: String, ref: 'Teacher' },
    records: [{
      studentId: { type: String, ref: 'Student' },
      status: { type: String, enum: ['Present', 'Absent', 'Late', 'OnLeave'], required: true },
      remarks: { type: String, default: '' },
    }],
    submittedAt: { type: Date },
    editedAt: { type: Date },
    // Legacy subject-wise records are retained for backward compatibility.
    studentId: { type: String, ref: 'Student' },
    studentName: { type: String, default: '' },
    rollNo: { type: String, default: '' },
    teacherId: { type: String, ref: 'Teacher' },
    subjectId: { type: String, ref: 'Subject' },
    status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Late', 'OnLeave'], required: false },
    remarks: { type: String, default: '' },
    markedBy: { type: String, ref: 'User' },
  },
  { timestamps: true }
);

AttendanceSchema.index(
  { teacherId: 1, classId: 1, subjectId: 1, studentId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      teacherId: { $type: 'string' },
      subjectId: { $type: 'string' },
    },
  }
);
AttendanceSchema.index({ studentId: 1, date: 1 });
AttendanceSchema.index({ classId: 1, date: 1 });
AttendanceSchema.index(
  { classId: 1, section: 1, date: 1 },
  { unique: true, partialFilterExpression: { records: { $exists: true, $type: 'array' } } }
);

export const AttendanceModel =
  mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export default AttendanceModel;
