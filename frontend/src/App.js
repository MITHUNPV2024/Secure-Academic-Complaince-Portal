import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import FacultyDashboard from './components/FacultyDashboard';
import StudentDashboard from './components/StudentDashboard';
import { getStoredUser, getToken } from './api';
import './App.css';

function ProtectedRoute({ allowedRole, children }) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user?.role) return <Navigate to="/" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
}

function App() {
  const token = getToken();
  const user = getStoredUser();

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={token && user?.role ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Login />}
        />

        <Route
          path="/student/dashboard"
          element={(
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/faculty/dashboard"
          element={(
            <ProtectedRoute allowedRole="faculty">
              <FacultyDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dashboard"
          element={(
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
