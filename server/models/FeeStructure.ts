import mongoose, { Schema } from 'mongoose';

const FeeStructureSchema = new Schema(
  {
    _id: { type: String, required: true },
    classId: { type: String, ref: 'Class', required: true, unique: true },
    className: { type: String, default: '' },
    title: { type: String, required: true },
    academicYear: { type: String, default: '2025-2026' },
    tuitionFee: { type: Number, required: true, default: 0 },
    transportFee: { type: Number, default: 0 },
    labFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const FeeStructureModel =
  mongoose.models.FeeStructure || mongoose.model('FeeStructure', FeeStructureSchema);
export default FeeStructureModel;
