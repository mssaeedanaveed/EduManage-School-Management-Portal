export interface IDbLogEntry {
  id: string;
  timestamp: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'FIND' | 'CONNECT' | 'DISCONNECT' | 'SYNC' | 'SEED';
  collection: string;
  details: string;
  status: 'success' | 'failed';
  durationMs: number;
  targetId?: string;
  dataPreview?: any;
}

export interface IDbMetrics {
  totalOperations: number;
  totalReads: number;
  totalWrites: number;
  totalSyncs: number;
  errorCount: number;
  avgDurationMs: number;
  lastOperationAt: string | null;
  uptimeSeconds: number;
}

class DbMonitorService {
  private logs: IDbLogEntry[] = [];
  private maxLogs = 250;
  private startTime = Date.now();
  private totalOps = 0;
  private totalReads = 0;
  private totalWrites = 0;
  private totalSyncs = 0;
  private errorCount = 0;
  private totalDuration = 0;
  private lastOpTime: string | null = null;

  constructor() {
    this.log({
      operation: 'CONNECT',
      collection: 'system',
      details: 'EduManage Database Engine initialized (Hybrid Mongoose & Store mode)',
      status: 'success',
      durationMs: 1,
    });
  }

  public log(entry: Omit<IDbLogEntry, 'id' | 'timestamp'>): IDbLogEntry {
    const fullEntry: IDbLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.totalOps++;
    this.totalDuration += entry.durationMs;
    this.lastOpTime = fullEntry.timestamp;

    if (entry.status === 'failed') {
      this.errorCount++;
    }

    if (['FIND'].includes(entry.operation)) {
      this.totalReads++;
    } else if (['INSERT', 'UPDATE', 'DELETE'].includes(entry.operation)) {
      this.totalWrites++;
    } else if (['SYNC', 'SEED'].includes(entry.operation)) {
      this.totalSyncs++;
    }

    return fullEntry;
  }

  public getLogs(options?: {
    limit?: number;
    collection?: string;
    operation?: string;
    status?: string;
  }): IDbLogEntry[] {
    let filtered = this.logs;

    if (options?.collection && options.collection !== 'all') {
      filtered = filtered.filter(
        (l) => l.collection.toLowerCase() === options.collection!.toLowerCase()
      );
    }
    if (options?.operation && options.operation !== 'all') {
      filtered = filtered.filter(
        (l) => l.operation.toLowerCase() === options.operation!.toLowerCase()
      );
    }
    if (options?.status && options.status !== 'all') {
      filtered = filtered.filter((l) => l.status === options.status);
    }

    const limit = options?.limit || 50;
    return filtered.slice(0, limit);
  }

  public getMetrics(): IDbMetrics {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const avgDurationMs =
      this.totalOps > 0 ? Number((this.totalDuration / this.totalOps).toFixed(2)) : 0;

    return {
      totalOperations: this.totalOps,
      totalReads: this.totalReads,
      totalWrites: this.totalWrites,
      totalSyncs: this.totalSyncs,
      errorCount: this.errorCount,
      avgDurationMs,
      lastOperationAt: this.lastOpTime,
      uptimeSeconds,
    };
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

export const dbMonitor = new DbMonitorService();
export default dbMonitor;
