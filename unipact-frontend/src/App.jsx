import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';

// Import ALL Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterSplit from './pages/RegisterSplit';
import CompanyDashboard from './pages/CompanyDashboard';
import CreateCampaign from './pages/CreateCampaign';
import ManageCampaign from './pages/ManageCampaign';
import StudentDashboard from './pages/StudentDashboard';
import QuestDetails from './pages/QuestDetails';
import QuestBoard from './pages/QuestBoard';
import SubmitDeliverable from './pages/SubmitDeliverable';
import AdminDashboard from './pages/AdminDashboard';
import CompanyRegister from './pages/CompanyRegister';
import StudentRegister from './pages/StudentRegister';
import Treasury from './pages/Treasury';
import StudentProfile from './pages/StudentProfile';
import ClubProfile from './pages/ClubProfile';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <Routes>
          {/* === PUBLIC ROUTES === */}
          {/* The "/" path is the default. It MUST point to LandingPage */}
          <Route path="/" element={< LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterSplit />} />
          <Route path="/register/company" element={<CompanyRegister />} />
          <Route path="/register/student" element={<StudentRegister />} />
          <Route path="/register/club" element={<StudentRegister />} />

          {/* === COMPANY ROUTES === */}
          <Route
            path="/company/dashboard"
            element={
              <ProtectedRoute allowedRole="COMPANY">
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-campaign/:id"
            element={
              <ProtectedRoute allowedRole="COMPANY">
                <ManageCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign/new"
            element={
              <ProtectedRoute allowedRole="COMPANY">
                <CreateCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/campaign/:id/manage"
            element={
              <ProtectedRoute allowedRole="COMPANY">
                <ManageCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/treasury"
            element={
              <ProtectedRoute allowedRole="COMPANY">
                <Treasury />
              </ProtectedRoute>
            }
          />

          {/* === STUDENT ROUTES === */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRole={['STUDENT', 'CLUB']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quest/deliver/:applicationId"
            element={
              <ProtectedRoute allowedRole={['STUDENT', 'CLUB']}>
                <SubmitDeliverable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quests"
            element={
              <ProtectedRoute allowedRole={['STUDENT', 'CLUB']}>
                <QuestBoard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quest/:id"
            element={
              <ProtectedRoute allowedRole={['STUDENT', 'CLUB']}>
                <QuestDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/club/profile/:id"
            element={
              <ProtectedRoute allowedRole={['CLUB', 'COMPANY', 'STUDENT']}>
                <ClubProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile/:id"
            element={
              <ProtectedRoute allowedRole={['STUDENT', 'CLUB', 'COMPANY', 'ADMIN']}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />

          {/* === ADMIN ROUTE === */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Unknown URLs go back to the landing page instead of a blank screen */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
