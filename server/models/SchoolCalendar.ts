import mongoose, { Schema } from 'mongoose';

const SchoolCalendarSchema = new Schema(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true, unique: true },
    type: { type: String, enum: ['Working', 'Holiday'], required: true },
    name: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SchoolCalendarModel =
  mongoose.models.SchoolCalendar || mongoose.model('SchoolCalendar', SchoolCalendarSchema);
export default SchoolCalendarModel;
