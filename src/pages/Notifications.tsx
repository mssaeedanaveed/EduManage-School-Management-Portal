import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  CalendarCheck,
  ExternalLink,
  RotateCcw,
  Plus,
} from 'lucide-react';
import api from '../api/axios.js';
import { INotification } from '../types/index.js';
import Modal from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/api/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
      setLoadError('Could not load notifications. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnnouncement(true);
    try {
      await api.post('/api/notifications', announcement);
      setAnnouncement({ title: '', message: '' });
      setIsAnnouncementOpen(false);
      await fetchNotifications();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post teacher announcement');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.patch(`/api/notifications/${id}/read`);
      if (res.data?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.patch('/api/notifications/read-all');
      if (res.data?.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleNotificationClick = (item: INotification) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'fee_overdue':
        return <AlertCircle className="w-5 h-5 text-rose-600" />;
      case 'fee_due_3days':
      case 'fee_due_1day':
      case 'fee_due_today':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'fee_voucher_published':
      case 'fee_monthly_alert':
        return <FileText className="w-5 h-5 text-indigo-600" />;
      case 'attendance_marked':
        return <CalendarCheck className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notifications & Alerts
          </h1>
          <p className="text-xs text-slate-500">
            System notices, fee voucher alerts, overdue reminders, and academic updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh notifications"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAnnouncementOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post Teacher Notice</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>

        <Modal
          isOpen={isAnnouncementOpen}
          onClose={() => setIsAnnouncementOpen(false)}
          title="Post Teacher Announcement"
          subtitle="This notice will appear in every teacher's portal."
          maxWidth="md"
        >
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Title *</label>
              <input
                required
                value={announcement.title}
                onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Message *</label>
              <textarea
                required
                rows={5}
                value={announcement.message}
                onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setIsAnnouncementOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">
                Cancel
              </button>
              <button type="submit" disabled={savingAnnouncement} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60">
                {savingAnnouncement ? 'Posting...' : 'Post to Teachers'}
              </button>
            </div>
          </form>
        </Modal>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {loadError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Notices ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Unread Only</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <span className="text-xs text-slate-400">
          Showing {filtered.length} notification{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No notifications found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filter === 'unread'
                ? 'You are all caught up! No unread notifications right now.'
                : 'No announcements or fee voucher notifications yet.'}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item._id}
              onClick={() => handleNotificationClick(item)}
              className={`p-4 sm:p-5 flex items-start gap-3.5 transition-colors cursor-pointer hover:bg-slate-50/80 ${
                !item.isRead ? 'bg-indigo-50/40' : 'bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                {getTypeIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                    {item.title}
                  </h4>
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                  <span className="font-mono">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {item.link && (
                    <span className="text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {!item.isRead ? (
                  <button
                    onClick={(e) => handleMarkAsRead(item._id, e)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-300 font-medium px-2 py-0.5">
                    Read
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
