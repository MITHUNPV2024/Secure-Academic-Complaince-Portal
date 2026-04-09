import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api';

const roles = ['student', 'faculty', 'admin'];

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
      <div className="login-box">
        <h1>Secure Academic Compliance Portal</h1>
        <h2>{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button
            type="button"
            className="btn-back"
            style={{ marginBottom: 0, flex: 1, opacity: mode === 'login' ? 1 : 0.65 }}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className="btn-back"
            style={{ marginBottom: 0, flex: 1, opacity: mode === 'signup' ? 1 : 0.65 }}
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

        <div className="test-credentials">
          <h3>Seed Credentials</h3>
          <p><strong>Admin:</strong> admin@college.edu / admin123</p>
          <p><strong>Faculty:</strong> john@college.edu / admin123</p>
          <p><strong>Student:</strong> alice@college.edu / admin123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
