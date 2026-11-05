import cron from 'node-cron';
import store from '../data/store.js';

export function runResultReminderJobs(): { success: boolean; remindersSent: number } {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  let remindersSent = 0;

  for (const exam of store.getExams()) {
    const end = new Date(`${exam.endDate}T00:00:00`);
    const todayStart = new Date(`${todayKey}T00:00:00`);
    const daysUntilEnd = Math.round((end.getTime() - todayStart.getTime()) / 86400000);
    if (daysUntilEnd !== 2 && daysUntilEnd >= 0) continue;

    for (const cls of store.getClasses()) {
      if (exam.classId && exam.classId !== cls._id) continue;
      const students = store.getStudents({ classId: cls._id });

      for (const subject of store.getSubjects(cls._id)) {
        const entered = students.filter((student) =>
          store.getResults(exam._id, cls._id, student._id)[0]?.marks
            .some((mark) => mark.subjectId === subject._id)
        ).length;
        if (students.length > 0 && entered >= students.length) continue;
        if (!subject.teacherId) continue;
        const teacher = store.findTeacherById(subject.teacherId);
        if (!teacher?.userId) continue;

        const phase = daysUntilEnd >= 0 ? 'pre' : 'post';
        const reminderKey = `${exam._id}:${cls._id}:${subject._id}:${phase}`;
        const type = phase === 'pre' ? 'exam_marks_reminder' : 'exam_marks_overdue';
        if (store.hasNotificationToday(teacher.userId, type, reminderKey)) continue;
        store.createNotification({
          userId: teacher.userId,
          role: 'teacher',
          type,
          title: phase === 'pre' ? 'Marks Due Soon' : 'Marks Overdue',
          message: `${exam.name} marks are pending for ${cls.name} - Section ${cls.section}, ${subject.name}: ${entered}/${students.length} students entered.`,
          link: '/results',
          isRead: false,
          metadata: { examId: exam._id, classId: cls._id, subjectId: subject._id, reminderKey },
        });
        remindersSent++;
      }

      if (daysUntilEnd >= 0) continue;
      const classTeacher = cls.classTeacherId ? store.findTeacherById(cls.classTeacherId) : undefined;
      if (!classTeacher?.userId) continue;
      const results = store.getResults(exam._id, cls._id);
      const submitted = results.length > 0 && results.every((result) => result.published);
      if (submitted) continue;
      const reminderKey = `${exam._id}:${cls._id}:result-submission`;
      if (store.hasNotificationToday(classTeacher.userId, 'result_submission_overdue', reminderKey)) continue;
      store.createNotification({
        userId: classTeacher.userId,
        role: 'teacher',
        type: 'result_submission_overdue',
        title: 'Class Result Submission Overdue',
        message: `${exam.name} results for ${cls.name} - Section ${cls.section} have not been submitted.`,
        link: '/results',
        isRead: false,
        metadata: { examId: exam._id, classId: cls._id, reminderKey },
      });
      remindersSent++;
    }
  }
  return { success: true, remindersSent };
}

export function initResultReminderJobs(): void {
  cron.schedule('0 8 * * *', () => runResultReminderJobs());
}
