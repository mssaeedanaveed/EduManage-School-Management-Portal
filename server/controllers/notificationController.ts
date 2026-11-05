import { Response } from 'express';
import store from '../data/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { NotificationModel } from '../models/index.js';

export function createTeacherAnnouncement(req: AuthenticatedRequest, res: Response): void {
  const { title, message, link } = req.body as { title?: string; message?: string; link?: string };
  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ success: false, message: 'Title and message are required.' });
    return;
  }
  const teachers = store.getUsers().filter((user) => user.role === 'teacher');
  if (teachers.length === 0) {
    res.status(409).json({ success: false, message: 'There are no teacher accounts to notify.' });
    return;
  }
  const announcements = teachers.map((teacher) => store.createNotification({
    userId: teacher._id,
    role: 'teacher',
    type: 'principal_announcement',
    title: title.trim(),
    message: message.trim(),
    link: link?.trim() || undefined,
    isRead: false,
  }));
  res.status(201).json({
    success: true,
    message: 'Announcement posted to all teacher portals.',
    total: announcements.length,
    data: announcements,
  });
}

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const notifications = (await NotificationModel.find({
    $or: [{ userId: req.user._id }, { role: req.user.role }],
  }).sort({ createdAt: -1 }).lean()) as any[];
  const normalized = notifications.map((notification) => ({
    ...notification,
    isRead: notification.isRead ?? notification.read ?? false,
  }));
  const unreadCount = normalized.filter((n) => !n.isRead).length;

  res.status(200).json({
    success: true,
    total: normalized.length,
    unreadCount,
    data: normalized,
  });
}

export async function markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const { id } = req.params;
  const updated = await NotificationModel.findOneAndUpdate(
    { _id: id, $or: [{ userId: req.user._id }, { role: req.user.role }] },
    { isRead: true, read: true },
    { new: true },
  ).lean();

  if (!updated) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: updated,
  });
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const result = await NotificationModel.updateMany(
    { $or: [{ userId: req.user._id }, { role: req.user.role }] },
    { $set: { isRead: true, read: true } },
  );
  const updatedCount = result.modifiedCount;

  res.status(200).json({
    success: true,
    message: `Marked ${updatedCount} notifications as read`,
    updatedCount: result.modifiedCount,
  });
}
