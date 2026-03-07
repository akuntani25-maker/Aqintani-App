import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN_PANEL_ROLES = ['admin', 'manager', 'office_staff'];

export const PrivateRoute = ({ children, requireAdmin = false, requireCanvasser = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !ADMIN_PANEL_ROLES.includes(user.role)) {
    return <Navigate to={user.role === 'canvasser' ? '/canvasser' : '/pos'} replace />;
  }

  if (requireCanvasser && user.role !== 'canvasser') {
    return <Navigate to={ADMIN_PANEL_ROLES.includes(user.role) ? '/admin/dashboard' : '/pos'} replace />;
  }

  return children;
};
