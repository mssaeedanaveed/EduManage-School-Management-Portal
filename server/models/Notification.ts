import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, ref: 'User', required: true },
    role: { type: String },
    type: { type: String, required: true },
    voucherId: { type: String, default: '' },
    read: { type: Boolean, default: false },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const NotificationModel =
  mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export default NotificationModel;
