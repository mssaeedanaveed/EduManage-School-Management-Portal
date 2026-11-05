import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users2,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  KeyRound,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '../types/index.js';
import api from '../api/axios.js';

interface DirectoryAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  badge: string;
  detail: string;
  defaultPassword: string;
}

// Fallback initial directory accounts if offline/loading
const DEFAULT_DIRECTORY: Record<UserRole, DirectoryAccount[]> = {
  accountant: [],
  teacher: [
    {
      id: 'usr_teacher_01',
      name: 'Prof. Marcus Sterling',
      role: 'teacher',
      email: 'marcus.sterling@school.edu',
      defaultPassword: 'password123',
      badge: 'ID: TCH-2024-001 • Head of Mathematics',
      detail: 'Assigned: Grade 10-A & 9-A • Subjects: Mathematics, Physics, Computer Science',
    },
    {
      id: 'usr_teacher_02',
      name: 'Dr. Sarah Jenkins',
      role: 'teacher',
      email: 'sarah.jenkins@school.edu',
      defaultPassword: 'password123',
      badge: 'ID: TCH-2024-002 • Senior Faculty',
      detail: 'Assigned: Grade 10-A & 10-B • Subjects: Chemistry, English Literature',
    },
  ],
  student: [
    {
      id: 'usr_student_01',
      name: 'Aria Montgomery',
      role: 'student',
      email: 'aria.montgomery@school.edu',
      defaultPassword: 'password123',
      badge: 'Roll: 10-A-01 • Class: Grade 10 - A',
      detail: 'Parent: Robert Montgomery • Attendance: 95% • Fees: Fully Paid',
    },
    {
      id: 'usr_student_02',
      name: 'Ethan Cole',
      role: 'student',
      email: 'ethan.cole@school.edu',
      defaultPassword: 'password123',
      badge: 'Roll: 10-A-02 • Class: Grade 10 - A',
      detail: 'Parent: Robert Montgomery • Attendance: 90% • Fees: $300 Balance',
    },
    {
      id: 'usr_student_03',
      name: 'Sophia Patel',
      role: 'student',
      email: 'sophia.patel@school.edu',
      defaultPassword: 'password123',
      badge: 'Roll: 10-A-03 • Class: Grade 10 - A',
      detail: 'Parent: Vikram Patel • Attendance: 100% • Fees: $650 Balance',
    },
  ],
  parent: [
    {
      id: 'usr_parent_01',
      name: 'Robert Montgomery',
      role: 'parent',
      email: 'robert.montgomery@school.edu',
      defaultPassword: 'password123',
      badge: 'Parent of 2 Students',
      detail: 'Linked Children: Aria Montgomery (10-A-01) & Ethan Cole (10-A-02)',
    },
    {
      id: 'usr_parent_02',
      name: 'Vikram Patel',
      role: 'parent',
      email: 'vikram.patel@school.edu',
      defaultPassword: 'password123',
      badge: 'Parent of 1 Student',
      detail: 'Linked Child: Sophia Patel (10-A-03)',
    },
  ],
  admin: [
    {
      id: 'usr_admin_01',
      name: 'Dr. Eleanor Vance (Principal)',
      role: 'admin',
      email: 'admin@school.edu',
      defaultPassword: 'password123',
      badge: 'Principal Administrator',
      detail: 'Full Administrative Control over campus operations',
    },
  ],
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [activePortal, setActivePortal] = useState<UserRole>('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Directory accounts fetched from live backend
  const [directoryAccounts, setDirectoryAccounts] = useState<DirectoryAccount[]>([]);
  const [searchDirectory, setSearchDirectory] = useState('');

  // Fetch live accounts from server
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const res = await api.get('/api/auth/directory');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setDirectoryAccounts(res.data.data);
        }
      } catch {
        // Fallback to static accounts if server error
        const combined = [
          ...DEFAULT_DIRECTORY.teacher,
          ...DEFAULT_DIRECTORY.student,
          ...DEFAULT_DIRECTORY.parent,
          ...DEFAULT_DIRECTORY.admin,
        ];
        setDirectoryAccounts(combined);
      }
    };
    fetchDirectory();
  }, []);

  // When switching portals, clear inputs and show the clean login form
  const handlePortalSwitch = (role: UserRole) => {
    setActivePortal(role);
    setError(null);
    setSuccessInfo(null);
    setEmail('');
    setPassword('');
  };

  // When clicking "Fill Email & Password" for an account
  const handleFillCredentials = (acc: DirectoryAccount) => {
    setEmail(acc.email);
    setPassword(acc.defaultPassword || 'password123');
    setError(null);
    setSuccessInfo(
      `Filled credentials for ${acc.name} (${acc.email}). Click the "Sign In" button below to log in.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
      return;
    }

    setError(null);
    setSuccessInfo(null);
    setLoading(true);

    const res = await login(email.trim(), password.trim());
    setLoading(false);

    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.message || 'Invalid email or password. Please verify your credentials.');
    }
  };

  const portalConfig = {
    accountant: {
      title: 'Accountant Portal',
      subtitle: 'Collect fees, review payment proofs and access financial reports.',
      icon: UserCheck,
      color: 'emerald',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      activeTabClass: 'border-emerald-600 bg-emerald-50/80 text-emerald-700 shadow-xs',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      emailPlaceholder: 'e.g. accountant@school.edu',
      emailLabel: 'Accountant Email Address',
    },
    teacher: {
      title: 'Teacher & Faculty Portal',
      subtitle: 'Each teacher has a separate portal. Enter your faculty email and password.',
      icon: UserCheck,
      color: 'indigo',
      badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      activeTabClass: 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      emailPlaceholder: 'e.g. marcus.sterling@school.edu or sarah.jenkins@school.edu',
      emailLabel: 'Teacher Email Address',
    },
    student: {
      title: 'Student Portal',
      subtitle: 'Each student has an individual portal with personal grades, timetable, and attendance.',
      icon: GraduationCap,
      color: 'cyan',
      badgeBg: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      activeTabClass: 'border-cyan-600 bg-cyan-50/80 text-cyan-700 shadow-xs',
      buttonBg: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      emailPlaceholder: 'e.g. aria.montgomery@school.edu or sophia.patel@school.edu',
      emailLabel: 'Student Email Address',
    },
    parent: {
      title: 'Parent & Family Portal',
      subtitle: 'Each parent has a dedicated portal to view their linked child or children.',
      icon: Users2,
      color: 'amber',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
      activeTabClass: 'border-amber-600 bg-amber-50/80 text-amber-700 shadow-xs',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white',
      emailPlaceholder: 'e.g. robert.montgomery@school.edu or vikram.patel@school.edu',
      emailLabel: 'Parent Email Address',
    },
    admin: {
      title: 'Principal & Admin Workspace',
      subtitle: 'Full campus governance over faculty, students, timetables, and fee structures.',
      icon: ShieldCheck,
      color: 'purple',
      badgeBg: 'bg-purple-50 border-purple-200 text-purple-700',
      activeTabClass: 'border-purple-600 bg-purple-50/80 text-purple-700 shadow-xs',
      buttonBg: 'bg-purple-600 hover:bg-purple-700 text-white',
      emailPlaceholder: 'e.g. admin@school.edu',
      emailLabel: 'Admin Email Address',
    },
  }[activePortal];

  const CurrentPortalIcon = portalConfig.icon;

  // Filter directory accounts for the currently selected portal
  const currentPortalAccounts = (
    directoryAccounts.length > 0 ? directoryAccounts : DEFAULT_DIRECTORY[activePortal]
  ).filter((acc) => {
    const matchesRole = acc.role === activePortal;
    if (!matchesRole) return false;
    if (!searchDirectory.trim()) return true;
    const q = searchDirectory.toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      acc.badge.toLowerCase().includes(q) ||
      acc.detail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/25 mb-3">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">EduManage</h1>
        <p className="mt-1 text-sm text-slate-400">
          Individual Portals for Admins, Teachers, Students & Parents
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100">
          {/* Step 1: Select Which Portal to Log Into */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Select Portal to Log Into:
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Every user has an individual login
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePortalSwitch('teacher')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  activePortal === 'teacher'
                    ? portalConfig.activeTabClass
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-5 h-5 mb-1 text-indigo-600" />
                <span>Teacher</span>
              </button>

              <button
                type="button"
                onClick={() => handlePortalSwitch('student')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  activePortal === 'student'
                    ? 'border-cyan-600 bg-cyan-50/80 text-cyan-700 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-5 h-5 mb-1 text-cyan-600" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handlePortalSwitch('parent')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  activePortal === 'parent'
                    ? 'border-amber-600 bg-amber-50/80 text-amber-700 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users2 className="w-5 h-5 mb-1 text-amber-600" />
                <span>Parent</span>
              </button>

              <button
                type="button"
                onClick={() => handlePortalSwitch('admin')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  activePortal === 'admin'
                    ? 'border-purple-600 bg-purple-50/80 text-purple-700 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-5 h-5 mb-1 text-purple-600" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Active Portal Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <CurrentPortalIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800 tracking-tight">
                  {portalConfig.title}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${portalConfig.badgeBg}`}>
                  Individual Access
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {portalConfig.subtitle}
              </p>
            </div>
          </div>

          {/* Status Feedback Alerts */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Step 2: Explicit Email & Password Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {portalConfig.emailLabel}
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={portalConfig.emailPlaceholder}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-slate-400">Default: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">password123</code></span>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold ${portalConfig.buttonBg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-all cursor-pointer`}
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to {portalConfig.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Step 3: Registered Portal Accounts Directory */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Registered {activePortal.toUpperCase()} Accounts:
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Fill Email & Password" to test any specific person's portal
                </p>
              </div>

              {currentPortalAccounts.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchDirectory}
                    onChange={(e) => setSearchDirectory(e.target.value)}
                    placeholder="Filter names..."
                    className="pl-7 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg w-32 sm:w-36 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {currentPortalAccounts.map((acc) => {
                const isSelected = email.toLowerCase() === acc.email.toLowerCase();
                return (
                  <div
                    key={acc.email}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{acc.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                          {acc.badge}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-700 font-mono text-[11px]">
                          {acc.email}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Password: <code className="bg-slate-200/80 px-1 py-0.2 rounded font-mono text-slate-800 text-[10px]">{acc.defaultPassword || 'password123'}</code>
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                        {acc.detail}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFillCredentials(acc)}
                      className={`self-start sm:self-center shrink-0 px-3 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-transparent text-indigo-700 shadow-2xs'
                      }`}
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>{isSelected ? 'Filled' : 'Fill Email & Password'}</span>
                    </button>
                  </div>
                );
              })}

              {currentPortalAccounts.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No accounts found matching "{searchDirectory}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
