import mongoose, { Schema, Document } from 'mongoose';
import { IExam } from '../types.js';

export interface IExamDocument extends Omit<IExam, '_id'>, Document {}

const ExamSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    term: { type: String, required: true },
    session: { type: String, default: '2025-2026' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Ongoing' },
    classId: { type: String, ref: 'Class' },
    subjectId: { type: String, ref: 'Subject' },
    totalMarks: { type: Number, min: 1 },
    isFinal: { type: Boolean, default: false },
    passPercentage: { type: Number, min: 1, max: 100, default: 40 },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: String, ref: 'User' },
  },
  { timestamps: true }
);

ExamSchema.index({ _id: 1, classId: 1 });

export const ExamModel = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
export default ExamModel;
