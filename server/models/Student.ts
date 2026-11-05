import mongoose, { Schema } from 'mongoose';

const StudentSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    admissionNo: { type: String, required: true, unique: true, uppercase: true },
    rollNo: { type: String, required: true },
    classId: { type: String, ref: 'Class', required: true },
    className: { type: String, default: '' },
    section: { type: String, default: '' },
    parentId: { type: String, ref: 'User' },
    parentName: { type: String, default: '' },
    parentEmail: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
    dob: { type: String, default: '2010-01-01' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    bloodGroup: { type: String, default: 'O+' },
    emergencyContact: { type: String, default: '' },
    alternateContact: { type: String, default: '' },
    archivedAt: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive', 'Withdrawn'], default: 'Active' },
  },
  { timestamps: true }
);

StudentSchema.index({ classId: 1, rollNo: 1 }, { unique: true });

export const StudentModel =
  mongoose.models.Student || mongoose.model('Student', StudentSchema);
export default StudentModel;
