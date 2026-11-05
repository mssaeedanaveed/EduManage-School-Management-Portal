import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  HardDrive,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Download,
  Upload,
  Layers,
  Table as TableIcon,
  Code,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  Zap,
  Clock,
  ArrowRight,
  Trash2,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../api/axios.js';

interface CollectionStat {
  name: string;
  label: string;
  model: string;
  documentCount: number;
}

interface DbStatus {
  isConnected: boolean;
  isConnecting: boolean;
  mode: string;
  readyState: number;
  statusText: string;
  databaseName: string;
  host: string;
  port: number;
  maskedUri: string | null;
  latencyMs: number | null;
  mongooseVersion: string;
  totalDocuments: number;
  collectionsCount: number;
  collections: CollectionStat[];
  lastError: string | null;
}

interface DbLog {
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

interface DbMetrics {
  totalOperations: number;
  totalReads: number;
  totalWrites: number;
  totalSyncs: number;
  errorCount: number;
  avgDurationMs: number;
  lastOperationAt: string | null;
  uptimeSeconds: number;
}

export default function DatabaseMonitor() {
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'logs' | 'metrics'>('overview');
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [metrics, setMetrics] = useState<DbMetrics | null>(null);
  const [logs, setLogs] = useState<DbLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Connection form state
  const [uriInput, setUriInput] = useState('');
  const [atlasEmail, setAtlasEmail] = useState('mssaeedanaveed@gmail.com');
  const [dbUsername, setDbUsername] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [clusterHost, setClusterHost] = useState('');
  const [databaseName, setDatabaseName] = useState('school_portal');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [copiedUri, setCopiedUri] = useState(false);

  // Collections Inspector state
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [collectionDocs, setCollectionDocs] = useState<any[]>([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [viewFormat, setViewFormat] = useState<'table' | 'json'>('table');
  const [inspectModalDoc, setInspectModalDoc] = useState<any | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Log filters
  const [logFilterOp, setLogFilterOp] = useState('all');
  const [logFilterCol, setLogFilterCol] = useState('all');

  const fetchStatusAndMetrics = useCallback(async () => {
    try {
      const [resStatus, resMetrics] = await Promise.all([
        api.get('/api/database/status'),
        api.get('/api/database/metrics'),
      ]);

      if (resStatus.data?.success) {
        setStatus(resStatus.data.data);
      }
      if (resMetrics.data?.success) {
        setMetrics(resMetrics.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load DB telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (logFilterOp !== 'all') params.operation = logFilterOp;
      if (logFilterCol !== 'all') params.collection = logFilterCol;

      const res = await api.get('/api/database/logs', { params });
      if (res.data?.success) {
        setLogs(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, [logFilterOp, logFilterCol]);

  const fetchCollectionDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get(`/api/database/collections/${selectedCollection}`, {
        params: {
          page: collectionPage,
          limit: 25,
          search: collectionSearch,
        },
      });
      if (res.data?.success) {
        setCollectionDocs(res.data.data.documents || []);
        setCollectionTotal(res.data.data.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch collection docs:', err);
      setCollectionDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedCollection, collectionPage, collectionSearch]);

  useEffect(() => {
    fetchStatusAndMetrics();
    fetchLogs();
  }, [fetchStatusAndMetrics, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'collections') {
      fetchCollectionDocs();
    }
  }, [activeTab, selectedCollection, collectionPage, collectionSearch, fetchCollectionDocs]);

  // Periodic polling for live monitor logs
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(() => {
      fetchLogs();
      fetchStatusAndMetrics();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, fetchLogs, fetchStatusAndMetrics]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasManualUri = uriInput.trim().length > 0;
    const hasAtlasFields =
      atlasEmail.trim().length > 0 &&
      dbUsername.trim().length > 0 &&
      dbPassword.trim().length > 0 &&
      clusterHost.trim().length > 0 &&
      databaseName.trim().length > 0;

    if (!hasManualUri && !hasAtlasFields) {
      setNotice({
        type: 'error',
        text: 'Please provide either a MongoDB connection string or the required Atlas details to connect.',
      });
      return;
    }

    setActionLoading(true);
    setNotice({ type: 'info', text: 'Attempting connection to MongoDB...' });

    try {
      const payload = hasManualUri
        ? { uri: uriInput }
        : {
            atlasEmail,
            username: dbUsername,
            password: dbPassword,
            host: clusterHost,
            databaseName,
          };

      const res = await api.post('/api/database/connect', payload);
      if (res.data?.success) {
        setNotice({
          type: 'success',
          text: res.data.message || 'Connected successfully to MongoDB!',
        });
        setUriInput('');
        setDbPassword('');
        await fetchStatusAndMetrics();
        await fetchLogs();
      } else {
        setNotice({
          type: 'error',
          text: res.data.message || 'Failed to connect to MongoDB.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Connection failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/database/disconnect');
      setNotice({
        type: 'info',
        text: res.data.message || 'Disconnected from MongoDB. Reverted to embedded store.',
      });
      await fetchStatusAndMetrics();
      await fetchLogs();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.response?.data?.message || 'Failed to disconnect',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncToMongo = async (direction: 'push' | 'pull') => {
    setActionLoading(true);
    setNotice({
      type: 'info',
      text: direction === 'push' ? 'Pushing all records to MongoDB...' : 'Pulling data from MongoDB...',
    });

    try {
      const res = await api.post('/api/database/sync', { direction });
      if (res.data?.success) {
        setNotice({
          type: 'success',
          text: res.data.message || 'Synchronization completed successfully!',
        });
        await fetchStatusAndMetrics();
        await fetchLogs();
        if (activeTab === 'collections') {
          await fetchCollectionDocs();
        }
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.response?.data?.message || 'Synchronization error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm('Reset database to clean default school demo records?')) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/database/seed');
      setNotice({
        type: 'success',
        text: res.data.message || 'Demo records restored successfully.',
      });
      await fetchStatusAndMetrics();
      await fetchLogs();
      if (activeTab === 'collections') {
        await fetchCollectionDocs();
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.response?.data?.message || 'Seed failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.post('/api/database/logs/clear');
      setLogs([]);
      setNotice({ type: 'info', text: 'Operation logs cleared.' });
    } catch (err: any) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleExportJson = () => {
    window.open('/api/database/export', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Database & MongoDB Monitor
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    status?.isConnected
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status?.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {status?.isConnected ? 'MongoDB Connected' : 'Embedded Datastore Active'}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Live database connectivity, real-time collection document browser, and telemetry operations feed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                fetchStatusAndMetrics();
                fetchLogs();
              }}
              className="px-3.5 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              onClick={() => handleSyncToMongo('push')}
              disabled={actionLoading || !status?.isConnected}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                status?.isConnected
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Push all memory records to MongoDB"
            >
              <Upload className="w-4 h-4" />
              Push to MongoDB
            </button>

            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-200 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export DB (JSON)
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-sm flex items-center justify-between border ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : notice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {notice.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              {notice.type === 'info' && <Activity className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{notice.text}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs font-semibold hover:underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Status Last Error Tip if Atlas IP is not whitelisted */}
        {!status?.isConnected && status?.lastError && (
          <div className="mt-4 p-4 rounded-xl text-xs bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">MongoDB Atlas Notice:</p>
              <p>{status.lastError}</p>
              <p className="text-[11px] text-amber-800">
                Add the server's public IP address under MongoDB Atlas <strong>Network Access</strong>. Avoid allowing access from anywhere in production. Once the IP rule is active, try connecting again.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Connection Health */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engine Status</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {status?.isConnected ? 'MongoDB Driver 9.x' : 'Embedded Hybrid'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {status?.isConnected ? `Cluster: ${status.databaseName}` : 'In-memory persistent store'}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${
              status?.isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <Server className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Ping & Latency */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ping Latency</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {status?.latencyMs !== null && status?.latencyMs !== undefined ? `${status.latencyMs} ms` : '< 1 ms (Local)'}
            </h3>
            <p className="text-xs text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> Excellent response time
            </p>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Records */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Documents</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {status?.totalDocuments || 0}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Across 12 active collections</p>
          </div>
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Operations Logged */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operations Logged</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {metrics?.totalOperations || 0} ops
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics?.totalWrites || 0} writes • {metrics?.totalReads || 0} queries
            </p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 px-4 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          Connection & Configuration
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 py-3 px-4 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'collections'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          Collections Explorer (Data Monitor)
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-3 px-4 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live Operation Stream ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 py-3 px-4 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'metrics'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Zap className="w-4 h-4" />
          Database Telemetry
        </button>
      </div>

      {/* Tab 1: Connection & Configuration */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connect Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                Connect MongoDB Database
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Provide your MongoDB Atlas or local MongoDB connection URI to link this portal directly to your database.
              </p>
            </div>

            {/* Current Active URI info */}
            {status?.isConnected && status?.maskedUri && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Active MongoDB URI</p>
                    <code className="text-sm text-emerald-900 font-mono font-medium block mt-0.5">
                      {status.maskedUri}
                    </code>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Connection Input Form */}
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  MongoDB Connection String (URI)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={uriInput}
                    onChange={(e) => setUriInput(e.target.value)}
                    placeholder="mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/school_portal?retryWrites=true&w=majority"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Paste the full URI if you already have it. Otherwise, fill in the Atlas details below and the portal will build the connection automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Atlas Account Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={atlasEmail}
                    onChange={(e) => setAtlasEmail(e.target.value)}
                    placeholder="mssaeedanaveed@gmail.com"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="md:col-span-2 -mt-2 text-xs text-slate-500">
                  Your Atlas sign-in email is informational only. Use a MongoDB database user and password created under Atlas Database Access.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Database Username
                  </label>
                  <input
                    type="text"
                    value={dbUsername}
                    onChange={(e) => setDbUsername(e.target.value)}
                    placeholder="school_user"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Database Password
                  </label>
                  <input
                    type="password"
                    value={dbPassword}
                    onChange={(e) => setDbPassword(e.target.value)}
                    placeholder="Enter MongoDB Atlas password"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Cluster Host / SRV Host
                  </label>
                  <input
                    type="text"
                    value={clusterHost}
                    onChange={(e) => setClusterHost(e.target.value)}
                    placeholder="cluster0.abcde.mongodb.net"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Database Name
                  </label>
                  <input
                    type="text"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    placeholder="school_portal"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Sample Quick Links */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-slate-400 font-medium py-1">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => setUriInput('mongodb://localhost:27017/school_portal')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono cursor-pointer"
                >
                  localhost:27017
                </button>
                <button
                  type="button"
                  onClick={() => setUriInput('mongodb://127.0.0.1:27017/edumanage')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono cursor-pointer"
                >
                  127.0.0.1:27017
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Connect to MongoDB
                </button>

                <button
                  type="button"
                  onClick={handleSeedDatabase}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  Reset Sample Data
                </button>
              </div>
            </form>

            {/* Quick Actions Bar */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Database Management Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleSyncToMongo('push')}
                  disabled={actionLoading || !status?.isConnected}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-emerald-600 mb-1" />
                  <p className="text-xs font-bold text-slate-900">Push Memory → Mongo</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Saves all 12 collections to MongoDB</p>
                </button>

                <button
                  onClick={() => handleSyncToMongo('pull')}
                  disabled={actionLoading || !status?.isConnected}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-blue-600 mb-1" />
                  <p className="text-xs font-bold text-slate-900">Pull Mongo → Memory</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Re-reads records from MongoDB</p>
                </button>

                <button
                  onClick={handleExportJson}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600 mb-1" />
                  <p className="text-xs font-bold text-slate-900">Export JSON Backup</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Download full snapshot</p>
                </button>
              </div>
            </div>
          </div>

          {/* Guide & Atlas Instructions */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base">MongoDB Atlas Setup Guide</h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Connect your cloud database in 3 quick steps to monitor all student, teacher, and academic records live in MongoDB Compass or Atlas.
              </p>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Create a free cluster at <strong className="text-white">mongodb.com/cloud/atlas</strong>.</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Create a database user under <strong>Database Access</strong>, then allow your app server's public IP under <strong>Network Access</strong>.</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Click <strong>Connect → Drivers</strong>, copy the SRV URI, replace <code className="text-amber-300">&lt;password&gt;</code>, and click Connect!</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Automatic seed upon connection</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 11 Collections Ready
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Collections Explorer (Data Monitor) */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          {/* Collection Selection Chips */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Select Collection to Inspect & Monitor
            </p>
            <div className="flex flex-wrap gap-2">
              {status?.collections.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setSelectedCollection(c.name);
                    setCollectionPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                    selectedCollection === c.name
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{c.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedCollection === c.name
                        ? 'bg-indigo-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.documentCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Collection Explorer Toolbar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-900 capitalize text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Collection: <span className="font-mono text-indigo-600 font-bold">{selectedCollection}</span>
                <span className="text-xs font-normal text-slate-500">
                  ({collectionTotal} documents)
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter documents..."
                  value={collectionSearch}
                  onChange={(e) => {
                    setCollectionSearch(e.target.value);
                    setCollectionPage(1);
                  }}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* View switch */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewFormat('table')}
                  className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer ${
                    viewFormat === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  Table
                </button>
                <button
                  onClick={() => setViewFormat('json')}
                  className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer ${
                    viewFormat === 'json' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                  title="Raw JSON View"
                >
                  <Code className="w-3.5 h-3.5" />
                  JSON
                </button>
              </div>

              <button
                onClick={fetchCollectionDocs}
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Refresh Documents"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Documents Content */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loadingDocs ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-sm">Reading documents from {status?.isConnected ? 'MongoDB' : 'active store'}...</p>
              </div>
            ) : collectionDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No documents found matching criteria</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing search filters or seed demo data</p>
              </div>
            ) : viewFormat === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold tracking-wider">
                      <th className="py-3 px-4">_id</th>
                      {Object.keys(collectionDocs[0] || {})
                        .filter((k) => k !== '_id' && k !== '__v' && typeof collectionDocs[0][k] !== 'object')
                        .slice(0, 5)
                        .map((key) => (
                          <th key={key} className="py-3 px-4 capitalize">
                            {key}
                          </th>
                        ))}
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                    {collectionDocs.map((doc, idx) => (
                      <tr key={doc._id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-indigo-700">
                          {doc._id || '-'}
                        </td>
                        {Object.keys(collectionDocs[0] || {})
                          .filter((k) => k !== '_id' && k !== '__v' && typeof collectionDocs[0][k] !== 'object')
                          .slice(0, 5)
                          .map((key) => (
                            <td key={key} className="py-3 px-4 truncate max-w-xs font-sans">
                              {String(doc[key] ?? '-')}
                            </td>
                          ))}
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            onClick={() => setInspectModalDoc(doc)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                <pre>{JSON.stringify(collectionDocs, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Real-Time Activity & Operations Stream */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Live Database Operation Stream
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Real-time capture of every database query, insertion, update, and sync operation across the portal.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Operation filter */}
              <select
                value={logFilterOp}
                onChange={(e) => setLogFilterOp(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Operations</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="FIND">FIND</option>
                <option value="DELETE">DELETE</option>
                <option value="SYNC">SYNC</option>
                <option value="SEED">SEED</option>
              </select>

              <button
                onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  autoRefreshLogs
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${autoRefreshLogs ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {autoRefreshLogs ? 'Live Stream (3s)' : 'Paused'}
              </button>

              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm">No logged operations yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Operation</th>
                      <th className="py-2.5 px-3">Collection</th>
                      <th className="py-2.5 px-3 font-sans">Details</th>
                      <th className="py-2.5 px-3 text-right">Duration</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => {
                      const opColors: Record<string, string> = {
                        INSERT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        UPDATE: 'bg-blue-100 text-blue-800 border-blue-300',
                        DELETE: 'bg-rose-100 text-rose-800 border-rose-300',
                        FIND: 'bg-purple-100 text-purple-800 border-purple-300',
                        SYNC: 'bg-amber-100 text-amber-800 border-amber-300',
                        SEED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                        CONNECT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
                        DISCONNECT: 'bg-slate-200 text-slate-800 border-slate-300',
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                opColors[log.operation] || 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {log.operation}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {log.collection}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-sans max-w-md truncate">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {log.durationMs}ms
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {log.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 inline" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Telemetry Metrics */}
      {activeTab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Throughput & Counter Metrics
            </h3>

            <div className="space-y-3 font-sans text-sm">
              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Total Read Queries</span>
                <span className="font-bold text-slate-900 font-mono">{metrics?.totalReads || 0}</span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Total Write Mutations (Inserts/Updates)</span>
                <span className="font-bold text-slate-900 font-mono">{metrics?.totalWrites || 0}</span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Full Synchronizations</span>
                <span className="font-bold text-slate-900 font-mono">{metrics?.totalSyncs || 0}</span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Error Count</span>
                <span className="font-bold text-rose-600 font-mono">{metrics?.errorCount || 0}</span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600">Average Operation Latency</span>
                <span className="font-bold text-slate-900 font-mono">{metrics?.avgDurationMs || 0} ms</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Engine Architecture
            </h3>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                <strong>Dual-Layer High Availability Architecture:</strong> The application runs a hybrid persistence model combining an in-memory high-throughput data store and Mongoose ODM drivers.
              </p>
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 space-y-1">
                <p className="font-bold text-xs">Write-Through Replication:</p>
                <p className="text-[11px]">
                  When MongoDB is connected, all student enrollments, fee payments, attendance logs, and report cards immediately persist to MongoDB collections in parallel.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-[11px] text-slate-700">
                <p>Mongoose Version: {status?.mongooseVersion || '9.11.0'}</p>
                <p>Target Database: {status?.databaseName || 'school_portal'}</p>
                <p>Connection State: {status?.statusText || 'Active'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Document Modal */}
      {inspectModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Document Details: <span className="font-mono text-indigo-600">{inspectModalDoc._id}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Collection: {selectedCollection}</p>
              </div>
              <button
                onClick={() => setInspectModalDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[480px] overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs">
              <pre>{JSON.stringify(inspectModalDoc, null, 2)}</pre>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(inspectModalDoc, null, 2));
                  alert('JSON copied to clipboard!');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy JSON
              </button>
              <button
                onClick={() => setInspectModalDoc(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
