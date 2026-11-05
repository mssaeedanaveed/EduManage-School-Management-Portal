import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  Search,
  Edit2,
  Eye,
  Archive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import { IStudent, IClass } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const Students: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState<IStudent[]>([]);
  const [classes, setClasses] = useState<IClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<IStudent | null>(null);
  const [viewDetails, setViewDetails] = useState<any>(null);

  // Form State
  const initialFormState = {
    name: '',
    email: '',
    parentEmail: '',
    admissionNo: '',
    rollNo: '',
    classId: '',
    parentId: '',
    parentName: '',
    emergencyContact: '',
    alternateContact: '',
    dob: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '',
    address: '',
    bloodGroup: 'O+',
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/api/students/directory/classes');
      if (res.data?.success) setClasses(res.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudentCount = async () => {
    try {
      const res = await api.get('/api/students/directory/count');
      if (res.data?.success) setTotalCount(res.data.total);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStudents = async () => {
    if (!selectedClass) {
      setStudents([]);
      setRecordCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const endpoint = `/api/students/directory/class-names/${encodeURIComponent(selectedClass)}/students`;
      const res = await api.get(endpoint, {
        params: {
          search,
          section: selectedSection || undefined,
          page: currentPage,
          limit: 10,
        },
      });
      if (res.data?.success) {
        setStudents(res.data.data);
        setTotalPages(res.data.totalPages);
        setRecordCount(res.data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    void fetchStudentCount();
    const refresh = window.setInterval(() => { void fetchStudentCount(); }, 15000);
    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [search, selectedClass, selectedSection, currentPage]);

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      alternateContact: '', // Explicitly verify starts completely blank
    });
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/students', formData);
      if (res.data?.success) {
        setIsCreateOpen(false);
        if (selectedClass) fetchStudents();
        fetchClasses();
        void fetchStudentCount();
        const credentials = res.data.data?.credentials;
        if (credentials) {
          alert(`Student enrolled.\nAdmission no: ${res.data.data.admissionNo}\nRoll no: ${res.data.data.rollNo}\nStudent login: ${credentials.student.email} / ${credentials.student.temporaryPassword}${credentials.parent.temporaryPassword ? `\nParent login: ${credentials.parent.email} / ${credentials.parent.temporaryPassword}` : `\nParent login: ${credentials.parent.email}`}`);
        }
        setFormData(initialFormState);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create student');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      const res = await api.put(`/api/students/${selectedStudent._id}`, formData);
      if (res.data?.success) {
        setIsEditOpen(false);
        fetchStudents();
        fetchClasses();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update student');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the school? Their personal information will be saved in Old Students, and their portal access and school records will be deleted.`)) return;
    try {
      await api.delete(`/api/students/${id}`);
      fetchStudents();
      fetchClasses();
      void fetchStudentCount();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete student');
    }
  };

  const handleOpenEdit = (student: IStudent) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name || '',
      email: student.email,
      parentEmail: student.parentEmail || '',
      admissionNo: student.admissionNo,
      rollNo: student.rollNo,
      classId: student.classId,
      parentId: student.parentId || '',
      parentName: student.parentName || '',
      emergencyContact: student.emergencyContact || '',
      alternateContact: student.alternateContact || '',
      dob: student.dob,
      gender: student.gender,
      phone: student.phone,
      address: student.address,
      bloodGroup: student.bloodGroup,
    });
    setIsEditOpen(true);
  };

  const selectedFormClass = classes.find((cls) => cls._id === formData.classId);
  const classNames = Array.from(new Set(classes.map((cls) => cls.name)));
  const classGroups = classNames
    .map((name) => ({
      name,
      sections: classes.filter((cls) => cls.name === name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const formSections = selectedFormClass
    ? classes.filter((cls) => cls.name === selectedFormClass.name)
    : [];

  const selectedClassSections = classes
    .filter((cls) => cls.name === selectedClass)
    .map((cls) => cls.section)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const openClass = (className: string) => {
    setSelectedClass(className);
    setSelectedSection('');
    setSearch('');
    setCurrentPage(1);
  };

  const handleOpenView = async (student: IStudent) => {
    setSelectedStudent(student);
    try {
      const res = await api.get(`/api/students/${student._id}`);
      if (res.data?.success) {
        setViewDetails(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            Student Directory
          </h1>
          <p className="text-xs text-slate-500">
                {totalCount} active students across the school
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll New Student</span>
          </button>
        )}
      </div>

      <div>
        <Link
          to="/old-students"
          className="inline-flex px-4 py-2 rounded-xl text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:text-indigo-700 hover:border-indigo-200"
        >
          Old Students
        </Link>
      </div>

      {!selectedClass ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classGroups.map((group) => (
            <button
              key={group.name}
              type="button"
              onClick={() => openClass(group.name)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-800">{group.name}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {group.sections.length} {group.sections.length === 1 ? 'section' : 'sections'}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[11px] font-bold">
                  {group.sections.reduce((total, section) => total + (section.studentCount || 0), 0)} students
                </span>
              </div>
            </button>
          ))}
          {classes.length === 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-500">
              No classes or sections have been created yet.
            </div>
          )}
        </div>
      ) : (
        <>
          {selectedClass && (
            <button
              type="button"
              onClick={() => { setSelectedClass(''); setSelectedSection(''); setSearch(''); setCurrentPage(1); }}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
            >
              ← Back to classes
            </button>
          )}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
            <select
              value={selectedSection}
              onChange={(e) => { setSelectedSection(e.target.value); setCurrentPage(1); }}
              className="sm:w-56 py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-700 font-medium"
            >
              <option value="">All Sections</option>
              {selectedClassSections.map((section) => (
                <option key={section} value={section}>Section {section}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search by student name or roll number..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-3">Roll No</th>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-3">Admission #</th>
                <th className="py-3 px-3">Parent / Guardian</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No students found matching your search.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {student.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {student.name || 'Unknown Student'}
                          </span>
                          <span className="text-[11px] text-slate-400">{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-indigo-700">{student.rollNo}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {classes.find((cls) => cls._id === student.classId)
                          ? `${classes.find((cls) => cls._id === student.classId)?.name} - ${classes.find((cls) => cls._id === student.classId)?.section}`
                          : student.className || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">{student.admissionNo}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">
                        {student.parentName || 'Self / Not Linked'}
                      </div>
                      {student.parentPhone && (
                        <div className="text-[10px] text-slate-400">{student.parentPhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{student.phone || 'N/A'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenView(student)}
                          title="View Profile"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(student)}
                              title="Edit Student"
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(student._id, student.name || 'Unknown Student')
                              }
                              title="Remove Student"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700">{recordCount}</span> students · Page{' '}
            <span className="font-bold text-slate-700">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-700">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
          </>
        )}

      {/* Modal: Enroll / Create Student */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Enroll New Student"
        subtitle="Create user credentials and register student into an academic class"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Jordan Smith"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Portal Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jordan.smith@school.edu"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Admission No</label>
                <div className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                  Generated automatically on enrollment (ADM-{new Date().getFullYear()}-###)
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Roll Number</label>
                <div className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                  Generated automatically for the selected class and section
                </div>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Class *</label>
              <select
                required
                value={selectedFormClass?.name || ''}
                onChange={(e) => {
                  const firstSection = classes.find((cls) => cls.name === e.target.value);
                  setFormData({ ...formData, classId: firstSection?._id || '' });
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium text-slate-700"
              >
                <option value="">Select Class...</option>
                {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {formSections.length > 0 && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Section *</label>
                <select
                  required
                  value={formSections.some((section) => section._id === formData.classId) ? formData.classId : ''}
                  disabled={!selectedFormClass}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium text-slate-700 disabled:bg-slate-50"
                >
                  <option value="">Select Section...</option>
                  {formSections.map((section) => (
                    <option key={section._id} value={section._id}>{section.section}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent/Guardian Name *</label>
              <input
                type="text"
                required
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                placeholder="e.g. Robert Montgomery"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value, emergencyContact: e.target.value })}
                placeholder="e.g. +1 (555) 019-2831"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent Portal Email <span className="font-normal text-slate-400">(Optional)</span></label>
              <input
                type="email"
                value={formData.parentEmail}
                onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                placeholder="guardian@example.com"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Alternate Contact Number <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="tel"
                id="student_alt_contact_unique_no_autofill_input"
                name="student_alt_contact_unique_no_browser_fill"
                autoComplete="off"
                value={formData.alternateContact}
                onChange={(e) => setFormData({ ...formData, alternateContact: e.target.value })}
                placeholder="Type manually or leave blank"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' | 'Other' })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Residential Address *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Academic Way, Springfield"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

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
              Complete Enrollment
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Student */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Student Information"
        maxWidth="2xl"
      >
        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Admission No</label>
              <input
                type="text"
                readOnly
                value={selectedStudent?.admissionNo || ''}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Roll Number</label>
              <input
                type="text"
                readOnly
                value={selectedStudent?.rollNo || ''}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Class *</label>
              <select
                required
                value={selectedFormClass?.name || ''}
                onChange={(e) => {
                  const firstSection = classes.find((cls) => cls.name === e.target.value);
                  setFormData({ ...formData, classId: firstSection?._id || '' });
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
              >
                {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {formSections.length > 0 && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Section *</label>
                <select
                  required
                  value={formSections.some((section) => section._id === formData.classId) ? formData.classId : ''}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                >
                  {formSections.map((section) => (
                    <option key={section._id} value={section._id}>{section.section}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent/Guardian Name *</label>
              <input
                type="text"
                required
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value, emergencyContact: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Alternate Contact Number <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="tel"
                id="edit_student_alt_contact_unique_no_autofill"
                name="edit_student_alt_contact_unique_no_autofill"
                autoComplete="off"
                value={formData.alternateContact}
                onChange={(e) => setFormData({ ...formData, alternateContact: e.target.value })}
                placeholder="Optional secondary phone"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Gender *</label>
              <select
                required
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' | 'Other' })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Residential Address *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
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

      {/* Modal: View Student Full Profile */}
      <Modal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title={selectedStudent?.name || 'Student Profile'}
        subtitle={`Roll No: ${selectedStudent?.rollNo} • Admission: ${selectedStudent?.admissionNo}`}
        maxWidth="xl"
      >
        {viewDetails && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">Class & Section</span>
                <span className="font-bold text-slate-800">{viewDetails.className}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Email</span>
                <span className="font-bold text-slate-800">{viewDetails.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Parent / Guardian</span>
                <span className="font-bold text-slate-800">
                  {viewDetails.parentName || 'Robert Montgomery'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Emergency Contact</span>
                <span className="font-bold text-slate-800">
                  {viewDetails.emergencyContact || viewDetails.parentPhone || '+1 (555) 890-1234'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block font-medium">Alternate Contact</span>
                <span className="font-bold text-slate-800">
                  {viewDetails.alternateContact || 'None provided (blank)'}
                </span>
              </div>
            </div>

            {/* Attendance Snapshot */}
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block mb-1">
                Attendance Standing
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700">
                  {viewDetails.attendanceSummary?.percentage != null
                    ? `${viewDetails.attendanceSummary?.percentage}%`
                    : '— (New Student)'}
                </span>
                <span className="text-slate-600">
                  ({viewDetails.attendanceSummary?.presentDays || 0} present, {viewDetails.attendanceSummary?.absentDays || 0} absent, {viewDetails.attendanceSummary?.leaveDays || 0} approved leave out of{' '}
                  {viewDetails.attendanceSummary?.totalDays || 0} total days)
                </span>
              </div>
            </div>

            {/* Fee summary */}
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-800 uppercase block mb-1">
                Fee Status
              </span>
              <div className="flex items-center justify-between">
                <span>Total Recent Vouchers: {viewDetails.feePayments?.length || 0}</span>
                <span className="font-bold text-slate-800">
                  Balance:{' '}
                  $
                  {viewDetails.feePayments?.reduce((s: number, p: any) => s + (p.balance || 0), 0) || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Students;
