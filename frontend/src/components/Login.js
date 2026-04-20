import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api';

const roles = ['student', 'faculty', 'admin'];
const roleLabels = {
  student: 'Student Grievance Tracking',
  faculty: 'Faculty Case Collaboration',
  admin: 'Administration Oversight'
};

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const goToDashboard = (role) => {
    navigate(`/${role}/dashboard`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post('/auth/login', { email: form.email, password: form.password });
        saveSession(res.data.token, res.data.user);
        goToDashboard(res.data.user.role);
      } else {
        const res = await api.post('/auth/signup', form);
        saveSession(res.data.token, res.data.user);
        goToDashboard(res.data.user.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <section className="login-showcase">
          <span className="eyebrow">Campus Compliance Suite</span>
          <h1>Build trust with a complaint workflow that feels accountable.</h1>
          <p className="login-lead">
            Track academic and infrastructure issues through one polished workspace for students,
            faculty and administrators.
          </p>

          <div className="login-highlight-grid">
            <div className="highlight-card">
              <strong>Faster resolution</strong>
              <span>Clear status visibility from submission to closure.</span>
            </div>
            <div className="highlight-card">
              <strong>Shared accountability</strong>
              <span>Comments, assignments and responses stay attached to every case.</span>
            </div>
            <div className="highlight-card">
              <strong>Audit-ready records</strong>
              <span>Notifications and reports keep governance simple.</span>
            </div>
          </div>

          <div className="credential-panel">
            <h3>Seed Credentials</h3>
            <div className="credential-list">
              <p><strong>Admin</strong><span>admin@college.edu / admin123</span></p>
              <p><strong>Faculty</strong><span>john@college.edu / admin123</span></p>
              <p><strong>Student</strong><span>alice@college.edu / admin123</span></p>
            </div>
          </div>
        </section>

        <section className="login-box">
          <div className="login-header">
            <span className="section-kicker">{mode === 'login' ? 'Welcome back' : 'Create workspace access'}</span>
            <h2>{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2>
            <p>
              {mode === 'login'
                ? 'Use your institutional credentials to access your dashboard.'
                : `Set up a new account for ${roleLabels[form.role]}.`}
            </p>
          </div>

          <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`toggle-chip ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`toggle-chip ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Signup
            </button>
          </div>

          {error && <div className="alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="minimum 6 characters"
                minLength={6}
                required
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Login;
