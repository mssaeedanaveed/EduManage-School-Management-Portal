import mongoose, { Schema } from 'mongoose';

const TeacherSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, ref: 'User', required: true, unique: true },
    name: { type: String, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    employeeId: { type: String, required: true, unique: true, uppercase: true },
    qualification: { type: String, required: true, trim: true },
    qualificationInstitution: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: '' },
    relationshipStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed', 'Other'],
      default: 'Other',
    },
    experienceYears: { type: Number, required: true, min: 0 },
    designation: { type: String, enum: ['Class Teacher', 'Subject Teacher'], default: 'Subject Teacher' },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, default: 'Other' },
    joinedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
    assignedClassIds: [{ type: String, ref: 'Class' }],
    assignedSubjectIds: [{ type: String, ref: 'Subject' }],
  },
  { timestamps: true }
);

export const TeacherModel =
  mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);
export default TeacherModel;
