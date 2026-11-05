import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  LogOut,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Users2,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  ChevronRight,
  Clock,
  AlertCircle,
  LockKeyhole,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import api from '../api/axios.js';
import { INotification } from '../types/index.js';
import Modal from './Modal.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, title = 'Overview' }) => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      // Quiet fail on network
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.patch(`/api/notifications/${id}/read`);
      if (res.data?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.patch('/api/notifications/read-all');
      if (res.data?.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleItemClick = (item: INotification) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
    setShowDropdown(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Reset all demo school data back to factory state?')) {
      try {
        await api.post('/api/auth/reset-demo');
        window.location.reload();
      } catch (e) {
        console.error('Reset failed', e);
      }
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.alert('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await api.post('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      window.alert(response.data?.message || 'Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordModal(false);
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const getRoleBadge = () => {
    if (user?.role === 'admin') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
          <ShieldCheck className="w-3 h-3" />
          <span>Principal Admin</span>
        </span>
      );
    }
    if (user?.role === 'accountant') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3 h-3" />
          <span>Accountant</span>
        </span>
      );
    }
    if (user?.role === 'teacher') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
          <UserCheck className="w-3 h-3" />
          <span>Teacher ({profile?.teacher?.employeeId || 'Faculty'})</span>
        </span>
      );
    }
    if (user?.role === 'student') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
          <GraduationCap className="w-3 h-3" />
          <span>Student ({profile?.student?.rollNo || 'Roll'})</span>
        </span>
      );
    }
    if (user?.role === 'parent') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Users2 className="w-3 h-3" />
          <span>Parent Portal</span>
        </span>
      );
    }
    return null;
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
          <p className="text-[11px] text-slate-400 hidden sm:block">Academic Year 2025-2026</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Badge Indicator */}
        <div className="hidden sm:block">{getRoleBadge()}</div>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            title="Notifications"
            className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full border-2 border-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {recentNotifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>No notifications right now</span>
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleItemClick(n)}
                      className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                        !n.isRead ? 'bg-indigo-50/40' : 'bg-white'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {n.type === 'fee_overdue' ? (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        ) : n.type.startsWith('fee_due') ? (
                          <Clock className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Bell className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{n.title}</h4>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(n._id, e)}
                          title="Mark as read"
                          className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded cursor-pointer shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/50 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>View All Notifications</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reset Database Button */}
        <button
          onClick={handleResetData}
          title="Reset Demo Database"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* User Profile Pill & Sign Out Action */}
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{user?.email}</div>
          </div>

          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs border-2 border-white">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>

          {user?.role === 'teacher' && (
            <button
              onClick={() => setShowPasswordModal(true)}
              title="Change password"
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            >
              <LockKeyhole className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={logout}
            title="Switch User / Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-transparent rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        subtitle="Use your current password to set a new teacher portal password."
        maxWidth="md"
      >
        <form onSubmit={(event) => void handleChangePassword(event)} className="space-y-3 text-xs">
          <label className="block font-bold text-slate-700">Current password
            <input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" />
          </label>
          <label className="block font-bold text-slate-700">New password
            <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" />
          </label>
          <label className="block font-bold text-slate-700">Confirm new password
            <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowPasswordModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Cancel</button>
            <button type="submit" disabled={passwordSaving} className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white disabled:opacity-60">{passwordSaving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </Modal>
    </header>
  );
};

export default Navbar;
