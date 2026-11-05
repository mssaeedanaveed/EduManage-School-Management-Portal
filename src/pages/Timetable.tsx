import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Clock, MapPin, User, AlertCircle, Filter, GraduationCap } from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import { ITimetableSlot, IClass, ISubject, ITeacher } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export const Timetable: React.FC = () => {
  const { user, profile } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';

  const [classes, setClasses] = useState<IClass[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [slots, setSlots] = useState<ITimetableSlot[]>([]);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const adminTeacherView = isAdmin && Boolean(selectedTeacher);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [clashes, setClashes] = useState<any[]>([]);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newSlot, setNewSlot] = useState({
    day: 'Monday' as (typeof DAYS)[number],
    period: 1,
    startTime: '08:30',
    endTime: '09:15',
    subjectId: '',
    teacherId: '',
    roomNo: 'Room 201',
  });

  const fetchInitial = async () => {
    setLoadError('');
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/api/classes'),
        api.get('/api/subjects'),
      ]);
      if (cRes.data?.success && cRes.data.data.length > 0) {
        setClasses(cRes.data.data);
      }
      if (sRes.data?.success) setSubjects(sRes.data.data);
      if (isAdmin) {
        const tRes = await api.get('/api/teachers');
        if (tRes.data?.success) setTeachers(tRes.data.data);
      }

      if (isStudent) {
        // Fetch student's current profile to get latest classId
        const dashRes = await api.get('/api/dashboard/stats');
        if (dashRes.data?.data?.student?.classId) {
          setSelectedClass(dashRes.data.data.student.classId);
        } else if (cRes.data?.data?.length > 0) {
          setSelectedClass(cRes.data.data[0]._id);
        }
      } else if (isParent) {
        const dashRes = await api.get('/api/dashboard/stats');
        if (dashRes.data?.data?.children?.length > 0) {
          setParentChildren(dashRes.data.data.children);
          setSelectedClass(dashRes.data.data.children[0].student.classId);
        }
      } else if (!selectedClass && cRes.data?.data?.length > 0) {
        setSelectedClass(cRes.data.data[0]._id);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Could not load timetable setup data. Please refresh and try again.');
    }
  };

  useEffect(() => {
    fetchInitial();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    void api.get('/api/timetable/clashes').then((res) => {
      if (res.data?.success) setClashes(res.data.data || []);
    });
  }, [isAdmin, slots]);

  useEffect(() => {
    if (!isAdmin || !selectedClass) {
      setSubjects([]);
      return;
    }
    void api.get('/api/subjects', { params: { classId: selectedClass } }).then((res) => {
      if (res.data?.success) setSubjects(res.data.data || []);
    });
  }, [isAdmin, selectedClass]);

  const fetchTimetable = async () => {
    if (!selectedClass && !isTeacher && !adminTeacherView) return;
    setLoading(true);
    setLoadError('');
    try {
      const params: any = {};
      if (adminTeacherView) {
        const res = await api.get(`/api/timetable/teacher/${selectedTeacher}`);
        if (res.data?.success) setSlots(res.data.data || []);
        return;
      }
      if (!isTeacher && selectedClass) {
        params.classId = selectedClass;
      }

      const res = await api.get('/api/timetable', { params });
      if (res.data?.success) {
        setSlots(Array.isArray(res.data.data) ? res.data.data : res.data.data?.slots || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Could not load the timetable. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass || isTeacher) {
      fetchTimetable();
    }
  }, [selectedClass, selectedTeacher]);

  useEffect(() => {
    if (!isStudent && !isParent && !isTeacher) return;
    const refresh = window.setInterval(() => { void fetchTimetable(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [isStudent, isParent, isTeacher, selectedClass]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const slotPayload = {
        ...newSlot,
        periodNo: newSlot.period,
        classId: selectedClass,
        room: newSlot.roomNo,
        academicYear: classes.find((item) => item._id === selectedClass)?.academicYear,
      };
      const conflictRes = await api.post('/api/timetable/conflicts/check', {
        ...slotPayload,
        excludeSlotId: editingSlotId || undefined,
      });
      const conflictData = conflictRes.data?.data;
      if (!conflictData?.available) {
        setErrorMsg(conflictData?.conflicts?.join('\n') || conflictRes.data?.message || 'This slot has conflicts.');
        return;
      }
      const res = editingSlotId
        ? await api.put(`/api/timetable/${editingSlotId}`, slotPayload)
        : await api.post('/api/timetable', slotPayload);
      if (res.data?.success) {
        setIsAddOpen(false);
        setEditingSlotId(null);
        await fetchTimetable();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add timetable slot');
    }
  };

  const handleEditSlot = (slot: ITimetableSlot) => {
    setEditingSlotId(slot._id);
    setNewSlot({
      day: slot.day as (typeof DAYS)[number],
      period: slot.periodNo || slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      roomNo: slot.room || slot.roomNo || '',
    });
    setErrorMsg(null);
    setIsAddOpen(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm('Remove this timetable slot?')) return;
    try {
      await api.delete(`/api/timetable/${slotId}`);
      await fetchTimetable();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete slot');
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    const subj = subjects.find((s) => s._id === subjectId);
    setNewSlot((prev) => ({
      ...prev,
      subjectId,
      teacherId: subj?.teacherId || prev.teacherId,
    }));
  };

  const downloadPdf = () => {
    const doc = new jsPDF('landscape');
    const title = adminTeacherView
      ? `${teachers.find((teacher) => teacher._id === selectedTeacher)?.name || 'Teacher'} Timetable`
      : classes.find((item) => item._id === selectedClass)
        ? `${classes.find((item) => item._id === selectedClass)?.name} - Section ${classes.find((item) => item._id === selectedClass)?.section}`
        : 'Timetable';
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Day', 'Period', 'Time', 'Subject', isTeacher || adminTeacherView ? 'Class / Section' : 'Teacher', 'Room']],
      body: sortSlots(slots).map((slot) => [
        slot.day,
        slot.periodNo || slot.period,
        `${slot.startTime}-${slot.endTime}`,
        slot.subjectName || 'Subject',
        isTeacher || adminTeacherView
          ? (() => {
              const cls = classes.find((item) => item._id === slot.classId);
              return cls ? `${cls.name} - ${cls.section}` : slot.classId;
            })()
          : slot.teacherName || 'Teacher unassigned',
        slot.room || slot.roomNo || '',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [49, 46, 129] },
    });
    doc.save(`${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-timetable.pdf`);
  };

  const sortSlots = (items: ITimetableSlot[]) => [...items].sort((a, b) =>
    DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]) ||
    (a.periodNo || a.period) - (b.periodNo || b.period)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            {isStudent ? 'My Class Schedule' : isTeacher ? 'Faculty Teaching Timetable' : 'Class Timetables & Schedules'}
          </h1>
          <p className="text-xs text-slate-500">
            {isStudent
              ? `Weekly period schedule for ${profile?.student?.className || 'your class'} (Roll: ${profile?.student?.rollNo || '—'})`
              : isTeacher
              ? `Personal timetable for ${user.name}`
              : 'Weekly period grid with automated teacher collision detection'}
          </p>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {loadError}
          </div>
        )}

        {isAdmin && clashes.length > 0 && (
          <button className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
            Clashes: {clashes.length}
          </button>
        )}
        {!isParent && (
          <button onClick={downloadPdf} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Download PDF
          </button>
        )}

        {isAdmin && !adminTeacherView && (
          <button
            onClick={() => {
              setEditingSlotId(null);
              setNewSlot({
                day: 'Monday',
                period: 1,
                startTime: '08:30',
                endTime: '09:15',
                subjectId: '',
                teacherId: '',
                roomNo: 'Room 201',
              });
              setErrorMsg(null);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class Period</span>
          </button>
        )}
      </div>

      {/* Parent Child Switcher */}
      {isParent && parentChildren.length > 1 && (
        <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
            Child Schedule:
          </span>
          {parentChildren.map((c, idx) => (
            <button
              key={c.student._id}
              onClick={() => {
                setSelectedChildIndex(idx);
                setSelectedClass(c.student.classId);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedChildIndex === idx
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.student.name} ({c.student.className})
            </button>
          ))}
        </div>
      )}

      {/* Class Selector Filter (Admins Only) */}
      {!isStudent && !isParent && !isTeacher && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <label className="text-xs font-bold text-slate-700">Display Schedule for:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            {isTeacher && <option value="">My Personal Teaching Schedule</option>}
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} - Section {c.section} ({c.roomNo})
              </option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <User className="w-4 h-4 text-slate-400" />
          <label className="text-xs font-bold text-slate-700">Teacher timetable:</label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            <option value="">Select a class timetable</option>
            {teachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
            ))}
          </select>
          {adminTeacherView && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Read-only</span>
          )}
        </div>
      )}

      {/* Empty Message if No Timetable Set */}
      {slots.length === 0 && !loading && (
        <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">{isTeacher ? 'No timetable set for you yet.' : 'No timetable set for this class yet.'}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {isTeacher
              ? 'Your weekly teaching periods will appear here once scheduled by an administrator.'
              : 'Class periods and scheduled subjects will appear here automatically once created for this class.'}
          </p>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-32 border-r border-slate-800 text-center">Day / Time</th>
                {PERIODS.map((p) => (
                  <th key={p} className="py-3 px-3 text-center border-r border-slate-800">
                    <div>Period {p}</div>
                    <div className="text-[9px] font-normal text-slate-400">
                      {slots.find((slot) => slot.period === p)
                        ? `${slots.find((slot) => slot.period === p)?.startTime} - ${slots.find((slot) => slot.period === p)?.endTime}`
                        : p === 1
                        ? '08:30 - 09:15'
                        : p === 2
                        ? '09:20 - 10:05'
                        : p === 3
                        ? '10:20 - 11:05'
                        : p === 4
                        ? '11:10 - 11:55'
                        : p === 5
                        ? '12:35 - 13:20'
                        : p === 6
                        ? '13:25 - 14:10'
                        : '14:15 - 15:00'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-slate-50/50">
                  <td className="py-4 px-4 font-black text-slate-900 bg-slate-50 border-r border-slate-200 text-center">
                    {day}
                  </td>
                  {PERIODS.map((period) => {
                    const slot = slots.find((s) => s.day === day && (s.periodNo || s.period) === period);
                    return (
                      <td
                        key={period}
                        className="p-2 border-r border-slate-200 align-top h-24 w-36"
                      >
                        {slot ? (
                          <div className="h-full p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 hover:border-indigo-400 transition-all flex flex-col justify-between group relative">
                            <div>
                              <div className="font-extrabold text-indigo-950 text-[11px] leading-tight">
                                {slot.subjectName}
                              </div>
                              {isTeacher || adminTeacherView ? (
                                <div className="text-[10px] text-slate-600 mt-1">
                                  {(() => {
                                    const cls = classes.find((item) => item._id === slot.classId);
                                    return cls ? `${cls.name} · Section ${cls.section}` : 'Class';
                                  })()}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                                  <User className="w-3 h-3 text-indigo-500" />
                                  <span className="truncate">{slot.teacherId ? slot.teacherName : 'Teacher unassigned'}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                              <span>{slot.roomNo || 'Room 201'}</span>
                              {isAdmin && !adminTeacherView && (
                                <span className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditSlot(slot)}
                                    className="text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                                    title="Edit Slot"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSlot(slot._id)}
                                    className="text-rose-500 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                                    title="Delete Slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAdmin || adminTeacherView}
                            onClick={() => {
                              setEditingSlotId(null);
                              setNewSlot((prev) => ({
                                ...prev,
                                day: day as (typeof DAYS)[number],
                                period,
                              }));
                              setErrorMsg(null);
                              setIsAddOpen(true);
                            }}
                            className="h-full w-full min-h-20 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600 flex items-center justify-center gap-1 text-[10px] disabled:pointer-events-none"
                          >
                            {isAdmin && !adminTeacherView && <><Plus className="w-3 h-3" /> Add slot</>}
                            {!isAdmin && 'Free'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add or edit a class timetable slot (Admin Only) */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setEditingSlotId(null); }}
        title={editingSlotId ? 'Edit Class Period' : 'Schedule Class Period'}
        subtitle="Double-booking validation prevents teacher or class time conflicts"
        maxWidth="md"
      >
        <form onSubmit={handleAddSlot} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Day of Week</label>
              <select
                value={newSlot.day}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, day: e.target.value as (typeof DAYS)[number] })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Period Number</label>
              <select
                value={newSlot.period}
                onChange={(e) => setNewSlot({ ...newSlot, period: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    Period {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                value={newSlot.endTime}
                onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Subject *</label>
            <select
              required
              value={newSlot.subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Select Subject...</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Assigned Teacher *</label>
            <select
              required
              value={newSlot.teacherId}
              onChange={(e) => setNewSlot({ ...newSlot, teacherId: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Select Teacher...</option>
              {teachers.filter((t) => !newSlot.subjectId || subjects.find((s) => s._id === newSlot.subjectId)?.teacherId === t._id).map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Classroom / Laboratory</label>
            <input
              type="text"
              value={newSlot.roomNo}
              onChange={(e) => setNewSlot({ ...newSlot, roomNo: e.target.value })}
              placeholder="e.g. Physics Lab or Room 204"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              {editingSlotId ? 'Save Changes' : 'Schedule Slot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Timetable;
