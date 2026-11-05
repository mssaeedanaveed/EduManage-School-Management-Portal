import mongoose, { Schema } from 'mongoose';

const TimetableSchema = new Schema(
  {
    _id: { type: String, required: true },
    classId: { type: String, ref: 'Class', required: true },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true,
    },
    period: { type: Number },
    periodNo: { type: Number, required: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    subjectId: { type: String, ref: 'Subject', required: true },
    teacherId: { type: String, ref: 'Teacher', required: true },
    roomNo: { type: String, default: '' },
    room: { type: String, default: '' },
    academicYear: { type: String, required: true },
  },
  { timestamps: true }
);

TimetableSchema.index({ classId: 1, day: 1, periodNo: 1 }, { unique: true });
TimetableSchema.index({ teacherId: 1, day: 1 });
TimetableSchema.index({ room: 1, day: 1 });
TimetableSchema.index({ roomNo: 1, day: 1 });

export const TimetableModel =
  mongoose.models.Timetable || mongoose.model('Timetable', TimetableSchema);
export default TimetableModel;
