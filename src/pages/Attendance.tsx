import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Calendar,
  Save,
  FileSpreadsheet,
  FileText,
  Sparkles,
  User,
  GraduationCap,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios.js';
import Badge from '../components/Badge.js';
import { IClass, ISubject } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import AdminAttendance from './AdminAttendance.js';

interface AttendanceRosterItem {
  studentId: string;
  name: string;
  rollNo: string;
  admissionNo: string;
  status: 'Present' | 'Absent' | 'Late' | 'OnLeave' | 'Leave' | 'Unmarked';
  remarks?: string;
  isMarked?: boolean;
  isNewStudent?: boolean;
  leaveLocked?: boolean;
}

const getSchoolDaysForMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, month - 1, index + 1);
    return {
      week: Math.ceil((index + 1) / 7),
      value: `${yearMonth}-${String(index + 1).padStart(2, '0')}`,
      label: `${labels[date.getDay()]} · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      day: date.getDay(),
    };
  }).filter((item) => item.day >= 1 && item.day <= 5);
};

export const Attendance: React.FC = () => {
  const { user, profile } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const canMark = isAdmin || isTeacher;

  const [activeTab, setActiveTab] = useState<'daily' | 'history' | 'monthly'>('daily');
  const [classes, setClasses] = useState<IClass[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [dailyWeek, setDailyWeek] = useState(() => Math.ceil(new Date().getDate() / 7));
  const [monthFinalized, setMonthFinalized] = useState(false);
  const [classesLoading, setClassesLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState('');
  const [pageError, setPageError] = useState('');

  // Daily State
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [savingDaily, setSavingDaily] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Monthly Report State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Student / Parent Personal View
  const [personalSummary, setPersonalSummary] = useState<any>(null);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  useEffect(() => {
    const fetchClasses = async () => {
      setClassesLoading(true);
      setPageError('');
      try {
        if (isTeacher) {
          const assigned = await api.get('/api/teacher/attendance/my-class');
          if (assigned.data?.success && assigned.data.data) {
            const cls = assigned.data.data as IClass;
            setClasses([cls]);
            setSelectedClass(cls._id);
            return;
          }
        }
        const res = await api.get('/api/classes');
        if (res.data?.success) {
          const list: IClass[] = res.data.data || [];
          setClasses(list);
          setSelectedClass((current) => current && list.some((cls) => cls._id === current)
            ? current
            : list[0]?._id || '');
        }
      } catch (e) {
        console.error(e);
        setPageError('Could not load assigned classes. Please refresh and try again.');
      } finally {
        setClassesLoading(false);
      }
    };

    if (canMark) {
      fetchClasses();
    }
  }, [user, profile]);

  useEffect(() => {
    setSelectedSubject('');
    setSubjects([]);
    setRoster([]);
    setMonthlyData(null);
    setSubjectsError('');
    if (!selectedClass) {
      setSubjectsLoading(false);
      return;
    }
    let active = true;
    setSubjectsLoading(true);
    api.get('/api/subjects', { params: { classId: selectedClass } })
      .then((res) => {
        if (active) {
          setSubjects(res.data?.success ? res.data.data || [] : []);
          setSubjectsError('');
        }
      })
      .catch((error) => {
        console.error('Failed to load class subjects for attendance', error);
        if (active) {
          setSubjects([]);
          setSubjectsError('Could not load subjects for this class.');
        }
      })
      .finally(() => {
        if (active) setSubjectsLoading(false);
      });
    return () => { active = false; };
  }, [selectedClass]);

  useEffect(() => {
    const availableDays = getSchoolDaysForMonth(selectedMonth);
    if (availableDays.length === 0) return;
    const currentDate = availableDays.find((item) => item.value === selectedDate);
    const selectedDay = currentDate || availableDays[0];
    setDailyWeek(selectedDay.week);
    if (!currentDate) setSelectedDate(selectedDay.value);
  }, [selectedMonth]);

  // Fetch student or parent personal attendance data
  useEffect(() => {
    const fetchPersonal = async () => {
      if (isStudent) {
        try {
          const res = await api.get('/api/dashboard/stats');
          if (res.data?.success) {
            setPersonalSummary(res.data.data.attendanceSummary);
          }
        } catch (e) {
          console.error(e);
        }
      } else if (isParent) {
        try {
          const res = await api.get('/api/dashboard/stats');
          if (res.data?.success && res.data.data.children) {
            setParentChildren(res.data.data.children);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchPersonal();
  }, [user]);

  useEffect(() => {
    if (!isStudent && !isParent) return;
    const refresh = window.setInterval(async () => {
      try {
        const res = await api.get('/api/dashboard/stats');
        if (!res.data?.success) return;
        if (isStudent) setPersonalSummary(res.data.data.attendanceSummary);
        if (isParent) setParentChildren(res.data.data.children || []);
      } catch (error) {
        console.error('Failed to refresh attendance data', error);
      }
    }, 15000);
    return () => window.clearInterval(refresh);
  }, [isStudent, isParent]);

  // Fetch Daily Roster
  const fetchDailyRoster = async () => {
    if (!selectedClass || !selectedDate) return;
    if (isTeacher && (!selectedClass || !selectedDate)) {
      setRoster([]);
      return;
    }
    setLoadingDaily(true);
    setSaveSuccess(false);
    try {
      const res = await api.get(isTeacher ? '/api/teacher/attendance/students' : '/api/attendance/class', {
        params: {
          classId: selectedClass,
          date: selectedDate,
          ...(selectedSubject ? { subjectId: selectedSubject } : {}),
        },
      });
      if (res.data?.success) {
        setRoster((res.data.data || []).map((student: any) => ({
          ...student,
          status: student.status === 'Leave' ? 'OnLeave' : student.status,
        })));
        setMonthFinalized(Boolean(res.data.isFinalized));
        setPageError('');
      }
    } catch (e) {
      console.error(e);
      setPageError('Could not load attendance for the selected class and date.');
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily' && selectedClass && canMark && !subjectsLoading) {
      fetchDailyRoster();
    }
  }, [selectedClass, selectedDate, selectedSubject, activeTab, subjectsLoading]);

  // Fetch Monthly Report
  const fetchMonthlyReport = async () => {
    if (!selectedClass || !selectedMonth) return;
    const classTeacher = isTeacher;
    if (isTeacher && classes.length === 0) {
      setMonthlyData(null);
      return;
    }
    setLoadingMonthly(true);
    try {
      const res = await api.get(
        isTeacher && classTeacher ? '/api/teacher/attendance/report' : '/api/attendance/monthly-report',
        {
          params: {
            classId: selectedClass,
            month: selectedMonth,
            ...(!isTeacher || !classTeacher
              ? (selectedSubject ? { subjectId: selectedSubject } : {})
              : {}),
          },
        }
      );
      if (res.data?.success) {
        const reportData = isTeacher && classTeacher ? {
          ...res.data.data,
          report: (res.data.data?.report || []).map((row: any) => ({
            ...row,
            presentDays: row.present,
            absentDays: row.absent,
            leaveDays: row.leave,
            lateDays: row.late,
          })),
        } : res.data.data;
        setMonthlyData(reportData);
        setMonthFinalized(Boolean(reportData?.isFinalized));
        setPageError('');
      }
    } catch (e) {
      console.error(e);
      setPageError('Could not load the monthly attendance report.');
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monthly' && selectedClass && canMark && !subjectsLoading) {
      fetchMonthlyReport();
    }
  }, [selectedClass, selectedMonth, selectedSubject, activeTab, subjectsLoading]);

  useEffect(() => {
    if (activeTab !== 'history' || !isTeacher) return;
    setLoadingHistory(true);
    api.get('/api/teacher/attendance/history')
      .then((response) => {
        if (response.data?.success) setHistory(response.data.data || []);
      })
      .catch((error: any) => setPageError(error.response?.data?.message || 'Could not load attendance history.'))
      .finally(() => setLoadingHistory(false));
  }, [activeTab, isTeacher]);

  useEffect(() => {
    const classTeacher = classes.find((cls) => cls._id === selectedClass)?.classTeacherId === profile?.teacher?._id;
    if (activeTab !== 'monthly' || !canMark || (isTeacher && !selectedSubject && !classTeacher)) return;
    const refresh = window.setInterval(() => { void fetchMonthlyReport(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [activeTab, selectedClass, selectedMonth, selectedSubject, canMark, isTeacher, classes, profile]);

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'OnLeave') => {
    setRoster((prev) =>
      prev.map((item) => (
        item.studentId === studentId && !item.leaveLocked ? { ...item, status } : item
      ))
    );
  };

  const handleMarkAllPresent = () => {
    setRoster((prev) => prev.map((item) => (
      item.leaveLocked ? item : { ...item, status: 'Present' }
    )));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass || !selectedDate) return;
    if (isTeacher && classes.length === 0) {
      alert('Only the current class teacher can mark this class attendance.');
      return;
    }
    if (monthFinalized) {
      alert('Attendance for this month has been concluded and is locked.');
      return;
    }
    if (roster.some((record) => record.status === 'Unmarked')) {
      alert('Mark every student present, absent, or on leave before saving attendance.');
      return;
    }
    setSavingDaily(true);
    try {
      const records = roster.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks || '',
      }));
      const res = await api.post(isTeacher ? '/api/teacher/attendance' : '/api/attendance/mark', {
        classId: selectedClass,
        date: selectedDate,
        ...(selectedSubject ? { subjectId: selectedSubject } : {}),
        records,
      });
      if (res.data?.success) {
        await fetchDailyRoster();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSavingDaily(false);
    }
  };

  const handleConcludeAttendance = async () => {
    try {
      await api.post('/api/attendance/conclude', { classId: selectedClass, month: selectedMonth });
      setMonthFinalized(true);
      await fetchMonthlyReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to conclude class attendance');
    }
  };

  const handleUnlockAttendance = async () => {
    try {
      await api.post('/api/attendance/unlock', { classId: selectedClass, month: selectedMonth });
      setMonthFinalized(false);
      await fetchMonthlyReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unlock class attendance');
    }
  };

  const schoolMonthDays = getSchoolDaysForMonth(selectedMonth);
  const availableWeeks = [...new Set(schoolMonthDays.map((item) => item.week))];
  const daysInSelectedWeek = schoolMonthDays.filter((item) => item.week === dailyWeek);
  const selectedClassInfo = classes.find((cls) => cls._id === selectedClass);
  const isSelectedClassTeacher = selectedClassInfo?.classTeacherId === profile?.teacher?._id;
  const assignedSubjects = subjects.filter((subject) =>
    subject.classId === selectedClass && (!isTeacher || subject.teacherId === profile?.teacher?._id)
  );
  const totalPresentDays = (monthlyData?.report || []).reduce(
    (total: number, item: any) => total + Number(item.presentDays || 0),
    0
  );
  const expectedAttendanceDays = Number(monthlyData?.totalClassDays || 0) * Number(monthlyData?.totalStudents || 0);
  const classAttendancePercentage = expectedAttendanceDays
    ? Number(((totalPresentDays / expectedAttendanceDays) * 100).toFixed(1))
    : null;

  if (canMark && !classesLoading && classes.length === 0) {
    return (
      <div className="space-y-4">
        {pageError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{pageError}</div>}
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {isTeacher ? 'No classes assigned yet.' : 'No classes are available for attendance.'}
        </div>
      </div>
    );
  }

  // Export CSV
  const handleExportCSV = () => {
    if (isTeacher) {
      void downloadAttendanceExport('xlsx');
      return;
    }
    if (!monthlyData?.report) return;
    const headers = ['Roll No', 'Student Name', 'Total School Days', 'Present', 'Absent', 'Leave', 'Attendance %'];
    const rows = monthlyData.report.map((r: any) => [
      r.rollNo,
      `"${r.name}"`,
      r.totalDays,
      r.presentDays,
      r.absentDays,
      r.leaveDays,
      r.percentage == null ? '—' : `${r.percentage}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${selectedMonth}_Class_${selectedClass}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handleExportPDF = () => {
    if (isTeacher) {
      void downloadAttendanceExport('pdf');
      return;
    }
    if (!monthlyData?.report) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('St. Augustine International Academy', 105, 18, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202);
    doc.text(`Monthly Attendance Summary - ${selectedMonth}`, 105, 26, { align: 'center' });

    const tableBody = monthlyData.report.map((r: any) => [
      r.rollNo,
      r.name,
      r.totalDays.toString(),
      r.presentDays.toString(),
      r.absentDays.toString(),
      r.leaveDays.toString(),
      r.percentage == null ? '—' : `${r.percentage}%`,
    ]);

    autoTable(doc, {
      startY: 34,
      head: [['Roll No', 'Student Name', 'Total Days', 'Present', 'Absent', 'Leave', 'Percentage']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    doc.save(`Monthly_Attendance_${selectedMonth}.pdf`);
  };

  const downloadAttendanceExport = async (format: 'xlsx' | 'pdf') => {
    try {
      const response = await api.get(`/api/teacher/attendance/export/${format}`, {
        params: { classId: selectedClass, month: selectedMonth },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${selectedMonth}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setPageError(error.response?.data?.message || 'Could not export attendance report.');
    }
  };

  if (isAdmin) {
    return <AdminAttendance />;
  }

  // -------------------------------------------------------------
  // DEDICATED STUDENT PERSONAL ATTENDANCE VIEW
  // -------------------------------------------------------------
  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="bg-linear-to-r from-cyan-700 via-indigo-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 block mb-1">
              Student Attendance Record
            </span>
            <h1 className="text-2xl font-black">{user.name}</h1>
            <p className="text-xs text-cyan-200 mt-0.5">
              Roll No: {profile?.student?.rollNo || '—'} • Class: {profile?.student?.className || '—'}
            </p>
          </div>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/20 text-center">
            <span className="text-[10px] font-bold uppercase text-cyan-200 block">Attendance Rate</span>
            <span className="text-2xl font-black text-white">
              {personalSummary && personalSummary.totalDays > 0 && personalSummary.percentage != null
                ? `${personalSummary.percentage}%`
                : '—'}
            </span>
          </div>
        </div>

        {/* 4 Attendance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance %</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {personalSummary && personalSummary.totalDays > 0 && personalSummary.percentage != null
                ? `${personalSummary.percentage}%`
                : '—'}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {personalSummary?.isNewStudent ? 'New Student' : 'Recorded attendance'}
            </span>
          </div>
          {personalSummary?.isNewStudent && (
            <div className="inline-flex px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-xs font-bold">
              New Student
            </div>
          )}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Days Present</div>
            <div className="text-2xl font-black text-slate-800 mt-1">{personalSummary?.presentDays ?? 0}</div>
            <span className="text-[10px] text-slate-400">Recorded In-Person</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Days Absent</div>
            <div className="text-2xl font-black text-rose-600 mt-1">{personalSummary?.absentDays ?? 0}</div>
            <span className="text-[10px] text-rose-600 font-semibold">Unexcused</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approved Leave</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{personalSummary?.leaveDays ?? 0}</div>
            <span className="text-[10px] text-slate-400">Formal Applications</span>
          </div>
        </div>

        {/* Detailed Daily History Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs">Recent Daily Roll Call Log</h3>
            <span className="text-xs text-slate-500">Total School Days: {personalSummary?.totalDays ?? 0}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personalSummary?.records?.length ? personalSummary.records.map((rec: any) => (
                  <tr key={rec._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{rec.date}</td>
                    <td className="py-3 px-4">
                      <Badge status={rec.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic">{rec.remarks || '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="py-8 text-center text-slate-500">No attendance records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEDICATED PARENT ATTENDANCE VIEW
  // -------------------------------------------------------------
  if (isParent) {
    const activeChild = parentChildren[selectedChildIndex] || parentChildren[0];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-amber-600" />
              Child Attendance Record
            </h1>
            <p className="text-xs text-slate-500">
              Daily attendance logs and percentage metrics for your registered child
            </p>
          </div>

          {parentChildren.length > 1 && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {parentChildren.map((c, idx) => (
                <button
                  key={c.student._id}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedChildIndex === idx
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.student.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeChild && (
          <div className="space-y-4">
            <div className="bg-linear-to-r from-amber-700 via-amber-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 block mb-1">
                  Enrolled Student
                </span>
                <h2 className="text-2xl font-black">{activeChild.student.name}</h2>
                <p className="text-xs text-amber-100 mt-0.5">
                  Class: {activeChild.student.className} • Roll No: {activeChild.student.rollNo}
                </p>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/20 text-center">
                <span className="text-[10px] font-bold uppercase text-amber-200 block">Attendance Standing</span>
                {activeChild.attendanceSummary?.isNewStudent && <span className="text-[10px] font-bold text-cyan-200 block">New Student</span>}
                <span className="text-2xl font-black text-white">
                  {activeChild.attendanceSummary &&
                  activeChild.attendanceSummary.totalDays > 0 &&
                  activeChild.attendanceSummary.percentage != null
                    ? `${activeChild.attendanceSummary.percentage}%`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Teacher Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeChild.attendanceSummary?.records?.length ? activeChild.attendanceSummary.records.map((rec: any) => (
                    <tr key={rec._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{rec.date}</td>
                      <td className="py-3 px-4">
                        <Badge status={rec.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-500 italic">{rec.remarks || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="py-8 text-center text-slate-500">No attendance records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEACHER & ADMIN ATTENDANCE MARKING & REPORTS
  // -------------------------------------------------------------
  const presentCount = roster.filter((r) => r.status === 'Present').length;
  const absentCount = roster.filter((r) => r.status === 'Absent').length;
  const lateCount = roster.filter((r) => r.status === 'Late').length;
  const leaveCount = roster.filter((r) => r.status === 'Leave' || r.status === 'OnLeave').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600" />
            Attendance Management
          </h1>
          <p className="text-xs text-slate-500">
            {isTeacher ? 'Mark daily attendance for your assigned classes' : 'Campus-wide roll call and monthly reports'}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Marking
          </button>
          {isTeacher && (
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              History
            </button>
          )}
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Report
          </button>
        </div>
      </div>

      {pageError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {pageError}
        </div>
      )}
      {subjectsError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {subjectsError}
        </div>
      )}

      {/* Control Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {!isTeacher && <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Select Class
            </label>
            <select
              value={selectedClass}
              disabled={classesLoading}
              onChange={(e) => {
                setSelectedSubject('');
                setRoster([]);
                setMonthlyData(null);
                setSelectedClass(e.target.value);
              }}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-slate-800"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>}


          {activeTab === 'daily' ? (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="py-2 px-3 text-xs rounded-xl border border-slate-200"
                />
              </div>
              {isTeacher ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attendance Date</label>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="py-2 px-3 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Week</label>
                    <select value={dailyWeek} onChange={(e) => {
                      const week = Number(e.target.value);
                      setDailyWeek(week);
                      const firstDay = schoolMonthDays.find((item) => item.week === week);
                      if (firstDay) setSelectedDate(firstDay.value);
                    }} className="py-2 px-3 text-xs rounded-xl border border-slate-200">
                      {availableWeeks.map((week) => <option key={week} value={week}>Week {week}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Day</label>
                    <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="py-2 px-3 text-xs rounded-xl border border-slate-200">
                      {daysInSelectedWeek.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                    </select>
                  </div>
                </>
              )}
            </>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Report Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Tab Specific Action Buttons */}
        {activeTab === 'daily' && canMark && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              disabled={monthFinalized || (isTeacher && classes.length === 0)}
              className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>
            <button
              onClick={handleSaveAttendance}
              disabled={savingDaily || monthFinalized || (isTeacher && classes.length === 0)}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingDaily ? 'Saving...' : 'Save Attendance'}</span>
            </button>
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF Report</span>
            </button>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Attendance successfully recorded for {roster.length} students on {selectedDate}!</span>
        </div>
      )}

      {/* TAB 1: DAILY ATTENDANCE ROSTER */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {isTeacher && classes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              You are not currently assigned as the class teacher.
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Total</span>
              <span className="text-xl font-black">{roster.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">Present</span>
                <span className="text-xl font-black">{presentCount}</span>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-80" />
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">Absent</span>
                <span className="text-xl font-black">{absentCount}</span>
              </div>
              <XCircle className="w-6 h-6 text-rose-500 opacity-80" />
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">Leave</span>
                <span className="text-xl font-black">{leaveCount}</span>
              </div>
              <Clock className="w-6 h-6 text-blue-500 opacity-80" />
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Late</span>
              <span className="text-xl font-black">{lateCount}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <input
              type="search"
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              placeholder="Search student or roll number..."
              className="w-full sm:w-72 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Admission #</th>
                  <th className="py-3 px-4 text-center">Attendance Status</th>
                  <th className="py-3 px-4">Notes / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingDaily ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Loading class attendance roster...
                    </td>
                  </tr>
                ) : roster.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No enrolled students found in this class.
                    </td>
                  </tr>
                ) : (
                  roster.filter((student) =>
                    `${student.name} ${student.rollNo} ${student.admissionNo}`.toLowerCase().includes(attendanceSearch.toLowerCase())
                  ).map((student) => (
                    <tr key={student.studentId} className={`hover:bg-slate-50/60 ${
                      student.status === 'Unmarked' ? 'bg-rose-50/60 ring-1 ring-inset ring-rose-200' : ''
                    }`}>
                      <td className="py-3 px-4 font-bold text-slate-900">{student.rollNo}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{student.name}</span>
                          {student.isNewStudent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              New Student
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-medium">{student.admissionNo}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, 'Present')}
                            disabled={monthFinalized || student.leaveLocked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              student.status === 'Present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, 'Absent')}
                            disabled={monthFinalized || student.leaveLocked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              student.status === 'Absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, 'Late')}
                            disabled={monthFinalized || student.leaveLocked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              student.status === 'Late'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                            }`}
                          >
                            Late
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, 'OnLeave')}
                            disabled={monthFinalized || student.leaveLocked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              student.status === 'Leave' || student.status === 'OnLeave'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                            title={student.leaveLocked ? 'Locked approved leave' : undefined}
                          >
                            On Leave{student.leaveLocked ? ' (Locked)' : ''}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          disabled={monthFinalized}
                          value={student.remarks || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRoster((prev) =>
                              prev.map((item) =>
                                item.studentId === student.studentId ? { ...item, remarks: val } : item
                              )
                            );
                          }}
                          placeholder="Optional note..."
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
          )}
        </div>
      )}

      {/* TAB 2: MONTHLY ATTENDANCE REPORT */}
      {activeTab === 'history' && isTeacher && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800">Attendance history</h2>
            <p className="text-xs text-slate-500 mt-1">Class attendance sheets for your assigned class.</p>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No attendance history found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((sheet) => (
                <button
                  key={sheet._id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(sheet.date);
                    setActiveTab('daily');
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 text-left"
                >
                  <span className="text-sm font-bold text-slate-800">{sheet.date}</span>
                  <span className="text-xs text-slate-500">{sheet.records?.length || 0} students</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Monthly Roll Report: {selectedMonth}</h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {isTeacher && isSelectedClassTeacher
                  ? `Combined class attendance · ${monthlyData
                    ? `${monthlyData.isFinalized ? 'Locked' : 'Open'} · Present student-days: ${totalPresentDays} / ${expectedAttendanceDays}${classAttendancePercentage == null ? '' : ` · ${classAttendancePercentage}%`}`
                    : loadingMonthly ? 'Loading lock status' : 'Lock status unavailable'}`
                  : `Present student-days / expected student-days: ${totalPresentDays} / ${expectedAttendanceDays}${classAttendancePercentage == null ? '' : ` · ${classAttendancePercentage}%`}`}
                {!isSelectedClassTeacher && monthlyData?.isFinalized ? ' · Concluded and locked' : ''}
              </p>
            </div>
            {!(isTeacher && isSelectedClassTeacher) && (
              <span className="text-xs text-slate-500">
                Total Students Evaluated: {monthlyData?.totalStudents || 0}
              </span>
            )}
            <div className="flex gap-2">
              {isSelectedClassTeacher && monthlyData && !loadingMonthly && !monthlyData.isFinalized && (
                <button onClick={handleConcludeAttendance} disabled={loadingMonthly} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                  Conclude Month
                </button>
              )}
              {(isAdmin || isSelectedClassTeacher) && monthlyData?.isFinalized && (!isSelectedClassTeacher || !loadingMonthly) && (
                <button onClick={handleUnlockAttendance} disabled={loadingMonthly && isSelectedClassTeacher} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">
                  Unlock Month
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3 text-center">Present</th>
                  <th className="py-3 px-3 text-center">Absent</th>
                  <th className="py-3 px-3 text-center">Leave</th>
                  <th className="py-3 px-3 text-center">Total Present Days</th>
                  <th className="py-3 px-3 text-center">Total Absent Days</th>
                  <th className="py-3 px-3 text-center">Total Leaves</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                  <th className="py-3 px-4 text-center">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isTeacher && isSelectedClassTeacher && !loadingMonthly && monthlyData?.report?.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-500">No attendance records found for this class and month.</td></tr>
                ) : isTeacher && !isSelectedClassTeacher && !subjectsLoading && assignedSubjects.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-500">No subjects for this class.</td></tr>
                ) : isTeacher && !isSelectedClassTeacher && !selectedSubject ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-500">Select one of your subjects to view its attendance report.</td></tr>
                ) : loadingMonthly ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Computing monthly attendance statistics...
                    </td>
                  </tr>
                ) : !monthlyData?.report || monthlyData.report.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No attendance data found for this month.
                    </td>
                  </tr>
                ) : (
                  monthlyData.report.map((item: any) => (
                    <tr key={item.studentId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.rollNo}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.isNewStudent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              New Student
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        {item.presentDays}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-rose-600">
                        {item.absentDays}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-blue-600">
                        {item.leaveDays}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-emerald-700">{item.presentDays}</td>
                      <td className="py-3 px-3 text-center font-medium text-rose-700">{item.absentDays}</td>
                      <td className="py-3 px-3 text-center font-medium text-blue-700">{item.leaveDays}</td>
                      <td className="py-3 px-4 text-center font-black text-slate-900">
                        {item.totalDays === 0 || item.percentage == null ? '—' : `${item.percentage}%`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.isNewStudent ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            New Student
                          </span>
                        ) : item.totalDays === 0 || item.percentage == null ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                            No records
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              item.percentage >= 85
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.percentage >= 75
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.percentage >= 85
                              ? 'Excellent'
                              : item.percentage >= 75
                              ? 'Adequate'
                              : 'Critical Deficit'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
