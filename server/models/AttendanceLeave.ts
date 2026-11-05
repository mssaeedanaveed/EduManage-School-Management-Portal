import mongoose, { Schema } from 'mongoose';

const AttendanceLeaveSchema = new Schema(
  {
    _id: { type: String, required: true },
    studentId: { type: String, ref: 'Student', required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

AttendanceLeaveSchema.index({ studentId: 1, date: 1 });

export const AttendanceLeaveModel =
  mongoose.models.AttendanceLeave || mongoose.model('AttendanceLeave', AttendanceLeaveSchema);
export default AttendanceLeaveModel;
