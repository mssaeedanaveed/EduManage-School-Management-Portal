import mongoose, { Schema } from 'mongoose';

const ClassSchema = new Schema(
  {
    _id: { type: String, required: true },
    className: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    roomNo: { type: String, required: true, trim: true },
    maxCapacity: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true, match: /^\d{4}-\d{4}$/ },
    classTeacher: { type: String, ref: 'Teacher' },
    classTeacherId: { type: String, ref: 'Teacher' },
    subjects: { type: [{ type: String, ref: 'Subject' }], default: undefined },
    finalizedAttendanceMonths: [{ type: String }],
  },
  { timestamps: true }
);

ClassSchema.index(
  { className: 1, section: 1, academicYear: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: {
      className: { $type: 'string' },
      section: { $type: 'string' },
      academicYear: { $type: 'string' },
    },
  }
);

export const ClassModel =
  mongoose.models.Class || mongoose.model('Class', ClassSchema);
export default ClassModel;
