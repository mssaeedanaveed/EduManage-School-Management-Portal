import mongoose, { Schema } from 'mongoose';

const SubjectSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, alias: 'courseCode' },
    classId: { type: String, ref: 'Class', required: true },
    classIds: { type: [{ type: String, ref: 'Class' }], default: undefined },
    className: { type: String, trim: true },
    academicYear: { type: String, trim: true },
    classGroupKey: { type: String, trim: true },
    sectionAssignments: [{
      _id: false,
      classId: { type: String, ref: 'Class', required: true },
      teacherId: { type: String, ref: 'Teacher', alias: 'assignedTeacher', default: '' },
    }],
    teacherId: { type: String, ref: 'Teacher', alias: 'assignedTeacher' },
    credits: { type: Number, required: true, min: Number.MIN_VALUE },
  },
  { timestamps: true }
);

SubjectSchema.index(
  { code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
SubjectSchema.index(
  { name: 1, classGroupKey: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { classGroupKey: { $type: 'string' } },
  }
);

export const SubjectModel =
  mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
export default SubjectModel;
