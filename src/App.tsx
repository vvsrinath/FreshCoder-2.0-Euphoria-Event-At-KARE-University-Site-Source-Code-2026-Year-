import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Developers } from './pages/Developers';
import { Convenors } from './pages/Convenors';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { MyTests } from './pages/student/MyTests';
import { Instructions } from './pages/student/Instructions';
import { StudentResults } from './pages/student/StudentResults';
import { StudentProfile, StudentSupport } from './pages/student/StudentExtras';
import { WaitingRoom } from './pages/student/WaitingRoom';
import { Exam } from './pages/student/Exam';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { TestManagement } from './pages/staff/TestManagement';
import { TestBuilder } from './pages/staff/TestBuilder';
import { QuestionBank } from './pages/staff/QuestionBank';
import { LiveMonitoring } from './pages/staff/LiveMonitoring';
import { EditRequests } from './pages/staff/EditRequests';
import { StaffResults } from './pages/staff/StaffResults';
import { SecurityEvents } from './pages/staff/SecurityEvents';
import { AuditLogs } from './pages/staff/AuditLogs';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentManagement } from './pages/admin/StudentManagement';
import { StaffManagement } from './pages/admin/StaffManagement';
import { EventManagement } from './pages/admin/EventManagement';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            } />
          
          <Route
            path="/student/tests"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <MyTests />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/instructions"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <Instructions />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/results"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <StudentResults />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/profile"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <StudentProfile />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/support"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <StudentSupport />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/tests/:id/waiting"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <WaitingRoom />
              </ProtectedRoute>
            } />
          
          <Route
            path="/student/tests/:id/exam"
            element={
            <ProtectedRoute roles={['STUDENT']}>
                <Exam />
              </ProtectedRoute>
            } />
          

          <Route
            path="/staff"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <StaffDashboard />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/tests"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <TestManagement />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/tests/new"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <TestBuilder />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/tests/:id/edit"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <TestBuilder />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/questions"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <QuestionBank />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/live"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <LiveMonitoring />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/edit-requests"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <EditRequests />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/results"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <StaffResults />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/security"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <SecurityEvents />
              </ProtectedRoute>
            } />
          
          <Route
            path="/staff/audit"
            element={
            <ProtectedRoute roles={['STAFF', 'SUPER_ADMIN']}>
                <AuditLogs />
              </ProtectedRoute>
            } />
          

          <Route
            path="/admin"
            element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'DEVELOPER']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          
          <Route
            path="/admin/students"
            element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
                <StudentManagement />
              </ProtectedRoute>
            } />
          
          <Route
            path="/admin/staff"
            element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
                <StaffManagement />
              </ProtectedRoute>
            } />
          
          <Route
            path="/admin/events"
            element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
                <EventManagement />
              </ProtectedRoute>
            } />
          

          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>);

}