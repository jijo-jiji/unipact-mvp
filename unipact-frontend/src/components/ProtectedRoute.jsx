import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRole }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        // Basic loading spinner
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-[var(--text-gold)]">
                Loading Access Protocols...
            </div>
        );
    }

    // 1. Not Logged In -> Redirect to Login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Role Verification
    if (allowedRole && user.role !== allowedRole) {
        // Redirect to their appropriate dashboard if they try to access wrong area
        if (user.role === 'COMPANY') {
            return <Navigate to="/company/dashboard" replace />;
        } else if (user.role === 'CLUB') {
            return <Navigate to="/student/dashboard" replace />;
        } else if (user.role === 'ADMIN') {
            return <Navigate to="/admin" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
