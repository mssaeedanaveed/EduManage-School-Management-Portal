import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, ChevronRight, Search, Users } from 'lucide-react';
import api from '../api/axios.js';

type Level = 'classes' | 'students' | 'months' | 'month' | 'week';

const statusClass = (status: string) => {
  if (status === 'Present') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'Absent') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'Leave') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
};

export default function AdminAttendance() {
  const [level, setLevel] = useState<Level>('classes');
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [monthDetail, setMonthDetail] = useState<any>(null);
  const [weekDetail, setWeekDetail] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/attendance/admin/classes');
      setClasses(response.data.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not load classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadClasses(); }, []);

  const loadStudents = async (classInfo: any, query = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/attendance/admin/classes/${classInfo._id}/students`, { params: { search: query } });
      setStudents(response.data.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not load students.');
    } finally {
      setLoading(false);
    }
  };

  const chooseClass = (classInfo: any) => {
    setSelectedClass(classInfo);
    setLevel('students');
    setSearch('');
    void loadStudents(classInfo);
  };

  const chooseStudent = async (student: any) => {
    setSelectedStudent(student);
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/attendance/admin/students/${student._id}/months`);
      setMonths(response.data.data || []);
      setLevel('months');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not load attendance months.');
    } finally {
      setLoading(false);
    }
  };

  const chooseMonth = async (month: string) => {
    setSelectedMonth(month);
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/attendance/admin/students/${selectedStudent._id}/months/${month}`);
      setMonthDetail(response.data.data);
      setLevel('month');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not load month details.');
    } finally {
      setLoading(false);
    }
  };

  const chooseWeek = async (weekStart: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/attendance/admin/students/${selectedStudent._id}/weeks/${weekStart}`);
      setWeekDetail(response.data.data);
      setLevel('week');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not load week details.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (level === 'week') setLevel('month');
    if (level === 'month') setLevel('months');
    if (level === 'months') setLevel('students');
    if (level === 'students') setLevel('classes');
  };

  const filteredStudents = useMemo(() => students, [students]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
          <CalendarCheck className="h-6 w-6 text-indigo-600" />
          Attendance
        </h1>
        <p className="mt-1 text-xs text-slate-500">Read-only attendance recorded by class teachers.</p>
      </header>

      {level !== 'classes' && (
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => setLevel('classes')} className="font-bold hover:text-indigo-700">Classes</button>
        {selectedClass && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => setLevel('students')} className="font-bold hover:text-indigo-700">{selectedClass.name} - {selectedClass.section}</button></>}
        {selectedStudent && level !== 'students' && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => setLevel('months')} className="font-bold hover:text-indigo-700">{selectedStudent.name}</button></>}
        {level === 'month' || level === 'week' ? <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => setLevel('month')} className="font-bold hover:text-indigo-700">{monthDetail?.monthName} {monthDetail?.year}</button></> : null}
        {level === 'week' && <><ChevronRight className="h-3 w-3" /><span className="font-bold text-slate-700">Week {weekDetail?.week}</span></>}
      </nav>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Loading attendance...</div>}

      {!loading && level === 'classes' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((classInfo) => (
            <button key={classInfo._id} type="button" onClick={() => chooseClass(classInfo)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:border-indigo-300 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Users className="h-5 w-5" /></div>
                <div><p className="font-black text-slate-800">{classInfo.name}</p><p className="text-xs text-slate-500">Section {classInfo.section}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && level === 'students' && (
        <div className="space-y-4">
          <div className="relative max-w-md flex items-center gap-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadStudents(selectedClass, search); }} placeholder="Search by name or roll number" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600" />
            <button type="button" onClick={() => void loadStudents(selectedClass, search)} className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Search</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3 text-right">Overall</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredStudents.map((student) => (
                <tr key={student._id} className="cursor-pointer hover:bg-slate-50" onClick={() => void chooseStudent(student)}>
                  <td className="px-4 py-3 font-bold text-slate-900">{student.rollNo}</td><td className="px-4 py-3 font-bold text-slate-800">{student.name}</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-700">{student.attendancePercentage == null ? '—' : `${student.attendancePercentage}%`}</td>
                  <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && level === 'months' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((month) => (
            <button key={month.month} type="button" onClick={() => void chooseMonth(month.month)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-indigo-300">
              <p className="font-black text-slate-800">{month.monthName} {month.year}</p><p className="mt-2 text-xs text-slate-500">{month.summary}</p><p className="mt-1 text-xs font-bold text-indigo-700">{month.percentage == null ? 'No marked days' : `${month.percentage}% attendance`}</p>
            </button>
          ))}
          {months.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No marked attendance months.</p>}
        </div>
      )}

      {!loading && level === 'month' && monthDetail && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            {[['Present', monthDetail.present, 'emerald'], ['Absent', monthDetail.absent, 'rose'], ['Leave', monthDetail.leave, 'blue'], ['School days marked', monthDetail.totalSchoolDaysMarked, 'slate'], ['Percentage', monthDetail.percentage == null ? '—' : `${monthDetail.percentage}%`, 'indigo']].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className={`mt-1 text-xl font-black text-${color}-700`}>{value}</p></div>
            ))}
          </div>
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{monthDetail.statusLabel}</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {monthDetail.weeks.map((week: any) => (
              <button key={week.week} type="button" onClick={() => void chooseWeek(week.weekStart)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-300">
                <div className="flex items-center justify-between"><p className="font-black text-slate-800">{week.label}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{week.statusLabel}</span></div>
                <p className="mt-2 text-xs text-slate-500">{week.summary}</p><p className="mt-1 text-[10px] text-slate-400">{week.marked} days marked</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && level === 'week' && weekDetail && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div><h2 className="font-black text-slate-800">Week {weekDetail.week}</h2><p className="text-xs text-slate-500">{weekDetail.summary}</p></div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{weekDetail.statusLabel}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Day</th><th className="px-4 py-3 text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{weekDetail.days.map((day: any) => (
                <tr key={day.date}><td className="px-4 py-3 font-bold text-slate-800">{day.date}</td><td className="px-4 py-3 text-slate-600">{day.dayName}</td><td className="px-4 py-3 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(day.status)}`}>{day.status}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
