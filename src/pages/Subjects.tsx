import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Filter } from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import { ISubject, IClass, ITeacher } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const Subjects: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [classes, setClasses] = useState<IClass[]>([]);
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [sectionTeacherIds, setSectionTeacherIds] = useState<Record<string, string>>({});

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<ISubject | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classId: '',
    teacherId: '',
    credits: 3,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, tRes] = await Promise.all([
        api.get('/api/subjects', {
          params: {
            classId: selectedClass || undefined,
            teacherId: selectedTeacher || undefined,
            search: search.trim() || undefined,
          },
        }),
        api.get('/api/classes'),
        api.get('/api/teachers'),
      ]);
      if (sRes.data?.success) setSubjects(sRes.data.data);
      if (cRes.data?.success) setClasses(cRes.data.data);
      if (tRes.data?.success) setTeachers(tRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [selectedClass, selectedTeacher, search]);

  const classGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; academicYear: string; classIds: string[] }>();
    for (const cls of classes) {
      const key = `${cls.name.trim().toLowerCase()}::${cls.academicYear.trim().toLowerCase()}`;
      const existing = groups.get(key);
      if (existing) existing.classIds.push(cls._id);
      else groups.set(key, {
        id: cls._id,
        name: cls.name,
        academicYear: cls.academicYear,
        classIds: [cls._id],
      });
    }
    return [...groups.values()];
  }, [classes]);

  const validateSubjectForm = (excludeId?: string): string | undefined => {
    void excludeId;
    if (!Number.isFinite(formData.credits) || formData.credits <= 0) {
      return 'Academic credits must be a positive number.';
    }
    return undefined;
  };

  const checkCourseCode = async (excludeId?: string): Promise<boolean> => {
    const response = await api.get('/api/subjects/course-code-availability', {
      params: {
        courseCode: formData.code.trim(),
        ...(excludeId ? { excludeId } : {}),
      },
    });
    if (!response.data?.available) {
      setFormError(response.data?.message || 'This course code is already in use.');
      return false;
    }
    return true;
  };

  const buildSectionAssignments = () => Object.entries(sectionTeacherIds)
    .map(([classId, teacherId]) => ({ classId, teacherId }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateSubjectForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    try {
      if (!await checkCourseCode()) return;
      const res = await api.post('/api/subjects', {
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        sectionAssignments: buildSectionAssignments(),
      });
      if (res.data?.success) {
        setIsCreateOpen(false);
        fetchData();
        setFormData({ name: '', code: '', classId: '', teacherId: '', credits: 3 });
        setSectionTeacherIds({});
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setFormError(message || 'Failed to create subject');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    const validationError = validateSubjectForm(selectedSubject._id);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    try {
      if (!await checkCourseCode(selectedSubject._id)) return;
      const res = await api.put(`/api/subjects/${selectedSubject._id}`, {
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        sectionAssignments: buildSectionAssignments(),
      });
      if (res.data?.success) {
        setIsEditOpen(false);
        fetchData();
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setFormError(message || 'Failed to update subject');
    }
  };

  const handleDelete = async (subject: ISubject) => {
    const teacherSummary = (subject.sectionAssignments || [])
      .filter((assignment) => assignment.teacherName)
      .map((assignment) => `Section ${assignment.section}: ${assignment.teacherName}`)
      .join(', ');
    const impact = [
      `${subject.studentCount || 0} students will lose this subject from their class curriculum`,
      `${subject.timetableCount || 0} timetable entries will be removed`,
      `teacher assignment${teacherSummary ? `: ${teacherSummary}` : 's will be cleared'}`,
    ];
    if (!window.confirm(`Delete subject ${subject.name} (${subject.code})?\n\nThis will affect:\n- ${impact.join('\n- ')}`)) return;
    try {
      await api.delete(`/api/subjects/${subject._id}`);
      await fetchData();
    } catch (err: any) {
      const blockers = err.response?.data?.blockers as string[] | undefined;
      const message = err.response?.data?.message || 'Failed to delete subject';
      alert(blockers?.length ? `${message}\n\n${blockers.map((blocker) => `- ${blocker}`).join('\n')}` : message);
    }
  };

  const handleOpenEdit = (s: ISubject) => {
    setSelectedSubject(s);
    setFormData({
      name: s.name,
      code: s.code,
      classId: s.classId,
      teacherId: s.teacherId || '',
      credits: s.credits ?? 3,
    });
    setSectionTeacherIds(Object.fromEntries((s.sectionAssignments || []).map((item) => [item.classId, item.teacherId])));
    setFormError('');
    setIsEditOpen(true);
  };

  const handleFormClassChange = (classId: string) => {
    setFormData({ ...formData, classId, teacherId: '' });
    const group = classGroups.find((item) => item.id === classId);
    setSectionTeacherIds(Object.fromEntries((group?.classIds || []).map((id) => [id, ''])));
    setFormError('');
  };
  const renderSectionTeacherFields = () => {
    const group = classGroups.find((item) => item.classIds.includes(formData.classId));
    const sections = (group?.classIds || [])
      .map((id) => classes.find((cls) => cls._id === id))
      .filter((cls): cls is IClass => Boolean(cls));
    return (
      <div className="space-y-2">
        <label className="block font-bold text-slate-700">Assigned Teacher by Section</label>
        {sections.map((cls) => (
          <div key={cls._id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-semibold text-slate-600">Section {cls.section}</span>
            <select
              value={sectionTeacherIds[cls._id] || ''}
              onChange={(e) => setSectionTeacherIds({ ...sectionTeacherIds, [cls._id]: e.target.value })}
              className="min-w-0 flex-1 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Unassigned</option>
              {teachers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
              ))}
            </select>
          </div>
        ))}
        {!sections.length && <p className="text-[11px] text-slate-500">Choose a class to assign its section teachers.</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Curriculum & Subjects
          </h1>
          <p className="text-xs text-slate-500">
            Define academic disciplines, course codes, and assign subject instructors
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setFormError('');
              setSectionTeacherIds({});
              setFormData({ name: '', code: '', classId: '', teacherId: '', credits: 3 });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Subject</span>
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject name or course code"
          className="min-w-0 flex-1 py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium text-slate-700"
        >
          <option value="">All Classes</option>
          {classGroups.map((group) => (
            <option key={`${group.name}-${group.academicYear}`} value={group.id}>
              {group.name} ({group.academicYear})
            </option>
          ))}
        </select>
        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium text-slate-700"
        >
          <option value="">All Teachers</option>
          <option value="unassigned">Unassigned</option>
          {teachers.map((teacher) => (
            <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
          ))}
        </select>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">Subject Name</th>
              <th className="py-3 px-3">Course Code</th>
              <th className="py-3 px-3">Class</th>
              <th className="py-3 px-3">Assigned Faculty</th>
              <th className="py-3 px-3">Credits</th>
              <th className="py-3 px-3">Students</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((subj) => (
              <tr key={subj._id} className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-bold text-slate-900">{subj.name}</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded font-bold text-indigo-700 bg-indigo-50 border border-indigo-200">
                    {subj.code}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-700 font-medium">
                  {subj.className || 'Class'} <span className="text-slate-400">({subj.academicYear || '—'})</span>
                  {(subj.classIds?.length || 0) > 1 && <div className="text-[10px] text-slate-500">All sections</div>}
                </td>
                <td className="py-3 px-3 font-semibold text-slate-800">
                  {(subj.sectionAssignments || []).length
                    ? (subj.sectionAssignments || []).map((assignment) =>
                      `${assignment.section || 'Section'}: ${assignment.teacherName || 'Unassigned'}`
                    ).join(', ')
                    : subj.teacherName || 'Unassigned'}
                </td>
                <td className="py-3 px-3 text-slate-600">{subj.credits ?? 3}</td>
                <td className="py-3 px-3 text-slate-600">{subj.studentCount ?? 0}</td>
                <td className="py-3 px-4 text-right">
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(subj)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(subj)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Subject */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Subject"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 font-semibold text-rose-700">{formError}</p>}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Subject Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. World History"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Course Code *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="HIST101"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Academic Credits *</label>
              <input
                type="number"
                required
                min="0.0000000001"
                step="any"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class *</label>
            <select
              required
              value={formData.classId}
              onChange={(e) => handleFormClassChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Select Class...</option>
              {classGroups.map((group) => (
                <option key={`${group.name}-${group.academicYear}`} value={group.id}>
                  {group.name} ({group.academicYear})
                </option>
              ))}
            </select>
          </div>
          {renderSectionTeacherFields()}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Create Subject
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Subject */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Subject"
        maxWidth="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 font-semibold text-rose-700">{formError}</p>}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Subject Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Credits *</label>
              <input
                type="number"
                required
                min="0.0000000001"
                step="any"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class *</label>
            <select
              required
              value={formData.classId}
              onChange={(e) => handleFormClassChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Select Class...</option>
              {classGroups.map((group) => (
                <option key={`${group.name}-${group.academicYear}`} value={group.id}>
                  {group.name} ({group.academicYear})
                </option>
              ))}
            </select>
          </div>
          {renderSectionTeacherFields()}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Subjects;
