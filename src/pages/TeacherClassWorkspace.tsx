import React, { useEffect, useState } from 'react';
import { Award, BookOpen, CalendarCheck, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { IClass, IResult, IStudent, ISubject } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface TeacherClassData {
  classInfo: IClass;
  subjects: ISubject[];
  students: IStudent[];
  results: IResult[];
}

export const TeacherClassWorkspace: React.FC = () => {
  const { profile } = useAuth();
  const teacherId = profile?.teacher?._id;
  const [classData, setClassData] = useState<TeacherClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const classesResponse = await api.get('/api/classes');
        const classes: IClass[] = classesResponse.data?.success ? classesResponse.data.data : [];
        const records = await Promise.all(classes.map(async (classInfo) => {
          const [subjectsResponse, studentsResponse, resultsResponse] = await Promise.all([
            api.get('/api/subjects', { params: { classId: classInfo._id } }),
            api.get('/api/students', { params: { classId: classInfo._id, limit: 1000 } }),
            api.get('/api/results', { params: { classId: classInfo._id } }),
          ]);
          return {
            classInfo,
            subjects: subjectsResponse.data?.data || [],
            students: studentsResponse.data?.data || [],
            results: resultsResponse.data?.data || [],
          };
        }));
        if (active) setClassData(records);
      } catch (loadError) {
        console.error('Failed to load teacher class workspace', loadError);
        if (active) setError('Could not load your assigned classes. Please refresh and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [teacherId]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your assigned classes...</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  }
  if (classData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <GraduationCap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <h1 className="font-bold text-slate-800">No classes assigned yet</h1>
        <p className="mt-1 text-sm text-slate-500">Your class and subject assignments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          My Classes
        </h1>
        <p className="mt-1 text-xs text-slate-500">Students and subject results for your assigned classes.</p>
      </header>

      {classData.map(({ classInfo, subjects, students, results }) => {
        const classTeacher = classInfo.classTeacherId === teacherId;
        return (
          <section key={classInfo._id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {classInfo.name} · Section {classInfo.section}
                </h2>
                {classTeacher && (
                  <span className="mt-1 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                    Class Teacher
                  </span>
                )}
              </div>
              {classTeacher && (
                <div className="flex gap-2">
                  <Link to="/results" className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                    <Award className="h-4 w-4" /> Final Results
                  </Link>
                  <Link to="/attendance" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    <CalendarCheck className="h-4 w-4" /> Class Attendance
                  </Link>
                </div>
              )}
            </div>

            {subjects.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No subjects assigned for this class.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {subjects.map((subject) => (
                  <article key={subject._id} className="rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 p-3">
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <h3 className="font-bold text-slate-800">{subject.name}</h3>
                      <span className="ml-auto text-[10px] font-semibold text-slate-400">{subject.code}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {students.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500">No students are enrolled in this class.</p>
                      ) : students.map((student) => {
                        const studentResults = results.flatMap((result) =>
                          result.marks
                            .filter((mark) => mark.subjectId === subject._id)
                            .map((mark) => ({ result, mark }))
                        );
                        return (
                          <div key={student._id} className="p-3">
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs font-bold text-slate-800">{student.name}</span>
                              <span className="ml-auto text-[10px] text-slate-400">Roll {student.rollNo}</span>
                            </div>
                            <div className="mt-2 pl-5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Results</p>
                              {studentResults.length === 0 ? (
                                <p className="mt-1 text-[11px] italic text-slate-400">No results entered yet.</p>
                              ) : studentResults.map(({ result, mark }) => (
                                <p key={`${result._id}-${mark.subjectId}`} className="mt-1 text-[11px] text-slate-600">
                                  {result.examName || 'Exam'}: {mark.marksObtained}/{mark.maxMarks} · {mark.grade}
                                  {result.published ? <span className="ml-1 font-semibold text-emerald-600">Final</span> : <span className="ml-1 text-amber-600">Draft</span>}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default TeacherClassWorkspace;
