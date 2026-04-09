import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authHeaders, clearSession, getStoredUser } from '../api';

const categories = ['Academic', 'Infrastructure', 'Discipline', 'Others'];

function SharedUserDashboard({ role }) {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser() || {}, []);

  const [summary, setSummary] = useState({ total: 0, pending: 0, inReview: 0, resolved: 0, rejected: 0 });
  const [complaints, setComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentMap, setCommentMap] = useState({});
  const [form, setForm] = useState({ title: '', description: '', category: 'Academic', document: null });

  const headers = useMemo(() => ({ headers: authHeaders() }), []);

  const loadDashboard = useCallback(async () => {
    try {
      const [summaryRes, complaintsRes, notificationsRes] = await Promise.all([
        api.get('/complaints/summary', headers),
        api.get('/complaints/mine', headers),
        api.get('/complaints/notifications', headers)
      ]);

      setSummary(summaryRes.data);
      setComplaints(complaintsRes.data);
      setNotifications(notificationsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    }
  }, [headers]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const logout = () => {
    clearSession();
    navigate('/');
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('title', form.title);
      payload.append('description', form.description);
      payload.append('category', form.category);
      if (form.document) payload.append('document', form.document);

      await api.post('/complaints', payload, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      setForm({ title: '', description: '', category: 'Academic', document: null });
      setSuccess('Complaint submitted successfully.');
      setActiveView('complaints');
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const addComment = async (complaintId) => {
    const message = (commentMap[complaintId] || '').trim();
    if (!message) return;

    try {
      await api.post(`/complaints/${complaintId}/comments`, { message }, headers);
      setCommentMap((prev) => ({ ...prev, [complaintId]: '' }));
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add comment');
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/complaints/notifications/${id}/read`, {}, headers);
      setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notification');
    }
  };

  const downloadDocument = async (complaint) => {
    try {
      const res = await api.get(`/complaints/${complaint._id}/document`, {
        headers: authHeaders(),
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', complaint.supportingDocument?.originalName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download document');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">Secure Academic Compliance Portal</div>
          <div className="nav-menu">
            <span>{user.name} ({role})</span>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-container">
        <h1>{role === 'student' ? 'Student' : 'Faculty'} Dashboard</h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn-back" onClick={() => setActiveView('dashboard')}>Overview</button>
          <button className="btn-back" onClick={() => setActiveView('new')}>New Complaint</button>
          <button className="btn-back" onClick={() => setActiveView('complaints')}>My Complaints</button>
          <button className="btn-back" onClick={() => setActiveView('notifications')}>Notifications ({unreadCount})</button>
        </div>

        {error && <div className="alert-danger">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        {activeView === 'dashboard' && (
          <div className="stats-grid">
            <div className="stat-card"><h3>Total</h3><div className="stat-number">{summary.total}</div></div>
            <div className="stat-card"><h3>Pending</h3><div className="stat-number">{summary.pending}</div></div>
            <div className="stat-card"><h3>In Review</h3><div className="stat-number">{summary.inReview}</div></div>
            <div className="stat-card"><h3>Resolved</h3><div className="stat-number">{summary.resolved}</div></div>
          </div>
        )}

        {activeView === 'new' && (
          <div className="content-box">
            <h2>Submit Complaint</h2>
            <form onSubmit={submitComplaint}>
              <div className="form-group">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  required
                  style={{ width: '100%', minHeight: 120, padding: 12, borderRadius: 12, border: '1px solid #d2ddd8' }}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Supporting Document (PDF / DOC / DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setForm((p) => ({ ...p, document: e.target.files?.[0] || null }))}
                />
              </div>
              <button className="btn-primary" disabled={submitting} type="submit">
                {submitting ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </form>
          </div>
        )}

        {activeView === 'complaints' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {complaints.length === 0 && <div className="no-data">No complaints submitted yet.</div>}
            {complaints.map((complaint) => (
              <div key={complaint._id} className="content-box">
                <h2 style={{ fontSize: 24 }}>{complaint.title}</h2>
                <p><strong>Category:</strong> {complaint.category}</p>
                <p><strong>Status:</strong> {complaint.status}</p>
                <p><strong>Submitted:</strong> {new Date(complaint.createdAt).toLocaleString()}</p>
                <p><strong>Description:</strong> {complaint.description}</p>
                {complaint.adminResponse && <p><strong>Admin Response:</strong> {complaint.adminResponse}</p>}

                {complaint.supportingDocument?.originalName && (
                  <button className="btn-edit" onClick={() => downloadDocument(complaint)}>Download Document</button>
                )}

                <div style={{ marginTop: 10 }}>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Comments</h3>
                  {(complaint.comments || []).length === 0 && <p className="no-data" style={{ padding: 14 }}>No comments yet.</p>}
                  {(complaint.comments || []).map((comment, idx) => (
                    <div key={`${complaint._id}-${idx}`} style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: '#f4faf8' }}>
                      <strong>{comment.role}</strong> ({comment.author?.name || 'Unknown'})
                      <div>{comment.message}</div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      style={{ flex: 1 }}
                      value={commentMap[complaint._id] || ''}
                      onChange={(e) => setCommentMap((prev) => ({ ...prev, [complaint._id]: e.target.value }))}
                      placeholder="Add comment"
                    />
                    <button className="btn-add" type="button" onClick={() => addComment(complaint._id)}>Send</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'notifications' && (
          <div className="content-box">
            <h2>Notifications</h2>
            {notifications.length === 0 && <p className="no-data">No notifications available.</p>}
            {notifications.map((item) => (
              <div key={item._id} style={{ padding: 10, borderBottom: '1px solid #e6ece8' }}>
                <p>{item.message}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
                {!item.isRead && (
                  <div>
                    <button className="btn-edit" type="button" onClick={() => markRead(item._id)} style={{ marginTop: 6 }}>
                      Mark as read
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedUserDashboard;
