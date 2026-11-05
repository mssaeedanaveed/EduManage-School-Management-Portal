import mongoose, { Schema } from 'mongoose';

const SubjectMarkSchema = new Schema(
  {
    subjectId: { type: String, ref: 'Subject', required: true },
    subjectName: { type: String, required: true },
    marksObtained: { type: Number, required: true },
    maxMarks: { type: Number, required: true, default: 100 },
    grade: { type: String, required: true, default: 'A' },
    remarks: { type: String, default: '' },
    status: { type: String, enum: ['Present', 'Absent'], default: 'Present' },
  },
  { _id: false }
);

const ResultSchema = new Schema(
  {
    _id: { type: String, required: true },
    examId: { type: String, ref: 'Exam', required: true },
    studentId: { type: String, ref: 'Student', required: true },
    classId: { type: String, ref: 'Class', required: true },
    marks: [SubjectMarkSchema],
    totalMarksObtained: { type: Number, required: true, default: 0 },
    totalMaxMarks: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    grade: { type: String, required: true, default: 'Pass' },
    position: { type: Number },
    published: { type: Boolean, default: true },
    portalPublished: { type: Boolean, default: false },
    teacherRemarks: { type: String, default: '' },
    locked: { type: Boolean, default: false },
    status: { type: String, enum: ['Draft', 'Submitted', 'Locked'], default: 'Draft' },
    publishedAt: { type: Date },
    publishedBy: { type: String, ref: 'User' },
  },
  { timestamps: true }
);

ResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
ResultSchema.index({ examId: 1, classId: 1 });

export const ResultModel =
  mongoose.models.Result || mongoose.model('Result', ResultSchema);
export default ResultModel;
