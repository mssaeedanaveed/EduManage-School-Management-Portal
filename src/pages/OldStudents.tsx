import React, { useEffect, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import api from '../api/axios.js';

interface IOldStudent {
  _id: string;
  fullName: string;
  parentGuardianName: string;
  contactNumber: string;
  alternateNumber: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  address: string;
  admissionNo: string;
  className: string;
  dateLeft: string;
}

const OldStudents: React.FC = () => {
  const [students, setStudents] = useState<IOldStudent[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [yearLeft, setYearLeft] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/students/old', {
      params: { search, yearLeft: yearLeft || undefined, page, limit: 50 },
    }).then((res) => {
      if (!active) return;
      if (res.data?.success) {
        setStudents(res.data.data);
        setYears(res.data.years || []);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Could not load old student records.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [search, yearLeft, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Archive className="w-6 h-6 text-indigo-600" />
          Old Students
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Read-only personal records for students who have left the school.
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search by name or admission number..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <select
          value={yearLeft}
          onChange={(event) => { setYearLeft(event.target.value); setPage(1); }}
          className="sm:w-52 py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-700 font-medium"
        >
          <option value="">All years left</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-3">Admission No</th>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-3">Parent / Guardian</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Gender / DOB</th>
                <th className="py-3 px-3">Date Left</th>
                <th className="py-3 px-4">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading old student records...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="py-8 text-center text-rose-600">{error}</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">No old student records found.</td></tr>
              ) : students.map((student) => (
                <tr key={student._id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-slate-900">{student.fullName}</td>
                  <td className="py-3 px-3 font-medium text-slate-600">{student.admissionNo}</td>
                  <td className="py-3 px-3 text-slate-600">{student.className}</td>
                  <td className="py-3 px-3 text-slate-700">{student.parentGuardianName}</td>
                  <td className="py-3 px-3 text-slate-600">
                    {student.contactNumber}
                    {student.alternateNumber && <div className="text-[10px] text-slate-400">{student.alternateNumber}</div>}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{student.gender} / {student.dob}</td>
                  <td className="py-3 px-3 text-slate-600">{student.dateLeft}</td>
                  <td className="py-3 px-4 text-slate-600">{student.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {total} old student records · Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OldStudents;
