import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../types.js';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {}

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'accountant', 'teacher', 'student', 'parent'],
      default: 'student',
    },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export default UserModel;
