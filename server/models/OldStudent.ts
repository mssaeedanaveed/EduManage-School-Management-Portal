import mongoose, { Schema } from 'mongoose';

const OldStudentSchema = new Schema(
  {
    _id: { type: String, required: true },
    fullName: { type: String, required: true },
    parentGuardianName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    alternateNumber: { type: String, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    dob: { type: String, required: true },
    address: { type: String, required: true },
    admissionNo: { type: String, required: true, unique: true },
    className: { type: String, required: true },
    dateLeft: { type: String, required: true },
  },
  { timestamps: false, versionKey: false }
);

export const OldStudentModel =
  mongoose.models.OldStudent || mongoose.model('OldStudent', OldStudentSchema);
export default OldStudentModel;
