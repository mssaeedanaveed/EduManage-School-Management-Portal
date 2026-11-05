import mongoose, { Schema } from 'mongoose';

const StudentSequenceSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export const StudentSequenceModel =
  mongoose.models.StudentSequence || mongoose.model('StudentSequence', StudentSequenceSchema);
