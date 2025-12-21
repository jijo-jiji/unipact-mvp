import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import ALL Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
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
import CampaignManager from './pages/CampaignManager';
import Treasury from './pages/Treasury';
import StudentProfile from './pages/StudentProfile';
import ClubProfile from './pages/ClubProfile';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* === PUBLIC ROUTES === */}
        {/* The "/" path is the default. It MUST point to LandingPage */}
        <Route path="/" element={< LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/company" element={<CompanyRegister />} />
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
              <CampaignManager />
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
            <ProtectedRoute allowedRole="CLUB">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quest/deliver/:applicationId"
          element={
            <ProtectedRoute allowedRole="CLUB">
              <SubmitDeliverable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quests"
          element={
            <ProtectedRoute allowedRole="CLUB">
              <QuestBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quest/:id"
          element={
            <ProtectedRoute allowedRole="CLUB">
              <QuestDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/profile/:id"
          element={
            <ProtectedRoute allowedRole="CLUB">
              <ClubProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/profile/:id"
          element={
            <ProtectedRoute allowedRole="CLUB">
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;