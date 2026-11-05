import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Edit2, Eye, Mail, MapPin, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import { ITeacher, IClass, ISubject } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

type RelationshipStatus = ITeacher['relationshipStatus'];
type Designation = 'Class Teacher' | 'Subject Teacher';

interface AssignmentRow {
  classId: string;
  subjectIds: string[];
}

interface TeacherForm {
  name: string;
  phone: string;
  address: string;
  alternatePhone: string;
  relationshipStatus: RelationshipStatus;
  qualification: string;
  qualificationInstitution: string;
  experienceYears: number | '';
  designation: Designation;
  classTeacherClassId: string;
  email: string;
  password: string;
}

interface EditableClass {
  _id: string;
  name: string;
  section: string;
}

const emptyForm: TeacherForm = {
  name: '',
  phone: '',
  address: '',
  alternatePhone: '',
  relationshipStatus: 'Other',
  qualification: '',
  qualificationInstitution: '',
  experienceYears: '',
  designation: 'Subject Teacher',
  classTeacherClassId: '',
  email: '',
  password: '',
};

const relationshipStatuses: RelationshipStatus[] = ['Single', 'Married', 'Divorced', 'Widowed', 'Other'];

export const Teachers: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [classes, setClasses] = useState<IClass[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<ITeacher | null>(null);
  const [formData, setFormData] = useState<TeacherForm>(emptyForm);
  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([{ classId: '', subjectIds: [] }]);
  const [availableSubjects, setAvailableSubjects] = useState<Record<string, ISubject[]>>({});
  const [loadingSubjects, setLoadingSubjects] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSections, setNewSections] = useState('');
  const [newClassCapacity, setNewClassCapacity] = useState(40);
  const [newClassRoom, setNewClassRoom] = useState('');
  const [editingClass, setEditingClass] = useState<EditableClass | null>(null);
  const [subjectClassId, setSubjectClassId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectCredits, setNewSubjectCredits] = useState(3);

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [teacherResponse, classResponse, subjectResponse] = await Promise.all([
        api.get('/api/teachers'),
        api.get('/api/classes'),
        api.get('/api/subjects'),
      ]);
      if (teacherResponse.data?.success) setTeachers(teacherResponse.data.data);
      if (classResponse.data?.success) setClasses(classResponse.data.data);
      if (subjectResponse.data?.success) setSubjects(subjectResponse.data.data);
    } catch (error) {
      console.error('Failed to load faculty directory', error);
      setLoadError('Could not load faculty directory. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const getAvailableSubjects = async (classId: string, teacherId?: string) => {
    if (!classId) return;
    setLoadingSubjects((current) => ({ ...current, [classId]: true }));
    try {
      const response = await api.get(`/api/teachers/available-subjects/${classId}`, {
        params: teacherId ? { teacherId } : undefined,
      });
      if (response.data?.success) {
        setAvailableSubjects((current) => ({ ...current, [classId]: response.data.data || [] }));
      }
    } catch (error: any) {
      console.error('Failed to load available class subjects', error);
      window.alert(error.response?.data?.message || 'Could not load available subjects for this class.');
    } finally {
      setLoadingSubjects((current) => ({ ...current, [classId]: false }));
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setAssignmentRows([{ classId: '', subjectIds: [] }]);
    setAvailableSubjects({});
    setSelectedTeacher(null);
    setNewClassName('');
    setNewSections('');
    setNewClassCapacity(40);
    setNewClassRoom('');
    setEditingClass(null);
    setSubjectClassId('');
    setNewSubjectName('');
    setNewSubjectCode('');
    setNewSubjectCredits(3);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (teacher: ITeacher) => {
    setSelectedTeacher(teacher);
    const classTeacherClass = classes.find((cls) => cls.classTeacherId === teacher._id);
    setFormData({
      name: teacher.name,
      phone: teacher.phone || '',
      address: teacher.address || '',
      alternatePhone: teacher.alternatePhone || '',
      relationshipStatus: teacher.relationshipStatus || 'Other',
      qualification: teacher.qualification || '',
      qualificationInstitution: teacher.qualificationInstitution || '',
      experienceYears: teacher.experienceYears ?? '',
      designation: classTeacherClass ? 'Class Teacher' : 'Subject Teacher',
      classTeacherClassId: classTeacherClass?._id || '',
      email: teacher.email,
      password: '',
    });
    const teacherSubjects = subjects.flatMap((subject) => {
      const assignments = subject.sectionAssignments || [];
      const matching = assignments
        .filter((assignment) => assignment.teacherId === teacher._id)
        .map((assignment) => ({ ...subject, classId: assignment.classId, teacherId: assignment.teacherId }));
      if (matching.length) return matching;
      return subject.teacherId === teacher._id ? [subject] : [];
    });
    const groupedAssignments = new Map<string, string[]>();
    for (const subject of teacherSubjects) {
      const existing = groupedAssignments.get(subject.classId) || [];
      groupedAssignments.set(subject.classId, [...existing, subject._id]);
    }
    const rows = [...groupedAssignments].map(([classId, subjectIds]) => ({ classId, subjectIds }));
    setAssignmentRows(rows.length ? rows : [{ classId: '', subjectIds: [] }]);
    setAvailableSubjects({});
    setIsEditOpen(true);
    for (const classId of groupedAssignments.keys()) void getAvailableSubjects(classId, teacher._id);
  };

  const handleClassChange = (index: number, classId: string) => {
    setAssignmentRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { classId, subjectIds: [] } : row
    ));
    if (classId) void getAvailableSubjects(classId, isEditOpen ? selectedTeacher?._id : undefined);
  };

  const toggleAssignmentSubject = (rowIndex: number, subjectId: string) => {
    setAssignmentRows((current) => current.map((row, index) => {
      if (index !== rowIndex) return row;
      const selected = row.subjectIds.includes(subjectId);
      return {
        ...row,
        subjectIds: selected
          ? row.subjectIds.filter((id) => id !== subjectId)
          : [...row.subjectIds, subjectId],
      };
    }));
  };

  const assignedSubjectIds = useMemo(
    () => [...new Set(assignmentRows.flatMap((row) => row.subjectIds))],
    [assignmentRows]
  );

  const handleCreateClassSections = async () => {
    const sections = newSections.split(',').map((section) => section.trim()).filter(Boolean);
    if (!newClassName.trim() || sections.length === 0) {
      window.alert('Enter a class name and one or more sections separated by commas.');
      return;
    }
    try {
      const response = await api.post('/api/classes/sections', {
        name: newClassName.trim(),
        sections,
        capacity: newClassCapacity,
        roomNo: newClassRoom.trim(),
      });
      if (response.data?.success) {
        setNewClassName('');
        setNewSections('');
        setNewClassRoom('');
        await fetchData();
        if (formData.designation === 'Class Teacher' && !formData.classTeacherClassId) {
          setFormData((current) => ({
            ...current,
            classTeacherClassId: response.data.data?.[0]?._id || '',
          }));
        }
      }
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to create class sections.');
    }
  };

  const handleSaveClass = async () => {
    if (!editingClass) return;
    try {
      const response = await api.put(`/api/classes/${editingClass._id}`, {
        name: editingClass.name,
        section: editingClass.section,
      });
      if (response.data?.success) {
        setEditingClass(null);
        await fetchData();
      }
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to update class section.');
    }
  };

  const handleDeleteClass = async (cls: IClass) => {
    if (!window.confirm(`Delete ${cls.name} - Section ${cls.section}? The server will block deletion if students, teacher assignments, subjects, or timetable periods still depend on it.`)) return;
    try {
      await api.delete(`/api/classes/${cls._id}`);
      setAssignmentRows((current) => current.map((row) =>
        row.classId === cls._id ? { classId: '', subjectIds: [] } : row
      ));
      if (formData.classTeacherClassId === cls._id) {
        setFormData((current) => ({ ...current, classTeacherClassId: '' }));
      }
      await fetchData();
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to delete class section.');
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectClassId || !newSubjectName.trim() || !newSubjectCode.trim() ||
        !Number.isFinite(newSubjectCredits) || newSubjectCredits <= 0) {
      window.alert('Select a class and enter a subject name, course code, and positive credits.');
      return;
    }
    try {
      const response = await api.post('/api/subjects', {
        classId: subjectClassId,
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        credits: newSubjectCredits,
      });
      if (response.data?.success) {
        const createdSubject = response.data.data as ISubject;
        setNewSubjectName('');
        setNewSubjectCode('');
        setNewSubjectCredits(3);
        await fetchData();
        await getAvailableSubjects(subjectClassId, isEditOpen ? selectedTeacher?._id : undefined);
        setAssignmentRows((current) => {
          const existingIndex = current.findIndex((row) => row.classId === subjectClassId);
          if (existingIndex < 0) return current;
          return current.map((row, index) => index === existingIndex
            ? { ...row, subjectIds: [...row.subjectIds, createdSubject._id] }
            : row
          );
        });
      }
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to add subject.');
    }
  };

  const handleDeleteSubject = async (subject: ISubject) => {
    const assignedTeachers = (subject.sectionAssignments || [])
      .filter((assignment) => assignment.teacherName)
      .map((assignment) => `${assignment.section}: ${assignment.teacherName}`)
      .join(', ');
    if (!window.confirm(
      `Remove ${subject.name} (${subject.code}) from ${subject.className || 'this class'}?\n\nThis affects ${subject.studentCount || 0} students, removes ${subject.timetableCount || 0} timetable entries, and clears teacher assignments${assignedTeachers ? ` (${assignedTeachers})` : ''}.`
    )) return;
    try {
      await api.delete(`/api/subjects/${subject._id}`);
      setAssignmentRows((current) => current.map((row) => ({
        ...row,
        subjectIds: row.subjectIds.filter((id) => id !== subject._id),
      })));
      await fetchData();
      await getAvailableSubjects(subject.classId, isEditOpen ? selectedTeacher?._id : undefined);
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to remove subject.');
    }
  };

  const handleSubmit = async (event: React.FormEvent, isEdit: boolean) => {
    event.preventDefault();
    if (formData.designation === 'Class Teacher' && !formData.classTeacherClassId) {
      window.alert('Select a class or section for the class teacher.');
      return;
    }
    if (isEdit && !selectedTeacher) return;
    setSaving(true);
    const payload = {
      ...formData,
      experienceYears: Number(formData.experienceYears),
      assignedSubjectIds,
      subjectAssignments: assignmentRows,
    };
    try {
      const response = isEdit
        ? await api.put(`/api/teachers/${selectedTeacher?._id}`, payload)
        : await api.post('/api/teachers', payload);
      if (response.data?.success) {
        setIsCreateOpen(false);
        setIsEditOpen(false);
        resetForm();
        await fetchData();
      }
    } catch (error: any) {
      window.alert(error.response?.data?.message || `Failed to ${isEdit ? 'update' : 'add'} teacher.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacher: ITeacher) => {
    if (!window.confirm(`Remove ${teacher.name} from the faculty directory? Their class-teacher and subject assignments will also be removed.`)) return;
    try {
      await api.delete(`/api/teachers/${teacher._id}`);
      await fetchData();
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Failed to remove teacher.');
    }
  };

  const classTeacherClasses = (teacherId: string) => classes.filter((cls) => cls.classTeacherId === teacherId);
  const teacherSubjects = (teacherId: string) => subjects.flatMap((subject) => {
    const assignments = subject.sectionAssignments || [];
    const matching = assignments
      .filter((assignment) => assignment.teacherId === teacherId)
      .map((assignment) => ({ ...subject, classId: assignment.classId, teacherId: assignment.teacherId }));
    if (matching.length) return matching;
    return subject.teacherId === teacherId ? [subject] : [];
  });

  const filteredTeachers = teachers.filter((teacher) => {
    const role: Designation = classTeacherClasses(teacher._id).length ? 'Class Teacher' : 'Subject Teacher';
    const teacherClassIds = new Set([
      ...classTeacherClasses(teacher._id).map((cls) => cls._id),
      ...teacherSubjects(teacher._id).map((subject) => subject.classId),
    ]);
    const classMatches = !classFilter || teacherClassIds.has(classFilter);
    const searchValue = [
      teacher.name,
      teacher.employeeId,
      teacher.email,
      teacher.phone,
      role,
      ...teacherSubjects(teacher._id).map((subject) => subject.name),
    ].join(' ').toLowerCase();
    return classMatches &&
      (!designationFilter || role === designationFilter) &&
      searchValue.includes(search.trim().toLowerCase());
  });

  const renderTeacherForm = (isEdit: boolean) => (
    <form onSubmit={(event) => void handleSubmit(event, isEdit)} className="space-y-5 text-xs">
      <section className="space-y-3">
        <h3 className="border-b border-slate-100 pb-2 font-extrabold uppercase tracking-wide text-slate-500">Personal</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="font-bold text-slate-700">Full name *
            <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">Phone *
            <input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700 sm:col-span-2">Address *
            <textarea required rows={2} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">Alternate phone
            <input type="tel" value={formData.alternatePhone} onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">Relationship status
            <select value={formData.relationshipStatus} onChange={(e) => setFormData({ ...formData, relationshipStatus: e.target.value as RelationshipStatus })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600">
              {relationshipStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="border-b border-slate-100 pb-2 font-extrabold uppercase tracking-wide text-slate-500">Educational</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="font-bold text-slate-700">Highest qualification *
            <input required value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">University / institute *
            <input required value={formData.qualificationInstitution} onChange={(e) => setFormData({ ...formData, qualificationInstitution: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">Teaching experience (years) *
            <input required type="number" min="0" step="0.1" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="border-b border-slate-100 pb-2 font-extrabold uppercase tracking-wide text-slate-500">Login</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="font-bold text-slate-700">Email *
            <input required type="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
          <label className="font-bold text-slate-700">{isEdit ? 'New password (optional)' : 'Password *'}
            <input required={!isEdit} type="password" autoComplete={isEdit ? 'new-password' : 'new-password'} minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={isEdit ? 'Leave blank to keep current password' : 'At least 8 characters'} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
        <h3 className="font-extrabold uppercase tracking-wide text-slate-500">Designation</h3>
        <div>
          <label htmlFor="teacher-designation" className="block font-bold text-slate-700">Teacher designation *</label>
          <select
            id="teacher-designation"
            required
            value={formData.designation}
            onChange={(event) => {
              const designation = event.target.value as Designation;
              setFormData((current) => ({
                ...current,
                designation,
                classTeacherClassId: designation === 'Class Teacher' ? current.classTeacherClassId : '',
              }));
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="Subject Teacher">Subject Teacher</option>
            <option value="Class Teacher">Class Teacher</option>
          </select>
        </div>
        {formData.designation === 'Class Teacher' && (
          <div role="group" aria-labelledby="class-teacher-class-label">
            <label id="class-teacher-class-label" htmlFor="class-teacher-class" className="block font-bold text-slate-700">
              Choose the class / section this teacher will lead *
            </label>
            <select
              id="class-teacher-class"
              required
              value={formData.classTeacherClassId}
              onChange={(event) => setFormData((current) => ({ ...current, classTeacherClassId: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Select a class / section</option>
              {classes
                .filter((cls) => !cls.classTeacherId || cls.classTeacherId === selectedTeacher?._id)
                .map((cls) => (
                  <option key={cls._id} value={cls._id}>{cls.name} - Section {cls.section}</option>
                ))}
            </select>
            <p className="mt-1 text-[11px] font-normal text-slate-500">
              Select one available class/section. Sections already assigned to another class teacher are excluded.
            </p>
            {classes.length === 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-700">No classes or sections are available. Create one before assigning a class teacher.</p>
            ) : !classes.some((cls) => !cls.classTeacherId || cls.classTeacherId === selectedTeacher?._id) ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-700">There are no unassigned classes. Remove or change a class-teacher assignment before continuing.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-extrabold uppercase tracking-wide text-slate-500">Class & subject assignments</h3>
          <button type="button" onClick={() => setAssignmentRows((current) => [...current, { classId: '', subjectIds: [] }])} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100">Add another class</button>
        </div>
        {assignmentRows.map((row, rowIndex) => {
          const assignedClassIdsInOtherRows = assignmentRows.filter((_, index) => index !== rowIndex).map((item) => item.classId);
          const classSubjects = availableSubjects[row.classId] || [];
          return (
            <div key={`assignment-${rowIndex}`} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <label className="flex-1 font-bold text-slate-700">Class / section
                  <select value={row.classId} onChange={(e) => handleClassChange(rowIndex, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-600">
                    <option value="">Select a class or section</option>
                    {classes.filter((cls) => !assignedClassIdsInOtherRows.includes(cls._id)).map((cls) => (
                      <option key={cls._id} value={cls._id}>{cls.name} - Section {cls.section}</option>
                    ))}
                  </select>
                </label>
                {assignmentRows.length > 1 && (
                  <button type="button" onClick={() => setAssignmentRows((current) => current.filter((_, index) => index !== rowIndex))} aria-label="Remove class assignment" className="mt-5 rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {row.classId && (
                <div className="rounded-lg bg-slate-50 p-2">
                  {loadingSubjects[row.classId] ? (
                    <p className="p-2 text-slate-500">Loading available subjects...</p>
                  ) : classSubjects.length ? (
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {classSubjects.map((subject) => (
                        <label key={subject._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-slate-700 hover:bg-white">
                          <input type="checkbox" checked={row.subjectIds.includes(subject._id)} onChange={() => toggleAssignmentSubject(rowIndex, subject._id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                          {subject.name} <span className="text-slate-400">({subject.code})</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="p-2 text-slate-500">No unassigned subjects are available in this class.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-slate-500">Subjects are assigned within the selected class/section. Subjects already assigned to another teacher are unavailable.</p>
      </section>

      <details className="rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-extrabold text-indigo-700">
          Manage classes, sections & subjects
          <span className="ml-2 text-[11px] font-medium text-slate-500">Create, edit, or remove them here without leaving the teacher form.</span>
        </summary>
        <div className="space-y-5 border-t border-slate-200 p-4">
          <section className="space-y-3">
            <h4 className="font-extrabold uppercase tracking-wide text-slate-500">Create a class and sections</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="font-bold text-slate-700">Class name
                <input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="e.g. Class 5" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
              <label className="font-bold text-slate-700">Sections (comma-separated)
                <input value={newSections} onChange={(event) => setNewSections(event.target.value)} placeholder="A, B, C" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
              <label className="font-bold text-slate-700">Capacity per section
                <input type="number" min="1" value={newClassCapacity} onChange={(event) => setNewClassCapacity(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
              <label className="font-bold text-slate-700">Room (optional)
                <input value={newClassRoom} onChange={(event) => setNewClassRoom(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
            </div>
            <button type="button" onClick={() => void handleCreateClassSections()} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700">Create class sections</button>
          </section>

          <section className="space-y-2">
            <h4 className="font-extrabold uppercase tracking-wide text-slate-500">Existing class sections</h4>
            {classes.length === 0 ? (
              <p className="rounded-lg bg-white p-3 text-slate-500">No classes or sections yet.</p>
            ) : classes.map((cls) => (
              <div key={cls._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                {editingClass?._id === cls._id ? (
                  <>
                    <input aria-label="Class name" value={editingClass.name} onChange={(event) => setEditingClass({ ...editingClass, name: event.target.value })} className="min-w-32 flex-1 rounded-lg border border-slate-200 p-2" />
                    <input aria-label="Section" value={editingClass.section} onChange={(event) => setEditingClass({ ...editingClass, section: event.target.value })} className="w-24 rounded-lg border border-slate-200 p-2" />
                    <button type="button" onClick={() => void handleSaveClass()} className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-700">Save</button>
                    <button type="button" onClick={() => setEditingClass(null)} className="rounded-lg px-3 py-2 font-bold text-slate-500">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-slate-800">{cls.name} - Section {cls.section}</span>
                    <button type="button" onClick={() => setEditingClass({ _id: cls._id, name: cls.name, section: cls.section })} className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-700">Edit</button>
                    <button type="button" onClick={() => void handleDeleteClass(cls)} className="rounded-lg bg-rose-50 px-3 py-2 font-bold text-rose-700">Delete</button>
                  </>
                )}
              </div>
            ))}
            <p className="text-[11px] text-slate-500">Class sections with students, teacher assignments, subjects, or timetable periods cannot be deleted.</p>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-4">
            <h4 className="font-extrabold uppercase tracking-wide text-slate-500">Add a subject to a class / section</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="font-bold text-slate-700">Class / section
                <select value={subjectClassId} onChange={(event) => setSubjectClassId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal">
                  <option value="">Select a class / section</option>
                  {classes.map((cls) => <option key={cls._id} value={cls._id}>{cls.name} - {cls.section}</option>)}
                </select>
              </label>
              <label className="font-bold text-slate-700">Subject name
                <input value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
              <label className="font-bold text-slate-700">Subject code
                <input value={newSubjectCode} onChange={(event) => setNewSubjectCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
              <label className="font-bold text-slate-700">Credits
                <input type="number" min="0.0000000001" step="any" value={newSubjectCredits} onChange={(event) => setNewSubjectCredits(event.target.value === '' ? 0 : Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 font-normal" />
              </label>
            </div>
            <button type="button" onClick={() => void handleCreateSubject()} disabled={!classes.length} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Add subject</button>
            <div className="space-y-2">
              {subjects.map((subject) => {
                const cls = classes.find((item) => item._id === subject.classId);
                return (
                  <div key={subject._id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <span className="flex-1 font-semibold text-slate-800">{cls ? `${cls.name} - ${cls.section}: ` : ''}{subject.name} <span className="font-normal text-slate-400">({subject.code})</span></span>
                    <button type="button" onClick={() => void handleDeleteSubject(subject)} className="rounded-lg bg-rose-50 px-3 py-2 font-bold text-rose-700">Remove</button>
                  </div>
                );
              })}
              {subjects.length === 0 && <p className="rounded-lg bg-white p-3 text-slate-500">No subjects have been added yet.</p>}
            </div>
          </section>
        </div>
      </details>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
        }} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Teacher'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
            <Users className="h-6 w-6 text-indigo-600" /> Faculty Directory
          </h1>
          <p className="mt-1 text-xs text-slate-500">Manage faculty profiles, class leadership, and class-specific subject assignments.</p>
        </div>
        {isAdmin && (
          <button onClick={handleOpenCreate} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Add New Teacher
          </button>
        )}
      </header>

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{loadError}</div>}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:grid-cols-[1fr_200px_240px]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, designation, email, phone, or subject..." className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600" />
        </div>
        <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
          <option value="">All designations</option>
          <option>Class Teacher</option>
          <option>Subject Teacher</option>
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
          <option value="">All classes / sections</option>
          {classes.map((cls) => <option key={cls._id} value={cls._id}>{cls.name} - Section {cls.section}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading faculty directory...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No faculty profiles match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher) => {
            const teacherClasses = [...new Set(teacherSubjects(teacher._id).map((subject) => subject.classId))]
              .map((id) => classes.find((cls) => cls._id === id))
              .filter((cls): cls is IClass => Boolean(cls));
            const classTeacherOf = classTeacherClasses(teacher._id);
            const designation: Designation = classTeacherOf.length ? 'Class Teacher' : 'Subject Teacher';
            const assignedSubjects = teacherSubjects(teacher._id);
            return (
              <article key={teacher._id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-indigo-300">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-sm font-bold text-white">{teacher.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">{teacher.name}</h2>
                        <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">{designation} · {teacher.employeeId}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelectedTeacher(teacher); setIsViewOpen(true); }} title="View profile" className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleOpenEdit(teacher)} title="Edit teacher" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => void handleDelete(teacher)} title="Remove teacher" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{teacher.email}</div>
                    <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{teacher.phone || 'No phone provided'}</div>
                    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span>{teacher.address || 'No address provided'}</span></div>
                    <div className="flex items-center gap-2"><Award className="h-3.5 w-3.5 text-indigo-600" />{teacher.qualification || 'Qualification not recorded'}</div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Class teacher of</div>
                    <p className="text-xs font-semibold text-slate-700">{classTeacherOf.map((cls) => `${cls.name} - ${cls.section}`).join(', ') || 'None'}</p>
                    <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Classes & subjects</div>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedSubjects.map((subject) => {
                        const cls = classes.find((item) => item._id === subject.classId);
                        return <span key={subject._id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">{cls ? `${cls.name}-${cls.section}: ` : ''}{subject.name}</span>;
                      })}
                      {teacherClasses.length === 0 && <span className="text-[11px] italic text-slate-400">No subject assignments</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Faculty Member" subtitle="Create a teacher profile and login account." maxWidth="lg">
        {renderTeacherForm(false)}
      </Modal>
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Faculty Profile" subtitle="Update profile details, designation, and assignments." maxWidth="lg">
        {renderTeacherForm(true)}
      </Modal>
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Faculty Profile" maxWidth="md">
        {selectedTeacher && (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white">{selectedTeacher.name.charAt(0).toUpperCase()}</div>
              <div><h3 className="text-base font-black text-slate-900">{selectedTeacher.name}</h3><p className="font-semibold text-indigo-600">{classTeacherClasses(selectedTeacher._id).length ? 'Class Teacher' : 'Subject Teacher'} · {selectedTeacher.employeeId}</p></div>
            </div>
            <p><b>Email:</b> {selectedTeacher.email}</p>
            <p><b>Phone:</b> {selectedTeacher.phone}</p>
            <p><b>Alternate phone:</b> {selectedTeacher.alternatePhone || '—'}</p>
            <p><b>Address:</b> {selectedTeacher.address || '—'}</p>
            <p><b>Relationship status:</b> {selectedTeacher.relationshipStatus || '—'}</p>
            <p><b>Qualification:</b> {selectedTeacher.qualification}</p>
            <p><b>University / institute:</b> {selectedTeacher.qualificationInstitution || '—'}</p>
            <p><b>Experience:</b> {selectedTeacher.experienceYears ?? '—'} years</p>
            <p><b>Class teacher of:</b> {classTeacherClasses(selectedTeacher._id).map((cls) => `${cls.name} - ${cls.section}`).join(', ') || 'None'}</p>
            <div><b>Classes and subjects:</b>
              <ul className="mt-1 list-inside list-disc">
                {teacherSubjects(selectedTeacher._id).map((subject) => {
                  const cls = classes.find((item) => item._id === subject.classId);
                  return <li key={subject._id}>{cls ? `${cls.name} - ${cls.section}` : 'Class unavailable'}: {subject.name}</li>;
                })}
                {teacherSubjects(selectedTeacher._id).length === 0 && <li>None assigned</li>}
              </ul>
            </div>
            <button onClick={() => { setIsViewOpen(false); handleOpenEdit(selectedTeacher); }} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700">Edit Profile</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Teachers;
