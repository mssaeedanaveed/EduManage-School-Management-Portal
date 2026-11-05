import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  BookOpen,
  CheckCircle2,
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import Badge from '../components/Badge.js';
import ReportCardPrint from '../components/ReportCardPrint.js';
import { IExam, IClass, ISubject, IStudent, IResult } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

const displayExamTerm = (term: string) => {
  if (term === 'Term 1') return '1st Term';
  if (term === 'Term 2' || term === 'Term 2 (Final)' || term === 'Final') return 'Final Term';
  return term;
};

export const Results: React.FC = () => {
  const { user, profile } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const canEnter = isTeacher;

  const [exams, setExams] = useState<IExam[]>([]);
  const [classes, setClasses] = useState<IClass[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [students, setStudents] = useState<IStudent[]>([]);
  const [results, setResults] = useState<IResult[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<Array<{
    id: string;
    examId: string;
    classId: string;
    reason: string;
    createdAt?: string;
    message: string;
    teacherName?: string;
    examName?: string;
    className?: string;
    section?: string;
  }>>([]);
  const [resultAudit, setResultAudit] = useState<Array<{
    _id: string;
    action: string;
    actorName: string;
    reason?: string;
    createdAt: string;
  }>>([]);
  const [completionTracker, setCompletionTracker] = useState<Array<{
    classId: string;
    className: string;
    section: string;
    subjectId: string;
    subjectName: string;
    teacherId: string | null;
    teacherName: string;
    status: 'Not started' | 'In progress' | 'Completed';
    entered: number;
    total: number;
    overdue: boolean;
  }>>([]);
  const [trackerClassFilter, setTrackerClassFilter] = useState('');
  const [trackerTeacherFilter, setTrackerTeacherFilter] = useState('');
  const [trackerStatusFilter, setTrackerStatusFilter] = useState('');
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [resultSearch, setResultSearch] = useState('');

  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const isCurrentClassTeacher = isTeacher &&
    classes.some((cls) => cls._id === selectedClass && cls.classTeacherId === profile?.teacher?._id);
  const selectedExamInfo = exams.find((exam) => exam._id === selectedExam);

  // Student specific personal results
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [selectedResultStudentId, setSelectedResultStudentId] = useState('');

  // Marks Entry Modal
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [targetStudent, setTargetStudent] = useState<IStudent | null>(null);
  const [subjectMarks, setSubjectMarks] = useState<
    Array<{ subjectId: string; subjectName: string; marksObtained: number | ''; maxMarks: number; grade: string; remarks: string; status: 'Present' | 'Absent' }>
  >([]);
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [savingMarks, setSavingMarks] = useState(false);

  // New Exam Modal
  const [isNewExamOpen, setIsNewExamOpen] = useState(false);
  const [newExamData, setNewExamData] = useState({
    name: '',
    term: '1st Term',
    session: '2025-2026',
    startDate: '',
    endDate: '',
    classId: '',
    subjectId: '',
    totalMarks: 100,
    passPercentage: 40,
  });

  // Report Card Printable State
  const [reportCardData, setReportCardData] = useState<any>(null);

  const fetchInitial = async (preferredExamId?: string) => {
    setLoadError('');
    try {
      const [eRes, cRes, unlockRes] = await Promise.all([
        api.get('/api/results/exams'),
        api.get('/api/classes'),
        user?.role === 'admin' ? api.get('/api/results/unlock-requests') : Promise.resolve(null),
      ]);
      if (eRes.data?.success && eRes.data.data.length > 0) {
        setExams(eRes.data.data);
        setSelectedExam(
          preferredExamId && eRes.data.data.some((exam: IExam) => exam._id === preferredExamId)
            ? preferredExamId
            : eRes.data.data[0]._id
        );
      }
      if (cRes.data?.success && cRes.data.data.length > 0) {
        setClasses(cRes.data.data);
        setSelectedClass(cRes.data.data[0]._id);
      }
      if (unlockRes?.data?.success) setUnlockRequests(unlockRes.data.data || []);
      if (user?.role === 'admin') {
        const auditRes = await api.get('/api/results/admin/audit');
        if (auditRes.data?.success) setResultAudit(auditRes.data.data || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Could not load exams and classes. Please refresh and try again.');
    }
  };

  const handleFinalizeResults = async () => {
    if (!selectedExam || !selectedClass) return;
    try {
      const res = await api.post('/api/results/finalize', { examId: selectedExam, classId: selectedClass });
      if (res.data?.success) {
        await fetchInitial(res.data.examId);
        await fetchResultsAndRoster();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to finalize class results');
    }
  };

  const handleRequestUnlock = async () => {
    const reason = window.prompt('Reason for requesting result unlock');
    if (!reason?.trim() || !selectedExam || !selectedClass) return;
    try {
      await api.post('/api/results/unlock-request', { examId: selectedExam, classId: selectedClass, reason });
      alert('Unlock request sent to administration.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send unlock request');
    }
  };

  const visibleExams = exams.filter((exam) => !exam.classId || exam.classId === selectedClass);

  useEffect(() => {
    fetchInitial();
  }, []);

  // Fetch results for teachers/admins or the current student's linked family
  const fetchResultsAndRoster = async () => {
    setLoading(true);
    try {
      if (isStudent || isParent) {
        const res = await api.get('/api/results');
        if (res.data?.success) {
          const data: IResult[] = res.data.data;
          setStudentResults(data);
          setLoadError('');
          const resultStudentId = isParent
            ? (data.some((result) => result.studentId === selectedResultStudentId)
                ? selectedResultStudentId
                : data[0]?.studentId || '')
            : '';
          if (isParent) setSelectedResultStudentId(resultStudentId);
          const personalResults = isParent
            ? data.filter((result) => result.studentId === resultStudentId)
            : data;
          if (!personalResults.some((result) => result.examId === selectedExam)) {
            setSelectedExam(personalResults[0]?.examId || '');
          }
        }
      } else {
        if (!selectedExam || !selectedClass) return;
        const [rRes, stuRes, sRes] = await Promise.all([
          api.get('/api/results', { params: { examId: selectedExam, classId: selectedClass } }),
          api.get('/api/students', { params: { classId: selectedClass } }),
          api.get('/api/subjects', { params: { classId: selectedClass } }),
        ]);
        if (rRes.data?.success) setResults(rRes.data.data);
        if (stuRes.data?.success) setStudents(stuRes.data.data);
        if (sRes.data?.success) setSubjects(sRes.data.data);
        if (user?.role === 'admin') {
          const trackerParams = new URLSearchParams({ examId: selectedExam });
          const trackerRes = await api.get(`/api/results/admin/tracker?${trackerParams.toString()}`);
          if (trackerRes.data?.success) setCompletionTracker(trackerRes.data.data || []);
          const summaryRes = await api.get('/api/results/admin/summary', {
            params: { examId: selectedExam, classId: selectedClass },
          });
          if (summaryRes.data?.success) setAdminSummary(summaryRes.data);
        }
        setLoadError('');
      }
    } catch (e) {
      console.error(e);
      setLoadError('Could not load results for the selected class and exam.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResultsAndRoster();
  }, [selectedExam, selectedClass, isStudent, isParent, selectedResultStudentId]);

  useEffect(() => {
    if (!isStudent && !isParent) return;
    const refresh = window.setInterval(fetchResultsAndRoster, 15000);
    return () => window.clearInterval(refresh);
  }, [selectedExam, selectedClass, isStudent, isParent, selectedResultStudentId]);

  const handleOpenMarksEntry = (student: IStudent) => {
    setTargetStudent(student);
    const existing = results.find((r) => r.studentId === student._id);
    const editableSubjects = isTeacher && !(isCurrentClassTeacher && selectedExamInfo?.isFinal)
      ? subjects.filter((subject) =>
          subject.teacherId === profile?.teacher?._id &&
          (!selectedExamInfo?.subjectId || subject._id === selectedExamInfo.subjectId)
        )
      : subjects;

    if (existing && existing.marks?.length > 0) {
      setSubjectMarks(
        existing.marks.filter((mark) =>
          !isTeacher || editableSubjects.some((subject) => subject._id === mark.subjectId)
        ).map((m) => ({
          subjectId: m.subjectId,
          subjectName: m.subjectName,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks || 100,
          grade: m.grade || 'A',
          remarks: m.remarks || '',
          status: m.status || 'Present',
        }))
      );
      setTeacherRemarks(existing.teacherRemarks || '');
    } else {
      const initial = editableSubjects.map((s) => ({
        subjectId: s._id,
        subjectName: s.name,
      marksObtained: '' as const,
        maxMarks: 100,
      grade: '',
      remarks: '',
      status: 'Present' as const,
      }));
      setSubjectMarks(initial);
      setTeacherRemarks('');
    }

    setIsEntryOpen(true);
  };

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudent || !selectedExam || !selectedClass) return;
    if (subjectMarks.some((mark) => mark.status === 'Present' && mark.marksObtained === '')) {
      alert('Enter marks for every subject before saving.');
      return;
    }
    setSavingMarks(true);
    try {
      const res = await api.post('/api/results/enter', {
        examId: selectedExam,
        studentId: targetStudent._id,
        classId: selectedClass,
        marks: subjectMarks.map((mark) => ({
          ...mark,
          marksObtained: mark.status === 'Absent' ? 0 : Number(mark.marksObtained),
        })),
        teacherRemarks,
      });
      if (res.data?.success) {
        setIsEntryOpen(false);
        fetchResultsAndRoster();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save results');
    } finally {
      setSavingMarks(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/results/exams', {
        ...newExamData,
        endDate: isTeacher ? newExamData.startDate : newExamData.endDate,
      });
      if (res.data?.success) {
        setIsNewExamOpen(false);
        await fetchInitial(res.data.data?._id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create exam');
    }
  };

  const handleViewReportCard = async (examId: string, studentId: string) => {
    try {
      const res = await api.get(`/api/results/report-card/${examId}/${studentId}`);
      if (res.data?.success) {
        setReportCardData(res.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'No result available for this student yet.');
    }
  };

  // -------------------------------------------------------------
  // DEDICATED STUDENT RESULTS & REPORT CARD HUB
  // -------------------------------------------------------------
  if (isStudent || isParent) {
    const personalResults = isParent
      ? studentResults.filter((result) => result.studentId === selectedResultStudentId)
      : studentResults;
    const studentExams = exams.filter((exam) =>
      personalResults.some((result) => result.examId === exam._id)
    );
    const activeResult = personalResults.find((result) => result.examId === selectedExam) || personalResults[0];
    const activeStudentName = isParent ? activeResult?.studentName : user?.name;

    return (
      <div className="space-y-6">
        <div className="bg-linear-to-r from-cyan-700 via-indigo-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 block mb-1">
              {isParent ? 'Published Results for Your Children' : 'Official Student Academic Report'}
            </span>
            <h1 className="text-2xl font-black">{activeStudentName || user?.name}</h1>
            <p className="text-xs text-cyan-200 mt-0.5">
              Roll No: {(isParent ? activeResult?.rollNo : profile?.student?.rollNo) || '—'} • Class: {(isParent ? activeResult?.className : profile?.student?.className) || '—'}
            </p>
          </div>

          {activeResult && (
            <button
              onClick={() => handleViewReportCard(activeResult.examId, activeResult.studentId)}
              className="px-4 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-cyan-50 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Download Official Report Card (PDF)</span>
            </button>
          )}
          {!activeResult && (
            <button
              type="button"
              disabled
              title="Available after results are entered."
              className="px-4 py-2.5 bg-white/50 text-white/70 font-bold text-xs rounded-xl cursor-not-allowed"
            >
              Available after results are entered.
            </button>
          )}
        </div>
          {loadError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {loadError}
            </div>
          )}
          {/* Exam Picker Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
          {isParent && (
            <>
              <label className="text-xs font-bold text-slate-700">Select Child:</label>
              <select
                value={selectedResultStudentId}
                onChange={(e) => {
                  const studentId = e.target.value;
                  const firstResult = studentResults.find((result) => result.studentId === studentId);
                  setSelectedResultStudentId(studentId);
                  if (firstResult) setSelectedExam(firstResult.examId);
                }}
                className="py-1.5 px-3 text-xs rounded-xl border border-slate-200"
              >
                {[...new Map(studentResults.map((result) => [result.studentId, result.studentName])).entries()].map(([studentId, name]) => (
                  <option key={studentId} value={studentId}>{name || 'Student'}</option>
                ))}
              </select>
            </>
          )}
          <label className="text-xs font-bold text-slate-700">Select Examination Term:</label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="py-1.5 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            {studentExams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.name} ({ex.term})
              </option>
            ))}
          </select>
        </div>

        {activeResult ? (
          <div className="space-y-6">
            {/* 4 Score Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Marks</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {activeResult.totalMarksObtained} <span className="text-xs font-normal text-slate-400">/ {activeResult.totalMaxMarks}</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Percentage</span>
                <div className="text-2xl font-black text-indigo-700 mt-1">{activeResult.percentage}%</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall Grade</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{activeResult.grade}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Rank</span>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {activeResult.position && activeResult.totalStudentsInClass
                    ? `#${activeResult.position} / ${activeResult.totalStudentsInClass}`
                    : '—'}
                </div>
              </div>
            </div>

            {/* Subject Marks Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 text-xs">Subject-by-Subject Academic Breakdown</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Max Marks</th>
                      <th className="py-3 px-4 text-center">Marks Obtained</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4">Evaluator Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeResult.marks?.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-900">{m.subjectName}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{m.maxMarks}</td>
                        <td className="py-3 px-4 text-center font-black text-slate-900">{m.marksObtained}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {m.grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 italic">{m.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeResult.teacherRemarks && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">Teacher Remarks: </span>
                  <span className="text-slate-600 italic">"{activeResult.teacherRemarks}"</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            No exam results yet. Your results will appear here once your teacher enters marks.
          </div>
        )}

        {reportCardData && (
          <ReportCardPrint data={reportCardData} onClose={() => setReportCardData(null)} />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEACHER & ADMIN MARKS ENTRY
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            Examinations & Academic Results
          </h1>
          <p className="text-xs text-slate-500">
            Enter subject marks, auto-compute ranks and letter grades, and export official report cards
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => {
              const assignedClassSubject = subjects.find((subject) =>
                subject.classId === selectedClass && subject.teacherId === profile?.teacher?._id
              );
              setNewExamData((current) => ({
                ...current,
                classId: isTeacher ? selectedClass : '',
                subjectId: isTeacher ? assignedClassSubject?._id || '' : '',
                startDate: '',
                endDate: '',
              }));
              setIsNewExamOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Examination</span>
          </button>
        )}
      </div>

      {user?.role === 'admin' && (
          <>
            {unlockRequests.length > 0 && (
              <div className="mb-4 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-black text-amber-900">Pending Result Unlock Requests</p>
                <div className="space-y-2">
                  {unlockRequests.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3">
                      <div className="min-w-[220px] flex-1">
                        <p className="text-xs font-bold text-slate-800">{request.message}</p>
                        <p className="mt-1 text-[11px] text-slate-600">{request.teacherName} • {request.examName} • {request.className} - Section {request.section}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Reason: {request.reason}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{request.createdAt ? new Date(request.createdAt).toLocaleString() : ''}</p>
                      </div>
                      <button type="button" onClick={async () => {
                        await api.post('/api/results/unlock-request/decision', { examId: request.examId, classId: request.classId, approved: true, notificationId: request.id });
                        await fetchInitial();
                      }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>
                      <button type="button" onClick={async () => {
                        await api.post('/api/results/unlock-request/decision', { examId: request.examId, classId: request.classId, approved: false, notificationId: request.id });
                        await fetchInitial();
                      }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Deny</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {resultAudit.length > 0 && (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-black text-slate-800">Result Audit History</p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {resultAudit.map((entry) => (
                    <div key={entry._id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-xs">
                      <span className="font-black capitalize text-slate-700">{entry.action.replaceAll('_', ' ')}</span>
                      <span className="text-slate-500">by {entry.actorName}</span>
                      <span className="ml-auto text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                      {entry.reason && <span className="w-full text-slate-500">Reason: {entry.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleExams.map((exam) => {
              const today = new Date().toISOString().slice(0, 10);
              const status = today < exam.startDate ? 'Upcoming' : today > exam.endDate ? 'Completed' : 'Ongoing';
              const examResults = results.filter((result) => result.examId === exam._id);
              const totalStudents = students.length;
              const completed = totalStudents > 0 ? Math.round((examResults.length / totalStudents) * 100) : 0;
              const submitted = totalStudents > 0 && examResults.length === totalStudents &&
                examResults.every((result) => result.published);
              const classPublished = submitted && examResults.every((result) => result.portalPublished);
              return (
                <div key={exam._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-800">{exam.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{displayExamTerm(exam.term)} • {exam.session}</p>
                    </div>
                    <Badge status={exam.published ? 'Published' : 'Unpublished'} />
                  </div>
                  <p className="mt-3 text-xs text-slate-600">{exam.startDate} to {exam.endDate}</p>
                  <p className="mt-1 text-xs font-bold text-slate-700">{status} • Pass: {exam.passPercentage ?? 40}%</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-indigo-600" style={{ width: `${completed}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">Results completion: {completed}%</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={async () => {
                      const name = window.prompt('Exam name', exam.name)?.trim();
                      const startDate = window.prompt('Start date (YYYY-MM-DD)', exam.startDate)?.trim();
                      const endDate = window.prompt('End date (YYYY-MM-DD)', exam.endDate)?.trim();
                      const passPercentage = window.prompt('Pass percentage', String(exam.passPercentage ?? 40))?.trim();
                      if (!name || !startDate || !endDate || !passPercentage) return;
                      try {
                        await api.put(`/api/results/exams/${exam._id}`, { ...exam, name, startDate, endDate, passPercentage: Number(passPercentage) });
                        await fetchInitial(exam._id);
                      } catch (err: any) {
                        alert(err.response?.data?.message || 'Failed to update exam');
                      }
                    }} className="rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-700">Edit</button>
                    <button type="button" onClick={async () => {
                      if (!window.confirm(`Delete ${exam.name}?`)) return;
                      try { await api.delete(`/api/results/exams/${exam._id}`); await fetchInitial(); }
                      catch (err: any) { alert(err.response?.data?.message || 'Failed to delete exam'); }
                    }} className="rounded-lg bg-rose-50 px-3 py-1.5 font-bold text-rose-700">Delete</button>
                    <button type="button" onClick={async () => {
                      const publishing = !classPublished;
                      if (publishing && !window.confirm(`Publish ${exam.name} results for ${classes.find((item) => item._id === selectedClass)?.name || 'this class'}?`)) return;
                      await api.post(`/api/results/exams/${exam._id}/publish`, { published: publishing, classId: selectedClass });
                      await fetchInitial(exam._id);
                    }} disabled={!selectedClass || (!submitted && !classPublished)} className="ml-auto rounded-lg bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                      {classPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {loadError}
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h2 className="text-sm font-black text-slate-800">Marks Completion Tracker</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <select value={trackerClassFilter} onChange={(event) => setTrackerClassFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">
              <option value="">All classes</option>
              {classes.map((item) => <option key={item._id} value={item._id}>{item.name} - Section {item.section}</option>)}
            </select>
            <select value={trackerTeacherFilter} onChange={(event) => setTrackerTeacherFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">
              <option value="">All teachers</option>
              {[...new Map(completionTracker.map((row) => [row.teacherId, row])).values()].filter((row) => row.teacherId).map((row) => (
                <option key={row.teacherId!} value={row.teacherId!}>{row.teacherName}</option>
              ))}
            </select>
            <select value={trackerStatusFilter} onChange={(event) => setTrackerStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">
              <option value="">All statuses</option>
              <option>Not started</option>
              <option>In progress</option>
              <option>Completed</option>
            </select>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr><th className="px-3 py-2">Class / Section</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Assigned teacher</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Marks entered</th></tr>
              </thead>
              <tbody className="divide-y">
                {completionTracker.filter((row) =>
                  (!trackerClassFilter || row.classId === trackerClassFilter) &&
                  (!trackerTeacherFilter || row.teacherId === trackerTeacherFilter) &&
                  (!trackerStatusFilter || row.status === trackerStatusFilter)
                ).map((row) => (
                  <tr key={`${row.classId}-${row.subjectId}`} className={row.overdue ? 'bg-rose-50' : ''}>
                    <td className="px-3 py-2 font-bold">{row.className} - Section {row.section}{row.overdue && <span className="ml-2 text-rose-600">Overdue</span>}</td>
                    <td className="px-3 py-2">{row.subjectName}</td>
                    <td className="px-3 py-2">{row.teacherName}</td>
                    <td className="px-3 py-2 font-bold">{row.status}</td>
                    <td className="px-3 py-2 font-black">{row.entered}/{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user?.role === 'admin' && adminSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black text-slate-800">Class Results</h2>
            <input
              type="search"
              value={resultSearch}
              onChange={(event) => setResultSearch(event.target.value)}
              placeholder="Search name or roll number"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          {!adminSummary.submitted ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">{adminSummary.message}</p>
              {adminSummary.pendingSubjects?.length > 0 && (
                <p className="mt-1">Pending subjects: {adminSummary.pendingSubjects.join(', ')}</p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ['Class average', `${adminSummary.summary.overallPercentage}%`],
                  ['Students', adminSummary.summary.totalStudents],
                  ['Passed', adminSummary.summary.passCount],
                  ['Failed', adminSummary.summary.failCount],
                  ['Highest', `${adminSummary.summary.highestPercentage}%`],
                  ['Lowest', `${adminSummary.summary.lowestPercentage}%`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {adminSummary.students.filter((student: any) => student.position >= 1 && student.position <= 3).map((student: any) => (
                  <div key={student.studentId} className={`rounded-xl border p-3 ${student.position === 1 ? 'border-amber-300 bg-amber-50' : 'border-indigo-200 bg-indigo-50'}`}>
                    <p className="text-xs font-black text-slate-800">{student.position === 1 ? '1st' : student.position === 2 ? '2nd' : '3rd'} • {student.name}</p>
                    <p className="mt-1 text-[11px] text-slate-600">Roll {student.rollNo} • {student.percentage}%</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Rank</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Roll no.</th><th className="px-3 py-2">Percentage</th><th className="px-3 py-2">Result</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {adminSummary.students.filter((student: any) =>
                      !resultSearch.trim() ||
                      student.name.toLowerCase().includes(resultSearch.trim().toLowerCase()) ||
                      student.rollNo.toLowerCase().includes(resultSearch.trim().toLowerCase())
                    ).map((student: any) => (
                      <tr key={student.studentId}>
                        <td className="px-3 py-2 font-black">{student.position}</td>
                        <td className="px-3 py-2 font-bold">{student.name}</td>
                        <td className="px-3 py-2">{student.rollNo}</td>
                        <td className="px-3 py-2 font-black">{student.percentage}%</td>
                        <td className="px-3 py-2"><Badge status={student.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Selector Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Examination Term
          </label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            {visibleExams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.name} ({ex.term})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Academic Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} - Section {c.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isCurrentClassTeacher && selectedExam && !selectedExamInfo?.isFinal && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-auto text-xs text-slate-500">
            {(() => {
              const pendingSubjects = subjects.filter((subject) =>
                students.some((student) =>
                  !results.some((result) =>
                    result.studentId === student._id &&
                    result.marks.some((mark) => mark.subjectId === subject._id)
                  )
                )
              );
              return pendingSubjects.length > 0
                ? `Pending marks: ${pendingSubjects.map((subject) => subject.name).join(', ')}`
                : 'All enrolled students have marks for every subject.';
            })()}
          </div>
          <button
            onClick={handleFinalizeResults}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
          >
            Finalize & Publish Class Results
          </button>
          {results.some((result) => result.locked) && (
            <button
              onClick={handleRequestUnlock}
              className="ml-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700"
            >
              Request Unlock
            </button>
          )}
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">Roll No</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-3 text-center">Marks Obtained</th>
              <th className="py-3 px-3 text-center">Percentage</th>
              <th className="py-3 px-3 text-center">Grade</th>
              <th className="py-3 px-3 text-center">Class Rank</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Loading class grades and evaluation data...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No students in this class.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const res = results.find((r) => r.studentId === student._id);
                return (
                  <tr key={student._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{student.rollNo}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-800">{student.name}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {res ? `${res.totalMarksObtained} / ${res.totalMaxMarks}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-indigo-700">
                      {res ? `${res.percentage}%` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {res ? (
                        <span className="px-2.5 py-0.5 rounded font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {res.grade}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {res?.position ? (
                        <span className="font-bold text-amber-600">#{res.position}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user?.role !== 'admin' && canEnter && (!res?.published || (isCurrentClassTeacher && selectedExamInfo?.isFinal)) && (
                          <button
                            onClick={() => handleOpenMarksEntry(student)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {res ? 'Edit Marks' : 'Enter Marks'}
                          </button>
                        )}
                        {user?.role !== 'admin' && res && (res.published || isCurrentClassTeacher) && (
                          <button
                            onClick={() => handleViewReportCard(selectedExam, student._id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Report Card</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Enter Marks for Student */}
      <Modal
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        title={`Enter Marks: ${targetStudent?.name}`}
        subtitle={`Class: ${targetStudent?.className} • Roll No: ${targetStudent?.rollNo}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveMarks} className="space-y-4 text-xs">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Max Marks</th>
                  <th className="py-2.5 px-3">Marks Obtained</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Subject Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectMarks.map((m, idx) => (
                  <tr key={m.subjectId}>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{m.subjectName}</td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={m.maxMarks}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSubjectMarks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, maxMarks: val } : item))
                          );
                        }}
                        className="w-20 px-2 py-1 rounded border border-slate-200 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        required
                        disabled={m.status === 'Absent'}
                        value={m.marksObtained}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setSubjectMarks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, marksObtained: val } : item
                            )
                          );
                        }}
                        className="w-20 px-2 py-1 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={m.status}
                        onChange={(e) => setSubjectMarks((prev) =>
                          prev.map((item, i) => i === idx ? {
                            ...item,
                            status: e.target.value as 'Present' | 'Absent',
                            marksObtained: e.target.value === 'Absent' ? '' : item.marksObtained,
                          } : item)
                        )}
                        className="rounded border border-slate-200 px-2 py-1"
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={m.remarks}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubjectMarks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, remarks: val } : item))
                          );
                        }}
                        placeholder="e.g. Good mastery"
                        className="w-full px-2 py-1 rounded border border-slate-200 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Class Teacher Overall Remarks
            </label>
            <textarea
              rows={2}
              value={teacherRemarks}
              onChange={(e) => setTeacherRemarks(e.target.value)}
              placeholder="Comments on student's overall conduct and academic strengths..."
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEntryOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingMarks}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              {savingMarks ? 'Calculating & Saving...' : 'Save & Calculate Grades'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Examination */}
      <Modal
        isOpen={isNewExamOpen}
        onClose={() => setIsNewExamOpen(false)}
        title="Schedule New Examination"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Exam Name *</label>
            <input
              type="text"
              required
              value={newExamData.name}
              onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
              placeholder="e.g. Annual Final Exam 2026"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Term *</label>
              <select
                required
                value={newExamData.term}
                onChange={(e) => setNewExamData({ ...newExamData, term: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option>1st Term</option>
                <option>2nd Term</option>
                <option>Final Term</option>
                <option>Other</option>
              </select>
            </div>
            {!isTeacher && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pass Percentage *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={newExamData.passPercentage}
                  onChange={(e) => setNewExamData({ ...newExamData, passPercentage: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Session</label>
              <input
                type="text"
                required
                pattern="\d{4}-\d{4}"
                title="Use session format YYYY-YYYY"
                value={newExamData.session}
                onChange={(e) => setNewExamData({ ...newExamData, session: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">{isTeacher ? 'Exam Date *' : 'Start Date *'}</label>
              <input
                type="date"
                required
                value={newExamData.startDate}
                onChange={(e) => setNewExamData({ ...newExamData, startDate: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            {!isTeacher && <div>
              <label className="block font-bold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={newExamData.endDate}
                onChange={(e) => setNewExamData({ ...newExamData, endDate: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>}
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewExamOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Create Exam
            </button>
          </div>
        </form>
      </Modal>

      {/* Report Card Print Preview */}
      {reportCardData && (
        <ReportCardPrint data={reportCardData} onClose={() => setReportCardData(null)} />
      )}
    </div>
  );
};

export default Results;
