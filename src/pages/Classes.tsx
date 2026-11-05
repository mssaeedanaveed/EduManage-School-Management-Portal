import React, { useEffect, useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Users, BookOpen, DoorOpen, X, Search, Filter } from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import { IClass, ISubject, ITeacher } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import TeacherClassWorkspace from './TeacherClassWorkspace.js';

type ClassFormData = {
  name: string;
  section: string;
  roomNo: string;
  capacity: string;
  classTeacherId: string;
  academicYear: string;
  subjectIds: string[];
  newSubjects: string[];
};

const emptyForm: ClassFormData = {
  name: '',
  section: 'A',
  roomNo: '',
  capacity: '35',
  classTeacherId: '',
  academicYear: '2026-2027',
  subjectIds: [],
  newSubjects: [],
};

const AdminClasses: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [classes, setClasses] = useState<IClass[]>([]);
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<IClass | null>(null);
  const [formData, setFormData] = useState<ClassFormData>(emptyForm);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classResponse, subjectResponse] = await Promise.all([
        api.get('/api/classes'),
        api.get('/api/subjects'),
      ]);
      if (classResponse.data?.success) setClasses(classResponse.data.data);
      if (subjectResponse.data?.success) setSubjects(subjectResponse.data.data);
    } catch (error) {
      console.error('[Classes] Failed to load class directory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const loadAvailableTeachers = async (classId?: string) => {
    try {
      const response = await api.get('/api/classes/available-teachers', {
        params: classId ? { excludeClassId: classId } : undefined,
      });
      if (response.data?.success) setTeachers(response.data.data);
    } catch (error) {
      console.error('[Classes] Failed to load available class teachers:', error);
      setFormError('Could not load available class teachers. Please close and reopen the form.');
    }
  };

  const openCreate = () => {
    setSelectedClass(null);
    setFormData({ ...emptyForm, subjectIds: [], newSubjects: [] });
    setNewSubjectName('');
    setFormError('');
    setIsCreateOpen(true);
    void loadAvailableTeachers();
  };

  const handleOpenEdit = (classInfo: IClass) => {
    setSelectedClass(classInfo);
    setFormData({
      name: classInfo.name,
      section: classInfo.section,
      roomNo: classInfo.roomNo || '',
      capacity: String(classInfo.capacity),
      classTeacherId: classInfo.classTeacherId || '',
      academicYear: classInfo.academicYear,
      subjectIds: subjects
        .filter((subject) => subject.classIds?.includes(classInfo._id) || subject.classId === classInfo._id)
        .map((subject) => subject._id)
        .filter((id) => !classInfo.subjects || classInfo.subjects.includes(id)),
      newSubjects: [],
    });
    setNewSubjectName('');
    setFormError('');
    setIsEditOpen(true);
    void loadAvailableTeachers(classInfo._id);
  };

  const addNewSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    if (formData.newSubjects.some((subject) => subject.toLowerCase() === name.toLowerCase())) {
      setFormError(`${name} is already in the new subjects list.`);
      return;
    }
    if (classScopedSubjects.some((subject) => subject.name.trim().toLowerCase() === name.toLowerCase())) {
      setFormError(`${name} is already selected from existing subjects.`);
      return;
    }
    setFormError('');
    setFormData((current) => ({ ...current, newSubjects: [...current.newSubjects, name] }));
    setNewSubjectName('');
  };

  const submitClass = async (event: React.FormEvent, editing: boolean) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const roomResponse = await api.get('/api/classes/room-availability', {
        params: {
          roomNo: formData.roomNo.trim(),
          academicYear: formData.academicYear.trim(),
          ...(editing && selectedClass ? { excludeClassId: selectedClass._id } : {}),
        },
      });
      if (!roomResponse.data?.available) {
        setFormError(roomResponse.data?.message || 'This room is already occupied.');
        return;
      }

      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
        newSubjects: formData.newSubjects,
      };
      if (editing && selectedClass) {
        await api.put(`/api/classes/${selectedClass._id}`, payload);
        setIsEditOpen(false);
      } else {
        await api.post('/api/classes', payload);
        setIsCreateOpen(false);
      }
      await fetchData();
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to save class. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (classInfo: IClass) => {
    if (!window.confirm(`Delete ${classInfo.name} - Section ${classInfo.section}?`)) return;
    try {
      await api.delete(`/api/classes/${classInfo._id}?confirm=true`);
      await fetchData();
    } catch (error: any) {
      const blockers = error.response?.data?.blockers as string[] | undefined;
      const message = error.response?.data?.message || 'Failed to delete class';
      alert(blockers?.length ? `${message}\n\n${blockers.map((blocker) => `- ${blocker}`).join('\n')}` : message);
    }
  };

  const filteredClasses = classes.filter((classInfo) => {
    const query = classSearch.trim().toLowerCase();
    return (!query || classInfo.name.toLowerCase().includes(query)) &&
      (!sectionFilter || classInfo.section.toLowerCase() === sectionFilter.toLowerCase()) &&
      (!academicYearFilter || classInfo.academicYear === academicYearFilter);
  });
  const availableSections = [...new Set(classes.map((classInfo) => classInfo.section))].sort((a, b) => a.localeCompare(b));
  const availableAcademicYears = [...new Set(classes.map((classInfo) => classInfo.academicYear))].sort((a, b) => b.localeCompare(a));
  const classScopedSubjects = subjects.filter((subject) => {
    if (subject.classGroupKey === `${formData.name.trim().toLowerCase()}::${formData.academicYear.trim().toLowerCase()}`) return true;
    const subjectClasses = (subject.classIds || [subject.classId])
      .map((classId) => classes.find((classInfo) => classInfo._id === classId))
      .filter(Boolean);
    return subjectClasses.some((classInfo) =>
      classInfo!.name.trim().toLowerCase() === formData.name.trim().toLowerCase() &&
      classInfo!.academicYear.trim().toLowerCase() === formData.academicYear.trim().toLowerCase()
    );
  });

  const renderClassForm = (editing: boolean) => (
    <form onSubmit={(event) => void submitClass(event, editing)} className="space-y-4 text-xs">
      {formError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          {formError}
        </div>
      )}
      <div>
        <label className="mb-1 block font-bold text-slate-700">Class Name *</label>
        <input
          required
          type="text"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          placeholder="e.g. Class 5"
          className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block font-bold text-slate-700">Section *</label>
          <input
            required
            type="text"
            value={formData.section}
            onChange={(event) => setFormData({ ...formData, section: event.target.value })}
            placeholder="A"
            className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <div>
          <label className="mb-1 block font-bold text-slate-700">Room No *</label>
          <input
            required
            type="text"
            value={formData.roomNo}
            onChange={(event) => setFormData({ ...formData, roomNo: event.target.value })}
            placeholder="Room 201"
            className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block font-bold text-slate-700">Max Capacity *</label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={formData.capacity}
            onChange={(event) => setFormData({ ...formData, capacity: event.target.value })}
            className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <div>
          <label className="mb-1 block font-bold text-slate-700">Academic Year *</label>
          <input
            required
            type="text"
            pattern="[0-9]{4}-[0-9]{4}"
            title="Use the format YYYY-YYYY, for example 2026-2027."
            value={formData.academicYear}
            onChange={(event) => setFormData({ ...formData, academicYear: event.target.value })}
            placeholder="2026-2027"
            className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block font-bold text-slate-700">Class Teacher *</label>
        <select
          required
          value={formData.classTeacherId}
          onChange={(event) => setFormData({ ...formData, classTeacherId: event.target.value })}
          className="w-full rounded-xl border border-slate-200 p-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="">Select an available Faculty teacher...</option>
          {teachers.map((teacher) => (
            <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.employeeId})</option>
          ))}
        </select>
        {teachers.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No unassigned class teachers are available.</p>}
      </div>
      <div>
        <label className="mb-1 block font-bold text-slate-700">Subjects * (select one or more)</label>
        <select
          multiple
          required={formData.subjectIds.length + formData.newSubjects.length === 0}
          value={formData.subjectIds}
          onChange={(event) => {
            const subjectIds = Array.from(event.target.selectedOptions, (option) => option.value);
            setFormData({ ...formData, subjectIds });
            setFormError('');
          }}
          className="h-28 w-full rounded-xl border border-slate-200 p-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          {classScopedSubjects.map((subject) => (
            <option key={subject._id} value={subject._id}>{subject.name} ({subject.code})</option>
          ))}
        </select>
        {classScopedSubjects.length === 0 && <p className="mt-1 text-[11px] text-slate-500">No class-specific subjects exist yet. Add one below.</p>}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newSubjectName}
            onChange={(event) => setNewSubjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addNewSubject();
              }
            }}
            placeholder="Type a new subject name"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <button type="button" onClick={addNewSubject} className="rounded-xl border border-indigo-200 px-3 font-bold text-indigo-700 hover:bg-indigo-50">
            Add
          </button>
        </div>
        {formData.newSubjects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {formData.newSubjects.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => setFormData({ ...formData, newSubjects: formData.newSubjects.filter((item) => item !== name) })}
                  className="text-emerald-700 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => editing ? setIsEditOpen(false) : setIsCreateOpen(false)}
          className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || teachers.length === 0}
          className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Class'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
            <Layers className="h-6 w-6 text-indigo-600" />
            Classes & Sections
          </h1>
          <p className="text-xs text-slate-500">Define grade levels, rooms, capacities, subjects, and class teachers</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            <span>Create Class</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:grid-cols-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={classSearch}
            onChange={(event) => setClassSearch(event.target.value)}
            placeholder="Search class name"
            aria-label="Search classes by name"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
            aria-label="Filter classes by section"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All sections</option>
            {availableSections.map((section) => <option key={section} value={section}>Section {section}</option>)}
          </select>
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={academicYearFilter}
            onChange={(event) => setAcademicYearFilter(event.target.value)}
            aria-label="Filter classes by academic year"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All academic years</option>
            {availableAcademicYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No classes have been created yet.</div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No classes match the selected filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((classInfo) => (
            <div key={classInfo._id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-indigo-300">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {classInfo.name}
                      <span className="ml-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">Section {classInfo.section}</span>
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <DoorOpen className="h-3.5 w-3.5" />
                      <span>{classInfo.roomNo}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenEdit(classInfo)} title="Edit Class" className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:text-amber-600">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => void handleDelete(classInfo)} title="Delete Class" className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="my-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled / Capacity</div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-lg font-black text-slate-800">
                      <Users className="h-4 w-4 text-cyan-600" />
                      <span>{classInfo.studentCount || 0}/{classInfo.capacity}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subjects</div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-lg font-black text-slate-800">
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <span>{classInfo.subjectCount || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-indigo-800">Class Teacher:</span>
                  <span className="font-bold text-slate-800">{classInfo.classTeacherName || 'Not Assigned'}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                <span>Session: {classInfo.academicYear}</span>
                <span className="font-semibold text-emerald-600">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Class & Section" maxWidth="md">
        {renderClassForm(false)}
      </Modal>
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Class & Section" maxWidth="md">
        {renderClassForm(true)}
      </Modal>
    </div>
  );
};

export const Classes: React.FC = () => {
  const { user } = useAuth();
  return user?.role === 'teacher' ? <TeacherClassWorkspace /> : <AdminClasses />;
};

export default Classes;
