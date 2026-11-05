import mongoose from 'mongoose';
import {
  UserModel,
  ClassModel,
  TeacherModel,
  SubjectModel,
  StudentModel,
  AttendanceModel,
  ExamModel,
  ResultModel,
  TimetableModel,
  FeeStructureModel,
  FeePaymentModel,
  NotificationModel,
  ResultAuditLogModel,
} from '../models/index.js';
import store from '../data/store.js';
import dbMonitor from './dbMonitor.js';

function toMongoClass(classRecord: Record<string, any>): Record<string, unknown> {
  const {
    name,
    capacity,
    classTeacherId,
    classTeacherName,
    className,
    maxCapacity,
    classTeacher,
    ...remaining
  } = classRecord;
  const mongoClass: Record<string, unknown> = {
    ...remaining,
    className: className || name,
    maxCapacity: maxCapacity ?? capacity,
    classTeacher: classTeacher ?? classTeacherId ?? '',
  };
  if (Array.isArray(classRecord.subjects)) mongoClass.subjects = classRecord.subjects;
  return mongoClass;
}

function toStoreClass(classRecord: Record<string, any>): Record<string, any> {
  return {
    ...classRecord,
    name: classRecord.name || classRecord.className,
    capacity: classRecord.capacity ?? classRecord.maxCapacity,
    classTeacherId: classRecord.classTeacherId || classRecord.classTeacher || '',
    subjects: Array.isArray(classRecord.subjects) ? classRecord.subjects : undefined,
  };
}

export class MongoSyncService {
  private isSyncing = false;
  private portalRefreshPromise?: Promise<void>;
  private portalCacheRefreshedAt = 0;

  public isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  public async flushPendingWrites(): Promise<void> {
    await store.flushPendingPersistence();
  }

  public async ensureAttendanceIndexes(): Promise<void> {
    if (!this.isConnected()) throw new Error('MongoDB is not connected.');

    const legacySubjectAttendanceCount = await AttendanceModel.countDocuments({
      subjectId: { $exists: true },
      records: { $exists: false },
    });
    if (legacySubjectAttendanceCount > 0) {
      console.warn(
        `[Attendance migration] Preserved ${legacySubjectAttendanceCount} legacy subject-wise attendance records. ` +
        'New class-wide attendance uses separate documents; legacy records were not deleted.'
      );
    }

    const indexes = await AttendanceModel.collection.indexes();
    const legacyUniqueIndex = indexes.find((index) => {
      const keys = Object.entries(index.key || {});
      return index.unique === true &&
        keys.length === 2 &&
        keys.some(([key, direction]) => key === 'studentId' && direction === 1) &&
        keys.some(([key, direction]) => key === 'date' && direction === 1);
    });
    if (legacyUniqueIndex?.name) {
      await AttendanceModel.collection.dropIndex(legacyUniqueIndex.name);
    }

    await AttendanceModel.createIndexes();
  }

  public async refreshPortalCache(): Promise<void> {
    if (!this.isConnected()) throw new Error('MongoDB is not connected.');
    if (this.portalRefreshPromise) return this.portalRefreshPromise;
    if (Date.now() - this.portalCacheRefreshedAt < 3000) return;

    this.portalRefreshPromise = this.flushPendingWrites()
      .then(() => this.pullAllFromMongo())
      .then(() => {
        this.portalCacheRefreshedAt = Date.now();
      })
      .then(() => undefined)
      .finally(() => {
        this.portalRefreshPromise = undefined;
      });
    return this.portalRefreshPromise;
  }

