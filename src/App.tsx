import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

/** Apple-style full-page skeleton shown while a route chunk streams in. */
function PageFallback() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen flex-col gap-6 bg-[#f5f5f7] px-6 py-10">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-black/10" />
      <div className="h-4 w-96 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
        <div className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
        <div className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
    </div>
  );
}

const lazyPage = <T extends React.ComponentType<any>>(
  factory: () => Promise<Record<string, T>>,
  name: string
): React.LazyExoticComponent<T> =>
  lazy(() => factory().then((module) => ({ default: module[name] })));

function TestEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/staff/tests/${id ?? ''}`} replace />;
}

const Landing = lazyPage(() => import('./pages/Landing'), 'Landing');
const Developers = lazyPage(() => import('./pages/Developers'), 'Developers');
const Convenors = lazyPage(() => import('./pages/Convenors'), 'Convenors');
const Login = lazyPage(() => import('./pages/Login'), 'Login');
const NotFound = lazyPage(() => import('./pages/NotFound'), 'NotFound');

const StudentDashboard = lazyPage(() => import('./pages/student/StudentDashboard'), 'StudentDashboard');
const MyTests = lazyPage(() => import('./pages/student/MyTests'), 'MyTests');
const Instructions = lazyPage(() => import('./pages/student/Instructions'), 'Instructions');
const StudentResults = lazyPage(() => import('./pages/student/StudentResults'), 'StudentResults');
const StudentProfile = lazyPage(() => import('./pages/student/StudentExtras'), 'StudentProfile');
const StudentSupport = lazyPage(() => import('./pages/student/StudentExtras'), 'StudentSupport');
const WaitingRoom = lazyPage(() => import('./pages/student/WaitingRoom'), 'WaitingRoom');
const Exam = lazyPage(() => import('./pages/student/Exam'), 'Exam');

const StaffDashboard = lazyPage(() => import('./pages/staff/StaffDashboard'), 'StaffDashboard');
const TestManagement = lazyPage(() => import('./pages/staff/TestManagement'), 'TestManagement');
const TestBuilder = lazyPage(() => import('./pages/staff/TestBuilder'), 'TestBuilder');
const TestWorkspace = lazyPage(() => import('./pages/staff/TestWorkspace'), 'TestWorkspace');
const StaffStudents = lazyPage(() => import('./pages/staff/StaffStudents'), 'StaffStudents');
const StaffProfile = lazyPage(() => import('./pages/staff/StaffProfile'), 'StaffProfile');
const EditRequests = lazyPage(() => import('./pages/staff/EditRequests'), 'EditRequests');
const QuestionBank = lazyPage(() => import('./pages/staff/QuestionBank'), 'QuestionBank');
const StaffResults = lazyPage(() => import('./pages/staff/StaffResults'), 'StaffResults');
const SecurityEvents = lazyPage(() => import('./pages/staff/SecurityEvents'), 'SecurityEvents');
const AuditLogs = lazyPage(() => import('./pages/staff/AuditLogs'), 'AuditLogs');

const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const StudentManagement = lazyPage(() => import('./pages/admin/StudentManagement'), 'StudentManagement');
const StaffManagement = lazyPage(() => import('./pages/admin/StaffManagement'), 'StaffManagement');
const EventManagement = lazyPage(() => import('./pages/admin/EventManagement'), 'EventManagement');

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="/convenors" element={<Convenors />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/student"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/tests"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <MyTests />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/instructions"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <Instructions />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/results"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentResults />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/profile"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/support"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentSupport />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/tests/:id/waiting"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <WaitingRoom />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/tests/:id/exam"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <Exam />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/tests"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <TestManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/tests/new"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <TestBuilder />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/tests/:id"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <TestWorkspace />
                </ProtectedRoute>
              }
            />

            <Route path="/staff/tests/:id/edit" element={<TestEditRedirect />} />

            <Route
              path="/staff/students"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <StaffStudents />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/profile"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <StaffProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/questions"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <QuestionBank />
                </ProtectedRoute>
              }
            />

            <Route path="/staff/live" element={<Navigate to="/staff/tests" replace />} />

            <Route
              path="/staff/edit-requests"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <EditRequests />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/results"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <StaffResults />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/security"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <SecurityEvents />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/audit"
              element={
                <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'DEVELOPER']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/students"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <StudentManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <StaffManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/events"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <EventManagement />
                </ProtectedRoute>
              }
            />

            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}