import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authHeaders, clearSession, getStoredUser } from '../api';

const categories = ['Academic', 'Infrastructure', 'Discipline', 'Others'];
const roleTitles = {
  student: 'Student Resolution Desk',
  faculty: 'Faculty Coordination Desk'
};
const roleDescriptions = {
  student: 'Raise concerns, track progress and stay updated on every response from the institution.',
  faculty: 'Coordinate complaint follow-up, monitor case movement and keep communication consistent.'
};

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
          <div>
            <div className="nav-brand">Secure Academic Compliance Portal</div>
            <div className="nav-subtitle">Complaint intake, review and accountability</div>
          </div>
          <div className="nav-menu">
            <span className="nav-user-pill">{user.name} ({role})</span>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-container">
        <section className="page-hero">
          <div>
            <span className="section-kicker">{role === 'student' ? 'Student workspace' : 'Faculty workspace'}</span>
            <h1>{roleTitles[role]}</h1>
            <p>{roleDescriptions[role]}</p>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric-card">
              <span>Open complaints</span>
              <strong>{summary.pending + summary.inReview}</strong>
            </div>
            <div className="hero-metric-card">
              <span>Unread alerts</span>
              <strong>{unreadCount}</strong>
            </div>
          </div>
        </section>

        <div className="section-tabs">
          <button className={`tab-button ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>Overview</button>
          <button className={`tab-button ${activeView === 'new' ? 'active' : ''}`} onClick={() => setActiveView('new')}>New Complaint</button>
          <button className={`tab-button ${activeView === 'complaints' ? 'active' : ''}`} onClick={() => setActiveView('complaints')}>My Complaints</button>
          <button className={`tab-button ${activeView === 'notifications' ? 'active' : ''}`} onClick={() => setActiveView('notifications')}>Notifications ({unreadCount})</button>
        </div>

        {error && <div className="alert-danger">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        {activeView === 'dashboard' && (
          <>
            <div className="stats-grid">
              <div className="stat-card"><h3>Total</h3><div className="stat-number">{summary.total}</div><p>All complaints raised from your account.</p></div>
              <div className="stat-card"><h3>Pending</h3><div className="stat-number">{summary.pending}</div><p>Awaiting triage or first response.</p></div>
              <div className="stat-card"><h3>In Review</h3><div className="stat-number">{summary.inReview}</div><p>Currently being assessed by the institution.</p></div>
              <div className="stat-card"><h3>Resolved</h3><div className="stat-number">{summary.resolved}</div><p>Closed with an approved or completed response.</p></div>
            </div>

            <div className="overview-grid">
              <div className="content-box soft-accent">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">Live queue</span>
                    <h2>What needs attention now</h2>
                  </div>
                </div>
                <div className="mini-stat-list">
                  <div className="mini-stat-item">
                    <span>Awaiting review</span>
                    <strong>{summary.pending}</strong>
                  </div>
                  <div className="mini-stat-item">
                    <span>Under review</span>
                    <strong>{summary.inReview}</strong>
                  </div>
                  <div className="mini-stat-item">
                    <span>Rejected</span>
                    <strong>{summary.rejected}</strong>
                  </div>
                </div>
              </div>

              <div className="content-box">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">Notifications</span>
                    <h2>Recent updates</h2>
                  </div>
                </div>
                {notifications.slice(0, 3).length === 0 && <div className="no-data">No recent updates yet.</div>}
                <div className="notification-list compact">
                  {notifications.slice(0, 3).map((item) => (
                    <div key={item._id} className={`notification-item ${item.isRead ? '' : 'unread'}`}>
                      <p>{item.message}</p>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === 'new' && (
          <div className="content-box">
            <div className="section-heading">
              <div>
                <span className="section-kicker">New submission</span>
                <h2>Submit Complaint</h2>
              </div>
              <p className="section-note">Attach supporting files when you need evidence attached to the case timeline.</p>
            </div>
            <form onSubmit={submitComplaint}>
              <div className="form-group">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="text-area"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  required
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
          <div className="stack-grid">
            {complaints.length === 0 && <div className="no-data">No complaints submitted yet.</div>}
            {complaints.map((complaint) => (
              <div key={complaint._id} className="content-box complaint-card">
                <div className="complaint-header">
                  <div>
                    <h2 className="complaint-title">{complaint.title}</h2>
                    <div className="meta-row">
                      <span className="pill-tag">{complaint.category}</span>
                      <span className="pill-tag subtle">{new Date(complaint.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className="status-pill">{complaint.status}</span>
                </div>

                <p className="complaint-description">{complaint.description}</p>
                {complaint.adminResponse && <p><strong>Admin Response:</strong> {complaint.adminResponse}</p>}

                {complaint.supportingDocument?.originalName && (
                  <button className="btn-edit" onClick={() => downloadDocument(complaint)}>Download Document</button>
                )}

                <div className="comment-section">
                  <h3>Comments</h3>
                  {(complaint.comments || []).length === 0 && <p className="no-data compact-empty">No comments yet.</p>}
                  <div className="comment-list">
                    {(complaint.comments || []).map((comment, idx) => (
                      <div key={`${complaint._id}-${idx}`} className="comment-card">
                        <strong>{comment.role}</strong> ({comment.author?.name || 'Unknown'})
                        <div>{comment.message}</div>
                      </div>
                    ))}
                  </div>

                  <div className="comment-composer">
                    <input
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
            <div className="section-heading">
              <div>
                <span className="section-kicker">Inbox</span>
                <h2>Notifications</h2>
              </div>
            </div>
            {notifications.length === 0 && <p className="no-data">No notifications available.</p>}
            <div className="notification-list">
              {notifications.map((item) => (
                <div key={item._id} className={`notification-item ${item.isRead ? '' : 'unread'}`}>
                  <p>{item.message}</p>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                  {!item.isRead && (
                    <div className="notification-actions">
                      <button className="btn-edit" type="button" onClick={() => markRead(item._id)}>
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedUserDashboard;
