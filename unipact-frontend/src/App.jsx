import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PageLoader from './components/PageLoader';

// Each page is its own download, so visitors only fetch the code for the page they open.
// After a new deploy, an open tab may ask for a file that no longer exists: reload once to get the new version.
const RELOAD_KEY = 'unipact:chunk-reload';
const reloadFlag = (action) => {
  try {
    if (action === 'check') return sessionStorage.getItem(RELOAD_KEY) === '1';
    if (action === 'set') sessionStorage.setItem(RELOAD_KEY, '1');
    else sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    return true; // storage blocked: never risk a reload loop
  }
  return false;
};

const page = (load, pick = (m) => m.default) => lazy(() =>
  load()
    .then((module) => {
      reloadFlag('clear');
      return { default: pick(module) };
    })
    .catch((error) => {
      if (!reloadFlag('check')) {
        reloadFlag('set');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    })
);

const LandingPage = page(() => import('./pages/LandingPage'));
const LoginPage = page(() => import('./pages/LoginPage'));
const RegisterSplit = page(() => import('./pages/RegisterSplit'));
const CompanyDashboard = page(() => import('./pages/CompanyDashboard'));
const CreateCampaign = page(() => import('./pages/CreateCampaign'));
const ManageCampaign = page(() => import('./pages/ManageCampaign'));
const StudentDashboard = page(() => import('./pages/StudentDashboard'));
const QuestDetails = page(() => import('./pages/QuestDetails'));
const QuestBoard = page(() => import('./pages/QuestBoard'));
const SubmitDeliverable = page(() => import('./pages/SubmitDeliverable'));
const AdminDashboard = page(() => import('./pages/AdminDashboard'));
const CompanyRegister = page(() => import('./pages/CompanyRegister'));
const StudentRegister = page(() => import('./pages/StudentRegister'));
const Treasury = page(() => import('./pages/Treasury'));
const StudentProfile = page(() => import('./pages/StudentProfile'));
const ClubProfile = page(() => import('./pages/ClubProfile'));
const ForgotPasswordPage = page(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = page(() => import('./pages/ResetPasswordPage'));
const SettingsPage = page(() => import('./pages/SettingsPage'));
const JoinClubPage = page(() => import('./pages/JoinClubPage'));
const PrivacyPolicyPage = page(() => import('./pages/LegalPages'), (m) => m.PrivacyPolicyPage);
const TermsPage = page(() => import('./pages/LegalPages'), (m) => m.TermsPage);

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* === PUBLIC ROUTES === */}
          {/* The "/" path is the default. It MUST point to LandingPage */}
          <Route path="/" element={< LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterSplit />} />
          <Route path="/register/company" element={<CompanyRegister />} />
          <Route path="/register/student" element={<StudentRegister />} />
          <Route path="/register/club" element={<StudentRegister />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/join-club" element={<JoinClubPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* === ANY SIGNED-IN USER === */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

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
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
