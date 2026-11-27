import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';
import { homePathForRole } from '../utils/routes';

const ProtectedRoute = ({ children, allowedRole, campus = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader message="Checking your session…" />;

  // Not logged in -> login, remembering where they were going
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong area for this role -> send them to their own dashboard
  if (allowedRole) {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (!roles.includes(user.role)) {
      return <Navigate to={homePathForRole(user.role)} replace />;
    }
  }

  // UniPact Campus pages: in pilot mode they don't exist for people outside the pilot. Staff always keep their
  // Campus home (it explains when Campus is switched off), so they never bounce between pages.
  if (campus && !user.campus_enabled && user.role !== 'STAFF') {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
