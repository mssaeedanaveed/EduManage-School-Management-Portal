import mongoose, { Schema } from 'mongoose';

const UnlockRequestSchema = new Schema(
  {
    examId: { type: String, ref: 'Exam', required: true },
    classId: { type: String, ref: 'Class', required: true },
    requestedBy: { type: String, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    decidedBy: { type: String, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

UnlockRequestSchema.index({ examId: 1, classId: 1 });

export const UnlockRequestModel =
  mongoose.models.UnlockRequest || mongoose.model('UnlockRequest', UnlockRequestSchema);
export default UnlockRequestModel;
