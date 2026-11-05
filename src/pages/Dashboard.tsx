import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Layers,
  CalendarCheck,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Clock,
  Award,
  ChevronRight,
  ArrowUpRight,
  Download,
  CalendarDays,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import api from '../api/axios.js';
import Badge from '../components/Badge.js';
import ReportCardPrint from '../components/ReportCardPrint.js';
import FeeVoucherPrint from '../components/FeeVoucherPrint.js';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  // Print/preview state
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [voucherData, setVoucherData] = useState<any>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/api/dashboard/stats');
        if (res.data?.success) {
          setStats(res.data.data);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
    const refresh = window.setInterval(() => { void fetchDashboard(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [user]);

  const handleOpenReportCard = async (examId: string, studentId: string) => {
    try {
      const res = await api.get(`/api/results/report-card/${examId}/${studentId}`);
      if (res.data?.success) {
        setReportCardData(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenVoucher = async (voucherNo: string) => {
    try {
      const res = await api.get(`/api/fees/voucher/${voucherNo}`);
      if (res.data?.success) {
        setVoucherData({
          voucher: res.data.data.voucher,
          breakdown: res.data.data.breakdown,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading Dashboard Data...</p>
        </div>
      </div>
    );
  }

  // --- ADMIN DASHBOARD ---
  if (user?.role === 'admin') {
    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold backdrop-blur-xs text-indigo-200 uppercase tracking-wider inline-block mb-3">
              Principal Administration Workspace
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="mt-2 text-indigo-200 text-sm leading-relaxed">
              Campus operations are functioning smoothly. Below is the live breakdown of attendance, academic performance, and tuition fee collections.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-colors shadow-xs cursor-pointer"
              >
                Enroll New Student
              </button>
              <button
                onClick={() => navigate('/attendance')}
                className="px-4 py-2 bg-indigo-700/80 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl border border-indigo-500/50 transition-colors cursor-pointer"
              >
                Today's Attendance
              </button>
              <button
                onClick={() => navigate('/fees')}
                className="px-4 py-2 bg-indigo-700/80 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl border border-indigo-500/50 transition-colors cursor-pointer"
              >
                Fee Center
              </button>
            </div>
          </div>
        </div>

        {/* 6 Key Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Students</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800">{stats?.totalStudents || 0}</div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
              <TrendingUp className="w-3 h-3" /> Enrolled Active
            </span>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Teachers</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800">{stats?.totalTeachers || 0}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Full-time Faculty</span>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Classes</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800">{stats?.totalClasses || 0}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Active Sections</span>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Attendance</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {stats?.todayAttendanceRate != null ? `${stats.todayAttendanceRate}%` : '—'}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              Above campus goal
            </span>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Fees Collected</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800">
              ${stats?.totalFeesCollected || 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Current Term</span>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Dues</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600">${stats?.totalFeesPending || 0}</div>
            <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
              {stats?.defaultersCount || 0} Defaulters
            </span>
          </div>
        </div>

        {/* Recent Activity & Defaulters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Fee Transactions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Recent Fee Payments
              </h3>
              <button
                onClick={() => navigate('/fees')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {stats?.recentPayments?.map((p: any) => (
                <div key={p._id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{p.studentName}</div>
                    <div className="text-slate-400 text-[11px]">
                      {p.voucherNo} • {p.month}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">${p.amountPaid}</div>
                    <Badge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts & Navigation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Quick Operations
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/attendance')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left cursor-pointer group"
              >
                <CalendarCheck className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-800">Mark Attendance</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Daily roll call & reports</div>
              </button>

              <button
                onClick={() => navigate('/results')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left cursor-pointer group"
              >
                <Award className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-800">Enter Exam Marks</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Auto-grades & PDF cards</div>
              </button>

              <button
                onClick={() => navigate('/timetable')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition-all text-left cursor-pointer group"
              >
                <CalendarDays className="w-5 h-5 text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-800">Manage Timetable</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Clash-free class slots</div>
              </button>

              <button
                onClick={() => navigate('/fees')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left cursor-pointer group"
              >
                <CreditCard className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-800">Fee Vouchers</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Generate & track dues</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- TEACHER DASHBOARD ---
  if (user?.role === 'teacher') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider block mb-1">
              Faculty Workspace
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Good day, {user.name}</h1>
            <p className="text-indigo-200 text-xs mt-1">
              {stats?.teacher?.designation || 'Faculty Member'} •{' '}
              {stats?.teacher?.qualification || 'B.Ed'}
            </p>
          </div>
          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
          >
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
            <span>Mark Today's Attendance</span>
          </button>
        </div>

        {/* Assigned Classes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              My Assigned Classes
            </h3>
            <span className="text-xs text-slate-400">
              {stats?.classes?.length || 0} Active Classes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.classes?.map((cls: any) => (
              <div
                key={cls._id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-slate-900 text-base">
                      {cls.name} - Section {cls.section}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {cls.roomNo || 'Room 201'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Capacity: {cls.capacity || 35} students • Academic Year 2025-2026
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
                  <button
                    onClick={() => navigate(`/attendance?classId=${cls._id}`)}
                    className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Attendance
                  </button>
                  <button
                    onClick={() => navigate(`/results?classId=${cls._id}`)}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Enter Marks
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              My Teaching Timetable
            </h3>
            <button
              onClick={() => navigate('/timetable')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Full Schedule <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.timetable?.slice(0, 5).map((slot: any) => (
                  <tr key={slot._id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{slot.day}</td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-600">
                      Period {slot.period}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {slot.startTime} - {slot.endTime}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{slot.subjectName}</td>
                    <td className="py-2.5 px-3 text-slate-500">{slot.roomNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- STUDENT DASHBOARD ---
  if (user?.role === 'student') {
    const student = stats?.student;
    const att = stats?.attendanceSummary;
    const latestRes = stats?.latestResult;
    const vouchers: any[] = stats?.vouchers || [];

    const overdueVouchers = vouchers.filter((v: any) => v.status === 'Overdue');
    const todayStr = new Date().toISOString().split('T')[0];
    const dueSoonVouchers = vouchers.filter((v: any) => {
      if (v.status === 'Paid' || v.status === 'Overdue') return false;
      const diffDays = Math.round(
        (new Date(`${v.dueDate}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 3;
    });

    return (
      <div className="space-y-6">
        {/* Highlighted Banner for Overdue / Due Soon Vouchers */}
        {overdueVouchers.length > 0 && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-rose-800">
                  Payment Overdue Alert
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Your fee voucher for <strong>{overdueVouchers[0].month}</strong> is overdue (due {overdueVouchers[0].dueDate}). Balance: ${overdueVouchers[0].balance}. Please pay as soon as possible.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/fees')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Pay Voucher Now
            </button>
          </div>
        )}

        {overdueVouchers.length === 0 && dueSoonVouchers.length > 0 && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-amber-800">
                  Fee Due Soon Reminder
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Fee due soon: pay your <strong>{dueSoonVouchers[0].month}</strong> voucher before {dueSoonVouchers[0].dueDate} (Amount: ${dueSoonVouchers[0].balance}).
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/fees')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              View Voucher
            </button>
          </div>
        )}

        {/* Banner */}
        <div className="bg-gradient-to-r from-cyan-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-semibold text-cyan-200 uppercase tracking-wider block mb-1">
              Student Desk
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {user.name}</h1>
            <p className="text-cyan-200 text-xs mt-1">
              Class {student?.className} • Roll No: {student?.rollNo} • Admission No:{' '}
              {student?.admissionNo}
            </p>
          </div>
          {latestRes && (
            <button
              onClick={() => handleOpenReportCard(latestRes.examId, student._id)}
              className="px-4 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-cyan-50 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Download Report Card</span>
            </button>
          )}
          {!latestRes && (
            <button type="button" disabled title="Available after results are entered." className="px-4 py-2.5 bg-white/50 text-white/70 font-bold text-xs rounded-xl cursor-not-allowed">
              Available after results are entered.
            </button>
          )}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">My Class Subjects</h2>
          </div>
          {stats?.subjects?.length ? (
            <div className="flex flex-wrap gap-2">
              {stats.subjects.map((subject: any) => (
                <span key={subject._id} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
                  {subject.name}
                  {subject.code && <span className="ml-1.5 text-indigo-500">({subject.code})</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No subjects are assigned to your class yet.</p>
          )}
        </section>
        {lastUpdated && (
          <p className="text-right text-[11px] text-slate-400">
            Last updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Attendance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Attendance Rate
              </span>
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
            </div>
            {att?.isNewStudent && (
              <span className="mb-2 inline-flex rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 px-2.5 py-1 text-[10px] font-bold">
                New Student
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">
                {att && att.totalDays > 0 && att.percentage != null ? `${att.percentage}%` : '—'}
              </span>
              <span className="text-xs text-slate-400">
                ({att?.presentDays ?? 0} / {att?.totalDays ?? 0} days)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full"
                style={{
                  width: `${att && att.totalDays > 0 && att.percentage != null ? att.percentage : 0}%`,
                }}
              />
            </div>
          </div>
          {/* Latest Grade */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Latest Exam Score
              </span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">
                {latestRes ? `${latestRes.percentage}%` : 'Not entered'}
              </span>
              {latestRes && <span className="text-xs font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Grade {latestRes.grade}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-3 truncate">
              {latestRes ? `Rank #${latestRes.position ?? '—'} in class • ${latestRes.examName}` : 'No exam results yet. Your results will appear here once your teacher enters marks.'}
            </p>
          </div>

          {/* Tuition Balance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fee Dues
              </span>
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-slate-800">${stats?.pendingFees || 0}</div>
            <span
              className={`text-xs font-semibold mt-3 inline-block ${
                stats?.pendingFees > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {vouchers.length === 0 ? 'No fee vouchers yet.' : stats?.pendingFees > 0 ? 'Payment balance pending' : 'All vouchers settled'}
            </span>
          </div>
        </div>

        {/* Timetable preview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Class Timetable Schedule
            </h3>
            <button
              onClick={() => navigate('/timetable')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              View Full Week <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Teacher</th>
                  <th className="py-2.5 px-3">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!stats?.timetable || stats.timetable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No timetable set for this class yet
                    </td>
                  </tr>
                ) : (
                  stats.timetable.map((slot: any) => (
                    <tr key={slot._id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{slot.day}</td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-600">
                        Period {slot.period}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {slot.startTime} - {slot.endTime}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{slot.subjectName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{slot.teacherName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{slot.roomNo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {reportCardData && (
          <ReportCardPrint data={reportCardData} onClose={() => setReportCardData(null)} />
        )}
      </div>
    );
  }

  // --- PARENT DASHBOARD ---
  if (user?.role === 'parent') {
    const children = stats?.children || [];
    const activeChild = children[selectedChildIndex] || children[0];

    return (
      <div className="space-y-6">
        {/* Child Selector Tabs */}
        {children.length > 1 && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
              Select Child:
            </span>
            {children.map((c: any, index: number) => (
              <button
                key={c.student._id}
                onClick={() => setSelectedChildIndex(index)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedChildIndex === index
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {c.student.name} ({c.student.className})
              </button>
            ))}
          </div>
        )}

        {/* Child Banner */}
        {activeChild && (() => {
          const activeChildVouchers = activeChild.vouchers || [];
          const childOverdue = activeChildVouchers.filter((v: any) => v.status === 'Overdue');
          const todayStr = new Date().toISOString().split('T')[0];
          const childDueSoon = activeChildVouchers.filter((v: any) => {
            if (v.status === 'Paid' || v.status === 'Overdue') return false;
            const diffDays = Math.round(
              (new Date(`${v.dueDate}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return diffDays >= 0 && diffDays <= 3;
          });

          return (
            <div className="space-y-4">
              {childOverdue.length > 0 && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-rose-800">
                        Payment Overdue Alert: {activeChild.student.name}
                      </h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        Tuition voucher for <strong>{childOverdue[0].month}</strong> was due on {childOverdue[0].dueDate} (Balance: ${childOverdue[0].balance}). Please pay as soon as possible.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/fees')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    Pay Voucher
                  </button>
                </div>
              )}

              {childOverdue.length === 0 && childDueSoon.length > 0 && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-amber-800">
                        Fee Due Soon Reminder: {activeChild.student.name}
                      </h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Tuition voucher for <strong>{childDueSoon[0].month}</strong> is due on {childDueSoon[0].dueDate} (Amount: ${childDueSoon[0].balance}).
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/fees')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    View Voucher
                  </button>
                </div>
              )}

              <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider block mb-1">
                    Parent Overview
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {activeChild.student.name}'s Academic Hub
                  </h1>
                  <p className="text-amber-200 text-xs mt-1">
                    Class: {activeChild.student.className} • Roll No: {activeChild.student.rollNo} •
                    Admission: {activeChild.student.admissionNo}
                  </p>
                </div>
                <div className="flex gap-2">
                  {activeChild.latestResult && (
                    <button
                      onClick={() =>
                        handleOpenReportCard(
                          activeChild.latestResult.examId,
                          activeChild.student._id
                        )
                      }
                      className="px-3.5 py-2 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-amber-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Report Card</span>
                    </button>
                  )}
                  {activeChild.vouchers?.[0] && (
                    <button
                      onClick={() => handleOpenVoucher(activeChild.vouchers[0].voucherNo)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Fee Voucher</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3 Metric Cards for Active Child */}
        {activeChild && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Attendance Rate
                </span>
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600">
                  {activeChild.attendanceSummary &&
                  activeChild.attendanceSummary.totalDays > 0 &&
                  activeChild.attendanceSummary.percentage != null
                    ? `${activeChild.attendanceSummary.percentage}%`
                    : '—'}
                </span>
                <span className="text-xs text-slate-400">
                  ({activeChild.attendanceSummary?.presentDays ?? 0} /{' '}
                  {activeChild.attendanceSummary?.totalDays ?? 0} school days)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{
                    width: `${
                      activeChild.attendanceSummary &&
                      activeChild.attendanceSummary.totalDays > 0 &&
                      activeChild.attendanceSummary.percentage != null
                        ? activeChild.attendanceSummary.percentage
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Latest Exam Result
                </span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">
                  {activeChild.latestResult ? `${activeChild.latestResult.percentage}%` : 'Not entered'}
                </span>
                {activeChild.latestResult && <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">Grade {activeChild.latestResult.grade}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {activeChild.latestResult
                  ? `Rank #${activeChild.latestResult.position ?? '—'} in class • ${activeChild.latestResult.examName}`
                  : 'No exam results yet. Your results will appear here once your teacher enters marks.'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Tuition Fee Status
                </span>
                <CreditCard className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-800">
                ${activeChild.pendingFees || 0}
              </div>
              <span
                className={`text-xs font-semibold mt-2 inline-block ${
                  activeChild.pendingFees > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {(activeChild.vouchers || []).length === 0 ? 'No fee vouchers yet.' : activeChild.pendingFees > 0 ? 'Balance due this month' : 'No pending dues'}
              </span>
            </div>
          </div>
        )}

        {/* Fee Vouchers List */}
        {activeChild && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Fee Vouchers & Payment History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Total Due</th>
                    <th className="py-2.5 px-3">Paid</th>
                    <th className="py-2.5 px-3">Balance</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeChild.vouchers?.map((v: any) => (
                    <tr key={v._id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{v.voucherNo}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{v.month}</td>
                      <td className="py-2.5 px-3 text-slate-500">{v.dueDate}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">${v.totalDue}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-semibold">${v.amountPaid}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">${v.balance}</td>
                      <td className="py-2.5 px-3">
                        <Badge status={v.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenVoucher(v.voucherNo)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                        >
                          Print / Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportCardData && (
          <ReportCardPrint data={reportCardData} onClose={() => setReportCardData(null)} />
        )}

        {voucherData && (
          <FeeVoucherPrint
            voucher={voucherData.voucher}
            breakdown={voucherData.breakdown}
            onClose={() => setVoucherData(null)}
          />
        )}
      </div>
    );
  }

  return <div>Welcome to EduManage</div>;
};

export default Dashboard;
