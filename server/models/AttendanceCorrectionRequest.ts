import mongoose, { Schema } from 'mongoose';

const AttendanceCorrectionRequestSchema = new Schema(
  {
    _id: { type: String, required: true },
    attendanceId: { type: String, ref: 'Attendance', required: true },
    studentId: { type: String, ref: 'Student', required: true },
    oldStatus: { type: String, enum: ['Present', 'Absent', 'Late', 'OnLeave'], required: true },
    newStatus: { type: String, enum: ['Present', 'Absent', 'Late', 'OnLeave'], required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    requestedBy: { type: String, ref: 'Teacher', required: true },
    reviewedBy: { type: String, ref: 'User' },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

AttendanceCorrectionRequestSchema.index({ attendanceId: 1, studentId: 1, status: 1 });

export const AttendanceCorrectionRequestModel =
  mongoose.models.AttendanceCorrectionRequest ||
  mongoose.model('AttendanceCorrectionRequest', AttendanceCorrectionRequestSchema);
export default AttendanceCorrectionRequestModel;
