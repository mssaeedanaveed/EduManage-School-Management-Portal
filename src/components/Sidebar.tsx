import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Archive,
  Layers,
  BookOpen,
  CalendarCheck,
  Award,
  CalendarDays,
  CreditCard,
  HeartHandshake,
  LogOut,
  Sparkles,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import api from '../api/axios.js';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const role = user?.role || 'student';
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  useEffect(() => {
    if (role !== 'teacher') {
      setIsClassTeacher(false);
      return;
    }
    let active = true;
    api.get('/api/teacher/attendance/my-class')
      .then((response) => {
        if (active) setIsClassTeacher(response.data?.success === true);
      })
      .catch(() => {
        if (active) setIsClassTeacher(false);
      });
    return () => { active = false; };
  }, [role, user?._id]);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
        : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70'
    }`;

  const renderNavItems = () => {
    if (role === 'admin') {
      return (
        <>
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Overview
          </div>
          <NavLink to="/dashboard" className={navItemClass} onClick={onClose}>
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span>Dashboard</span>
          </NavLink>

          <div className="px-3 pt-5 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Academic Management
          </div>
          <NavLink to="/students" className={navItemClass} onClick={onClose}>
            <GraduationCap className="w-4.5 h-4.5" />
            <span>Students</span>
          </NavLink>
          <NavLink to="/old-students" className={navItemClass} onClick={onClose}>
            <Archive className="w-4.5 h-4.5" />
            <span>Old Students</span>
          </NavLink>
          <NavLink to="/teachers" className={navItemClass} onClick={onClose}>
            <Users className="w-4.5 h-4.5" />
            <span>Teachers</span>
          </NavLink>
          <NavLink to="/classes" className={navItemClass} onClick={onClose}>
            <Layers className="w-4.5 h-4.5" />
            <span>Classes & Sections</span>
          </NavLink>
          <NavLink to="/subjects" className={navItemClass} onClick={onClose}>
            <BookOpen className="w-4.5 h-4.5" />
            <span>Subjects</span>
          </NavLink>

          <div className="px-3 pt-5 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Operations
          </div>
          <NavLink to="/attendance" className={navItemClass} onClick={onClose}>
            <CalendarCheck className="w-4.5 h-4.5" />
            <span>Attendance</span>
          </NavLink>
          <NavLink to="/results" className={navItemClass} onClick={onClose}>
            <Award className="w-4.5 h-4.5" />
            <span>Exams & Results</span>
          </NavLink>
          <NavLink to="/timetable" className={navItemClass} onClick={onClose}>
            <CalendarDays className="w-4.5 h-4.5" />
            <span>Timetable</span>
          </NavLink>
          <NavLink to="/fees" className={navItemClass} onClick={onClose}>
            <CreditCard className="w-4.5 h-4.5" />
            <span>Fee Management</span>
          </NavLink>
          <NavLink to="/notifications" className={navItemClass} onClick={onClose}>
            <Bell className="w-4.5 h-4.5" />
            <span>Notifications</span>
          </NavLink>
        </>
      );
    }

    if (role === 'accountant') {
      return (
        <>
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Finance Workspace
          </div>
          <NavLink to="/dashboard" className={navItemClass} onClick={onClose}>
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/fees" className={navItemClass} onClick={onClose}>
            <CreditCard className="w-4.5 h-4.5" />
            <span>Payments & Vouchers</span>
          </NavLink>
          <NavLink to="/notifications" className={navItemClass} onClick={onClose}>
            <Bell className="w-4.5 h-4.5" />
            <span>Notifications</span>
          </NavLink>
        </>
      );
    }

    if (role === 'teacher') {
      return (
        <>
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Faculty Workspace
          </div>
          <NavLink to="/dashboard" className={navItemClass} onClick={onClose}>
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span>Teacher Dashboard</span>
          </NavLink>
          {isClassTeacher && <NavLink to="/attendance" className={navItemClass} onClick={onClose}>
            <CalendarCheck className="w-4.5 h-4.5" />
            <span>Mark Attendance</span>
          </NavLink>}
          <NavLink to="/results" className={navItemClass} onClick={onClose}>
            <Award className="w-4.5 h-4.5" />
            <span>Grade & Results</span>
          </NavLink>
          <NavLink to="/timetable" className={navItemClass} onClick={onClose}>
            <CalendarDays className="w-4.5 h-4.5" />
            <span>My Timetable</span>
          </NavLink>
          <NavLink to="/classes" className={navItemClass} onClick={onClose}>
            <Layers className="w-4.5 h-4.5" />
            <span>Assigned Classes</span>
          </NavLink>
          <NavLink to="/notifications" className={navItemClass} onClick={onClose}>
            <Bell className="w-4.5 h-4.5" />
            <span>Notifications</span>
          </NavLink>
        </>
      );
    }

    if (role === 'parent') {
      return (
        <>
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Family Hub
          </div>
          <NavLink to="/dashboard" className={navItemClass} onClick={onClose}>
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span>Parent Dashboard</span>
          </NavLink>
          <NavLink to="/parent-portal" className={navItemClass} onClick={onClose}>
            <HeartHandshake className="w-4.5 h-4.5" />
            <span>Children Portal</span>
          </NavLink>
          <NavLink to="/attendance" className={navItemClass} onClick={onClose}>
            <CalendarCheck className="w-4.5 h-4.5" />
            <span>Attendance Reports</span>
          </NavLink>
          <NavLink to="/results" className={navItemClass} onClick={onClose}>
            <Award className="w-4.5 h-4.5" />
            <span>Report Cards</span>
          </NavLink>
          <NavLink to="/fees" className={navItemClass} onClick={onClose}>
            <CreditCard className="w-4.5 h-4.5" />
            <span>Fee Vouchers</span>
          </NavLink>
          <NavLink to="/timetable" className={navItemClass} onClick={onClose}>
            <CalendarDays className="w-4.5 h-4.5" />
            <span>Class Timetable</span>
          </NavLink>
          <NavLink to="/notifications" className={navItemClass} onClick={onClose}>
            <Bell className="w-4.5 h-4.5" />
            <span>Notifications</span>
          </NavLink>
        </>
      );
    }

    // Student
    return (
      <>
        <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Student Desk
        </div>
        <NavLink to="/dashboard" className={navItemClass} onClick={onClose}>
          <LayoutDashboard className="w-4.5 h-4.5" />
          <span>My Dashboard</span>
        </NavLink>
        <NavLink to="/attendance" className={navItemClass} onClick={onClose}>
          <CalendarCheck className="w-4.5 h-4.5" />
          <span>My Attendance</span>
        </NavLink>
        <NavLink to="/results" className={navItemClass} onClick={onClose}>
          <Award className="w-4.5 h-4.5" />
          <span>My Report Card</span>
        </NavLink>
        <NavLink to="/timetable" className={navItemClass} onClick={onClose}>
          <CalendarDays className="w-4.5 h-4.5" />
          <span>My Timetable</span>
        </NavLink>
        <NavLink to="/fees" className={navItemClass} onClick={onClose}>
          <CreditCard className="w-4.5 h-4.5" />
          <span>My Fee Vouchers</span>
        </NavLink>
        <NavLink to="/notifications" className={navItemClass} onClick={onClose}>
          <Bell className="w-4.5 h-4.5" />
          <span>Notifications</span>
        </NavLink>
      </>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-1.5">
              EduManage
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-indigo-50 text-indigo-600 rounded">
                v2
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Academy Portal</p>
          </div>
        </div>

        {/* User Role Tag */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                role === 'admin'
                  ? 'bg-purple-500'
                  : role === 'teacher'
                  ? 'bg-indigo-500'
                  : role === 'parent'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs font-semibold capitalize text-slate-700">
              {role} Account
            </span>
          </div>
          <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {renderNavItems()}
        </div>

        {/* Footer with sign out */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/40">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-transparent rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
