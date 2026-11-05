import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import Sidebar from './components/Sidebar.js';
import Navbar from './components/Navbar.js';

// Pages
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Students from './pages/Students.js';
import OldStudents from './pages/OldStudents.js';
import Teachers from './pages/Teachers.js';
import Classes from './pages/Classes.js';
import Subjects from './pages/Subjects.js';
import Attendance from './pages/Attendance.js';
import Results from './pages/Results.js';
import Timetable from './pages/Timetable.js';
import Fees from './pages/Fees.js';
import ParentPortal from './pages/ParentPortal.js';
import DatabaseMonitor from './pages/DatabaseMonitor.js';
import Notifications from './pages/Notifications.js';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard Overview';
    if (path === '/students') return 'Student Directory';
    if (path === '/old-students') return 'Old Students';
    if (path === '/teachers') return 'Faculty Management';
    if (path === '/classes') return 'Classes & Sections';
    if (path === '/subjects') return 'Subjects & Curriculum';
    if (path === '/attendance') return 'Attendance Management';
    if (path === '/results') return 'Examinations & Report Cards';
    if (path === '/timetable') return 'Class Timetables';
    if (path === '/fees') return 'Fee Management & Vouchers';
    if (path === '/parent-portal') return 'Parent & Family Portal';
    if (path === '/notifications') return 'Notifications & System Notices';
    if (path === '/database') return 'Database & MongoDB Monitor';
    return 'EduManage Portal';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-800 font-sans antialiased">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={getPageTitle()} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={
                <AppLayout>
                  <Navigate to="/dashboard" replace />
                </AppLayout>
              }
            />
            <Route
              path="/dashboard"
              element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              }
            />
            <Route
              path="/attendance"
              element={
                <AppLayout>
                  <Attendance />
                </AppLayout>
              }
            />
            <Route
              path="/results"
              element={
                <AppLayout>
                  <Results />
                </AppLayout>
              }
            />
            <Route
              path="/timetable"
              element={
                <AppLayout>
                  <Timetable />
                </AppLayout>
              }
            />
            <Route
              path="/fees"
              element={
                <AppLayout>
                  <Fees />
                </AppLayout>
              }
            />
            <Route
              path="/parent-portal"
              element={
                <AppLayout>
                  <ParentPortal />
                </AppLayout>
              }
            />
            <Route
              path="/notifications"
              element={
                <AppLayout>
                  <Notifications />
                </AppLayout>
              }
            />
          </Route>

          {/* Admin / Teacher Restricted Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'teacher']} />}>
            <Route
              path="/classes"
              element={
                <AppLayout>
                  <Classes />
                </AppLayout>
              }
            />
          </Route>

          {/* Admin Exclusive Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route
              path="/students"
              element={
                <AppLayout>
                  <Students />
                </AppLayout>
              }
            />
            <Route
              path="/old-students"
              element={
                <AppLayout>
                  <OldStudents />
                </AppLayout>
              }
            />
            <Route
              path="/teachers"
              element={
                <AppLayout>
                  <Teachers />
                </AppLayout>
              }
            />
            <Route
              path="/subjects"
              element={
                <AppLayout>
                  <Subjects />
                </AppLayout>
              }
            />
            <Route
              path="/database"
              element={
                <AppLayout>
                  <DatabaseMonitor />
                </AppLayout>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
