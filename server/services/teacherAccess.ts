import { IUser } from '../types.js';
import store from '../data/store.js';

export function getTeacherForUser(user?: IUser) {
  return user?.role === 'teacher' ? store.findTeacherByUserId(user._id) : undefined;
}

export function isClassTeacher(user: IUser | undefined, classId: string): boolean {
  const teacher = getTeacherForUser(user);
  return Boolean(teacher && store.findClassById(classId)?.classTeacherId === teacher._id);
}

export function teachesSubject(user: IUser | undefined, classId: string, subjectId: string): boolean {
  const teacher = getTeacherForUser(user);
  return Boolean(teacher && store.getSubjects(classId).some(
    (subject) => subject._id === subjectId && subject.teacherId === teacher._id
  ));
}

export function canAccessClass(user: IUser | undefined, classId: string): boolean {
  if (user?.role === 'admin') return true;
  if (user?.role !== 'teacher') return false;
  if (isClassTeacher(user, classId)) return true;
  const teacher = getTeacherForUser(user);
  return Boolean(teacher && store.getSubjects(classId).some((subject) => subject.teacherId === teacher._id));
}

export function getTeacherClassIds(user?: IUser): string[] {
  const teacher = getTeacherForUser(user);
  if (!teacher) return [];
  return [...new Set([
    ...store.getClasses()
      .filter((cls) => store.getSubjects(cls._id).some((subject) => subject.teacherId === teacher._id))
      .map((cls) => cls._id),
    ...store.getClasses().filter((cls) => cls.classTeacherId === teacher._id).map((cls) => cls._id),
  ])];
}

export function syncTeacherAssignments(): void {
  for (const teacher of store.getTeachers()) {
    const subjects = store.getSubjectAssignments().filter((subject) => subject.teacherId === teacher._id);
    store.updateTeacher(teacher._id, {
      assignedSubjectIds: [...new Set(subjects.map((subject) => subject._id))],
      assignedClassIds: [...new Set([
        ...subjects.map((subject) => subject.classId),
        ...store.getClasses().filter((cls) => cls.classTeacherId === teacher._id).map((cls) => cls._id),
      ])],
    });
  }
}
