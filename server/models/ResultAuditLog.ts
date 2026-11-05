import mongoose, { Schema } from 'mongoose';

const ResultAuditLogSchema = new Schema(
  {
    examId: { type: String, ref: 'Exam', required: true },
    classId: { type: String, ref: 'Class' },
    studentId: { type: String, ref: 'Student' },
    action: { type: String, required: true },
    performedBy: { type: String, ref: 'User', required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ResultAuditLogSchema.index({ examId: 1, classId: 1 });
ResultAuditLogSchema.index({ examId: 1, studentId: 1 });

export const ResultAuditLogModel =
  mongoose.models.ResultAuditLog || mongoose.model('ResultAuditLog', ResultAuditLogSchema);
export default ResultAuditLogModel;