  /**
   * Automatically seed MongoDB if collections are empty
   */
  public async seedMongoIfEmpty(): Promise<boolean> {
    if (!this.isConnected()) return false;

    try {
      const userCount = await UserModel.countDocuments();
      if (userCount === 0) {
        console.log('[MongoSync] Connected database is empty. Auto-seeding initial school records...');
        await this.syncAllToMongo(true);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[MongoSync] Error checking collection count:', err.message);
      return false;
    }
  }

  /**
   * Push all current data from store into MongoDB collections
   */
  public async syncAllToMongo(isInitialSeed = false): Promise<{
    success: boolean;
    counts: Record<string, number>;
    message: string;
  }> {
    if (!this.isConnected()) {
      return {
        success: false,
        counts: {},
        message: 'MongoDB is not connected. Connect a database first.',
      };
    }

    if (this.isSyncing) {
      return {
        success: false,
        counts: {},
        message: 'Sync already in progress.',
      };
    }

    this.isSyncing = true;
    const start = Date.now();
    const counts: Record<string, number> = {};

    try {
      // 1. Users
      const users = store.getUsers();
      if (users.length > 0) {
        const ops = users.map((u) => ({
          updateOne: {
            filter: { _id: u._id },
            update: { $set: u },
            upsert: true,
          },
        }));
        await UserModel.bulkWrite(ops);
        counts.users = users.length;
      }

      // 2. Classes
      const classes = store.getClasses();
      if (classes.length > 0) {
        const ops = classes.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
            update: { $set: toMongoClass(c) },
            upsert: true,
          },
        }));
        await ClassModel.bulkWrite(ops);
        counts.classes = classes.length;
      }

      // 3. Teachers
      const teachers = store.getTeachers();
      if (teachers.length > 0) {
        const ops = teachers.map((t) => ({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: t },
            upsert: true,
          },
        }));
        await TeacherModel.bulkWrite(ops);
        counts.teachers = teachers.length;
      }

      // 4. Subjects
      const subjects = store.getSubjects();
      if (subjects.length > 0) {
        const ops = subjects.map((s) => ({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: s },
            upsert: true,
          },
        }));
        await SubjectModel.bulkWrite(ops);
        counts.subjects = subjects.length;
      }

      // 5. Students
      const students = store.students;
      if (students.length > 0) {
        const ops = students.map((s) => ({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: s },
            upsert: true,
          },
        }));
        await StudentModel.bulkWrite(ops);
        counts.students = students.length;
      }

      // 6. Attendance
      const attendance = store.attendance;
      if (attendance.length > 0) {
        const ops = attendance.map((a) => ({
          updateOne: {
            filter: { _id: a._id },
            update: { $set: a },
            upsert: true,
          },
        }));
        await AttendanceModel.bulkWrite(ops);
        counts.attendance = attendance.length;
      }

      // 7. Exams
      const exams = store.exams;
      if (exams.length > 0) {
        const ops = exams.map((e) => ({
          updateOne: {
            filter: { _id: e._id },
            update: { $set: e },
            upsert: true,
          },
        }));
        await ExamModel.bulkWrite(ops);
        counts.exams = exams.length;
      }

      // 8. Results
      const results = store.results;
      if (results.length > 0) {
        const ops = results.map((r) => ({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: r },
            upsert: true,
          },
        }));
        await ResultModel.bulkWrite(ops);
        counts.results = results.length;
      }

      const resultAuditLogs = store.resultAuditLog;
      if (resultAuditLogs.length > 0) {
        const auditOps = resultAuditLogs.map((entry) => ({
          updateOne: {
            filter: { _id: entry._id },
            update: {
              $set: {
                _id: entry._id,
                examId: entry.examId,
                classId: entry.classId,
                studentId: entry.studentId,
                action: entry.action,
                performedBy: entry.actorId,
                reason: entry.reason,
                details: entry.reason ? { reason: entry.reason } : {},
                createdAt: entry.createdAt,
                updatedAt: entry.createdAt,
              },
            },
            upsert: true,
          },
        }));
        await ResultAuditLogModel.bulkWrite(auditOps);
        counts.resultAuditLogs = resultAuditLogs.length;
      }

      // 9. Timetable
      const timetable = store.timetable;
      if (timetable.length > 0) {
        const ops = timetable.map((tt) => ({
          updateOne: {
            filter: { _id: tt._id },
            update: { $set: tt },
            upsert: true,
          },
        }));
        await TimetableModel.bulkWrite(ops);
        counts.timetable = timetable.length;
      }

      // 10. Fee Structures
      const feeStructures = store.feeStructures;
      if (feeStructures.length > 0) {
        const ops = feeStructures.map((f) => ({
          updateOne: {
            filter: { _id: f._id },
            update: { $set: f },
            upsert: true,
          },
        }));
        await FeeStructureModel.bulkWrite(ops);
        counts.feeStructures = feeStructures.length;
      }

      // 11. Fee Payments
      const feePayments = store.feePayments;
      if (feePayments.length > 0) {
        const ops = feePayments.map((fp) => ({
          updateOne: {
            filter: { _id: fp._id },
            update: { $set: fp },
            upsert: true,
          },
        }));
        await FeePaymentModel.bulkWrite(ops);
        counts.feePayments = feePayments.length;
      }

      const notifications = store.notifications;
      if (notifications.length > 0) {
        const ops = notifications.map((notification) => ({
          updateOne: {
            filter: { _id: notification._id },
            update: { $set: notification },
            upsert: true,
          },
        }));
        await NotificationModel.bulkWrite(ops);
        counts.notifications = notifications.length;
      }

      const durationMs = Date.now() - start;
      const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);

      dbMonitor.log({
        operation: isInitialSeed ? 'SEED' : 'SYNC',
        collection: 'all_collections',
        details: `Synchronized ${totalDocs} documents across 12 collections to MongoDB`,
        status: 'success',
        durationMs,
        dataPreview: counts,
      });

      return {
        success: true,
        counts,
        message: `Successfully synchronized ${totalDocs} documents to MongoDB database.`,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      dbMonitor.log({
        operation: 'SYNC',
        collection: 'all_collections',
        details: `Sync failed: ${err.message}`,
        status: 'failed',
        durationMs,
      });
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull records from MongoDB into memory store
   */
  public async pullAllFromMongo(): Promise<{ success: boolean; counts: Record<string, number> }> {
    if (!this.isConnected()) {
      throw new Error('MongoDB is not connected.');
    }

    const start = Date.now();
    const counts: Record<string, number> = {};

    try {
      const users = await UserModel.find({}).lean();
      store.users = users as any;
      counts.users = users.length;

      const classes = await ClassModel.find({}).lean();
      store.classes = classes.map((classRecord) => toStoreClass(classRecord as Record<string, any>)) as any;
      counts.classes = classes.length;

      const teachers = await TeacherModel.find({}).lean();
      store.teachers = teachers.map((teacher) => {
        const user = store.users.find((item) => item._id === teacher.userId);
        return {
          ...teacher,
          name: teacher.name || user?.name || '',
          email: teacher.email || user?.email || '',
        };
      }) as any;
      counts.teachers = teachers.length;
      store.classes = store.classes.map((classRecord) => ({
        ...classRecord,
        classTeacherName: store.findTeacherById(classRecord.classTeacherId || '')?.name || '',
      }));

      const subjects = await SubjectModel.find({}).lean();
      store.subjects = subjects as any;
      counts.subjects = subjects.length;

      const students = await StudentModel.find({}).lean();
      store.students = students as any;
      counts.students = students.length;

      const attendance = await AttendanceModel.find({}).lean();
      store.attendance = attendance.flatMap((sheet: any) => {
        if (Array.isArray(sheet.records)) {
          return sheet.records.map((record: any) => ({
            _id: `${sheet._id}_${record.studentId}`,
            studentId: record.studentId,
            classId: sheet.classId,
            teacherId: sheet.takenBy,
            date: sheet.date,
            status: record.status === 'OnLeave' ? 'Leave' : record.status,
            remarks: record.remarks || '',
            markedBy: sheet.takenBy,
          }));
        }
        return [sheet];
      }) as any;
      counts.attendance = attendance.length;

      const exams = await ExamModel.find({}).lean();
      store.exams = exams as any;
      counts.exams = exams.length;

      const results = await ResultModel.find({}).lean();
      store.results = results as any;
      counts.results = results.length;

      const resultAuditLogs = await ResultAuditLogModel.find({}).sort({ createdAt: 1 }).lean();
      store.resultAuditLog = resultAuditLogs.map((entry: any) => ({
        _id: String(entry._id),
        examId: entry.examId,
        classId: entry.classId,
        studentId: entry.studentId,
        action: entry.action,
        actorId: entry.performedBy,
        reason: entry.reason || entry.details?.reason,
        createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
      })) as any;
      counts.resultAuditLogs = resultAuditLogs.length;

      const timetable = await TimetableModel.find({}).lean();
      store.timetable = timetable as any;
      counts.timetable = timetable.length;

      const feeStructures = await FeeStructureModel.find({}).lean();
      store.feeStructures = feeStructures as any;
      counts.feeStructures = feeStructures.length;

      const feePayments = await FeePaymentModel.find({}).lean();
      store.feePayments = feePayments as any;
      counts.feePayments = feePayments.length;

      const notifications = await NotificationModel.find({}).lean();
      store.notifications = notifications as any;
      counts.notifications = notifications.length;
      const durationMs = Date.now() - start;
      const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);

      dbMonitor.log({
        operation: 'FIND',
        collection: 'all_collections',
        details: `Loaded ${totalDocs} documents from MongoDB collections into active portal memory`,
        status: 'success',
        durationMs,
        dataPreview: counts,
      });

      return { success: true, counts };
    } catch (err: any) {
      dbMonitor.log({
        operation: 'FIND',
        collection: 'all_collections',
        details: `Failed to load from MongoDB: ${err.message}`,
        status: 'failed',
        durationMs: Date.now() - start,
      });
      throw err;
    }
  }

  /**
   * Write-through persistence for individual document mutations
   */
  public async writeThrough(
    collection: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    documentId: string,
    data?: any
  ): Promise<void> {
    const start = Date.now();

    if (!this.isConnected()) {
      const error = new Error('MongoDB is disconnected; the change was not persisted.');
      dbMonitor.log({
        operation,
        collection,
        details: `${operation} failed for ${collection} [${documentId}]: MongoDB is disconnected`,
        status: 'failed',
        durationMs: Date.now() - start,
        targetId: documentId,
      });
      throw error;
    }

    try {
      const modelMap: Record<string, typeof UserModel> = {
        users: UserModel,
        classes: ClassModel,
        teachers: TeacherModel,
        subjects: SubjectModel,
        students: StudentModel,
        attendance: AttendanceModel,
        exams: ExamModel,
        results: ResultModel,
        timetable: TimetableModel,
        feestructures: FeeStructureModel,
        feepayments: FeePaymentModel,
        notifications: NotificationModel,
        resultauditlogs: ResultAuditLogModel,
      };

      const Model = modelMap[collection.toLowerCase()];
      if (!Model) {
        throw new Error(`No MongoDB model is configured for collection "${collection}".`);
      }

      if (operation === 'DELETE') {
        await Model.deleteOne({ _id: documentId });
      } else if (collection.toLowerCase() === 'classes') {
        await ClassModel.updateOne(
          { _id: documentId },
          { $set: toMongoClass(data || {}) },
          { upsert: true }
        );
      } else {
        await Model.updateOne({ _id: documentId }, { $set: data }, { upsert: true });
      }

      const duration = Date.now() - start;
      console.log(`[MongoSync] Persisted ${operation} to MongoDB collection ${collection} (${duration}ms)`);
      dbMonitor.log({
        operation,
        collection,
        details: `${operation} on ${collection} [${documentId}]`,
        status: 'success',
        durationMs: duration,
        targetId: documentId,
        dataPreview: data ? { ...data, passwordHash: undefined } : undefined,
      });
    } catch (error: any) {
      dbMonitor.log({
        operation,
        collection,
        details: `Write-through failed for ${collection} [${documentId}]: ${error.message}`,
        status: 'failed',
        durationMs: Date.now() - start,
        targetId: documentId,
      });
      throw error;
    }
  }

  /**
   * Get collection documents and schema summary
   */
  public async getCollectionDocuments(
    collectionName: string,
    options?: { page?: number; limit?: number; search?: string }
  ): Promise<{
    collection: string;
    total: number;
    page: number;
    totalPages: number;
    documents: any[];
    source: 'mongodb' | 'store';
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 25;
    const search = options?.search?.toLowerCase().trim();

    // Map store collections
    const storeMap: Record<string, () => any[]> = {
      users: () => store.getUsers(),
      classes: () => store.getClasses(),
      teachers: () => store.getTeachers(),
      subjects: () => store.getSubjects(),
      students: () => store.students,
      attendance: () => store.attendance,
      exams: () => store.exams,
      results: () => store.results,
      timetable: () => store.timetable,
      feestructures: () => store.feeStructures,
      feepayments: () => store.feePayments,
      notifications: () => store.notifications,
    };

    const getter = storeMap[collectionName.toLowerCase()];
    if (!getter) {
      throw new Error(`Unknown collection: ${collectionName}`);
    }

    let allDocs = getter();

    if (search) {
      allDocs = allDocs.filter((doc) => {
        const str = JSON.stringify(doc).toLowerCase();
        return str.includes(search);
      });
    }

    const total = allDocs.length;
    const startIndex = (page - 1) * limit;
    const paginated = allDocs.slice(startIndex, startIndex + limit);

    return {
      collection: collectionName,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      documents: paginated,
      source: this.isConnected() ? 'mongodb' : 'store',
    };
  }
}

export const mongoSync = new MongoSyncService();

// Register store mutation listener so all data actions persist to MongoDB & dbMonitor
store.setMutationListener((collection, operation, id, data) => {
  mongoSync.writeThrough(collection, operation, id, data);
});

export default mongoSync;
