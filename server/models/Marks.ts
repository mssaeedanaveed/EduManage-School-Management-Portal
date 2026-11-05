import mongoose, { Schema } from 'mongoose';

const MarksSchema = new Schema(
  {
    examId: { type: String, ref: 'Exam', required: true },
    studentId: { type: String, ref: 'Student', required: true },
    classId: { type: String, ref: 'Class', required: true },
    subjectId: { type: String, ref: 'Subject', required: true },
    obtained: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    isAbsent: { type: Boolean, default: false },
    enteredBy: { type: String, ref: 'User', required: true },
  },
  { timestamps: true }
);

MarksSchema.index({ examId: 1, classId: 1 });
MarksSchema.index({ examId: 1, studentId: 1 });

export const MarksModel = mongoose.models.Marks || mongoose.model('Marks', MarksSchema);
export default MarksModel;
