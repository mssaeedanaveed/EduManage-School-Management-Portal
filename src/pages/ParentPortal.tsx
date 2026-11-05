import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  CalendarCheck,
  Award,
  CreditCard,
  Clock,
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import api from '../api/axios.js';
import Badge from '../components/Badge.js';
import ReportCardPrint from '../components/ReportCardPrint.js';
import FeeVoucherPrint from '../components/FeeVoucherPrint.js';
import { useAuth } from '../context/AuthContext.js';

export const ParentPortal: React.FC = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Print state
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [voucherData, setVoucherData] = useState<any>(null);

  useEffect(() => {
    const fetchChildrenData = async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        const res = await api.get('/api/dashboard/stats');
        if (res.data?.success && res.data.data?.children) {
          setChildren(res.data.data.children);
          setLastUpdated(new Date());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void fetchChildrenData(true);
    const refresh = window.setInterval(() => { void fetchChildrenData(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [user]);

  const activeChild = children[selectedChildIndex] || children[0];

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
      <div className="p-8 text-center text-slate-400">Loading children portal records...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-amber-600" />
            Family Academic Hub
          </h1>
          <p className="text-xs text-slate-500">
            Real-time window into your children's attendance, grades, class schedules, and tuition vouchers
          </p>
        </div>

        {/* Children Switcher */}
        {children.length > 1 && (
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {children.map((c, idx) => (
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

      {lastUpdated && (
        <p className="text-right text-[11px] text-slate-400">
          Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {!activeChild && (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          No student profiles are linked to this parent account yet.
        </div>
      )}

      {activeChild && (
        <>
          {/* Child Identity Card */}
          <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center font-black text-xl text-amber-300">
                {activeChild.student.name.charAt(0)}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  Enrolled Student Profile
                </span>
                <h2 className="text-2xl font-black">{activeChild.student.name}</h2>
                <p className="text-xs text-amber-100 mt-0.5">
                  Class: {activeChild.student.className} • Roll No: {activeChild.student.rollNo} •
                  Admission: {activeChild.student.admissionNo}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeChild.latestResult && (
                <button
                  onClick={() =>
                    handleOpenReportCard(
                      activeChild.latestResult.examId,
                      activeChild.student._id
                    )
                  }
                  className="px-4 py-2 bg-white text-indigo-900 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download Report Card</span>
                </button>
              )}
              {!activeChild.latestResult && (
                <button type="button" disabled title="Available after results are entered." className="px-3.5 py-2 bg-white/30 text-white/70 font-bold text-xs rounded-xl cursor-not-allowed">
                  Available after results are entered.
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance Score</span>
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
                  {activeChild.attendanceSummary?.totalDays ?? 0} days)
                </span>
              </div>
              {activeChild.attendanceSummary?.isNewStudent && (
                <span className="mt-2 inline-flex rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 px-2.5 py-1 text-[10px] font-bold">
                  New Student
                </span>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Present {activeChild.attendanceSummary?.presentDays ?? 0} / Absent {activeChild.attendanceSummary?.absentDays ?? 0} / Approved Leave {activeChild.attendanceSummary?.leaveDays ?? 0}
              </p>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${activeChild.attendanceSummary?.percentage ?? 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Examination Rank</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">
                  {activeChild.latestResult ? `#${activeChild.latestResult.position ?? '—'}` : '—'}
                </span>
                {activeChild.latestResult && <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Grade {activeChild.latestResult.grade}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {activeChild.latestResult
                  ? `${activeChild.latestResult.examName} • ${activeChild.latestResult.percentage}%`
                  : 'No exam results yet. Your results will appear here once your teacher enters marks.'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Tuition Balance</span>
                <CreditCard className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-800">
                ${activeChild.pendingFees || 0}
              </div>
              <span
                className={`text-xs font-semibold mt-3 inline-block ${
                  activeChild.pendingFees > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {activeChild.pendingFees > 0 ? 'Monthly voucher pending' : 'Zero outstanding dues'}
              </span>
            </div>
          </div>

          {/* Child's Results List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Exam Results & Academic Evaluations
            </h3>
            <div className="divide-y divide-slate-100">
              {activeChild.results?.length ? activeChild.results.map((res: any) => (
                <div key={res._id} className="py-3.5 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-extrabold text-slate-900">{res.examName}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Total: {res.totalMarksObtained} / {res.totalMaxMarks} marks • Class Rank #{res.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {res.grade} ({res.percentage}%)
                    </span>
                    <button
                      onClick={() => handleOpenReportCard(res.examId, activeChild.student._id)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Report Card</span>
                    </button>
                  </div>
                </div>
              )) : <p className="py-4 text-center text-xs text-slate-500">No exam results yet. Your results will appear here once your teacher enters marks.</p>}
            </div>
          </div>

          {/* Child's Fee Vouchers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Tuition Fee Vouchers
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Total Payable</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeChild.vouchers?.length ? activeChild.vouchers.map((v: any) => (
                    <tr key={v._id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{v.voucherNo}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{v.month}</td>
                      <td className="py-2.5 px-3 text-slate-500">{v.dueDate}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">${v.totalDue}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">${v.amountPaid}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">${v.balance}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge status={v.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenVoucher(v.voucherNo)}
                          className="px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                        >
                          Print Bank Voucher
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={8} className="py-8 text-center text-slate-500">No fee vouchers yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Report Card Print Preview */}
      {reportCardData && (
        <ReportCardPrint data={reportCardData} onClose={() => setReportCardData(null)} />
      )}

      {/* Voucher Print Preview */}
      {voucherData && (
        <FeeVoucherPrint
          voucher={voucherData.voucher}
          breakdown={voucherData.breakdown}
          onClose={() => setVoucherData(null)}
        />
      )}
    </div>
  );
};

export default ParentPortal;
