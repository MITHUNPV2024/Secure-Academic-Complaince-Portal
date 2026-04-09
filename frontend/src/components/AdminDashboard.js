import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authHeaders, clearSession, getStoredUser } from '../api';

const statusOptions = ['Pending', 'In Review', 'Approved', 'Rejected', 'Compliance Completed'];
const categories = ['Academic', 'Infrastructure', 'Discipline', 'Others'];

function AdminDashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser() || {}, []);
  const headers = useMemo(() => ({ headers: authHeaders() }), []);

  const [view, setView] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', user: '', search: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const [editUser, setEditUser] = useState(null);

  const [reviewing, setReviewing] = useState(null);
  const [reviewPayload, setReviewPayload] = useState({
    status: 'Pending',
    adminResponse: '',
    assignedTo: '',
    complianceCompleted: false,
    note: '',
    comment: ''
  });

  const loadDashboard = async () => {
    const res = await api.get('/admin/dashboard', headers);
    setDashboard(res.data);
  };

  const loadComplaints = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const res = await api.get('/admin/complaints', { ...headers, params });
    setComplaints(res.data);
  };

  const loadUsers = async () => {
    const res = await api.get('/admin/users', headers);
    setUsers(res.data);
  };

  const loadLogs = async () => {
    const res = await api.get('/admin/activity-logs', headers);
    setLogs(res.data);
  };

  const loadAll = async () => {
    try {
      await Promise.all([loadDashboard(), loadComplaints(), loadUsers(), loadLogs()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin data');
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    clearSession();
    navigate('/');
  };

  const applyFilters = async (e) => {
    e.preventDefault();
    try {
      await loadComplaints();
      setSuccess('Filters applied');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply filters');
    }
  };

  const openReview = (complaint) => {
    setReviewing(complaint);
    setReviewPayload({
      status: complaint.status,
      adminResponse: complaint.adminResponse || '',
      assignedTo: complaint.assignedTo?._id || '',
      complianceCompleted: complaint.complianceCompleted || false,
      note: '',
      comment: ''
    });
    setView('review');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/complaints/${reviewing._id}/review`, reviewPayload, headers);
      if (reviewPayload.comment.trim()) {
        await api.post(`/admin/complaints/${reviewing._id}/comments`, { message: reviewPayload.comment }, headers);
      }
      setSuccess('Complaint updated successfully');
      setView('complaints');
      setReviewing(null);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review complaint');
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', newUser, headers);
      setSuccess('User added');
      setNewUser({ name: '', email: '', password: '', role: 'student' });
      await loadUsers();
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add user');
    }
  };

  const saveUserEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;

    try {
      await api.put(`/admin/users/${editUser._id}`, {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        isBlocked: editUser.isBlocked
      }, headers);
      setSuccess('User updated');
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const toggleBlock = async (target) => {
    try {
      await api.patch(`/admin/users/${target._id}/block`, { isBlocked: !target.isBlocked }, headers);
      await loadUsers();
      setSuccess(target.isBlocked ? 'User unblocked' : 'User blocked');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update block status');
    }
  };

  const removeUser = async (target) => {
    const confirmed = window.confirm(`Remove user ${target.email}?`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${target._id}`, headers);
      setSuccess('User removed');
      await loadUsers();
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove user');
    }
  };

  const downloadReport = async (format) => {
    try {
      const res = await api.get('/admin/reports', {
        headers: authHeaders(),
        params: { format },
        responseType: 'blob'
      });

      const ext = format === 'excel' ? 'csv' : format;
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `complaints-report.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.message || 'Report download failed');
    }
  };

  return (
    <div>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">Secure Academic Compliance Portal</div>
          <div className="nav-menu">
            <span>{user.name} (admin)</span>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-container">
        <h1>Admin Dashboard</h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <button className="btn-back" onClick={() => setView('dashboard')}>Overview</button>
          <button className="btn-back" onClick={() => setView('complaints')}>Complaints</button>
          <button className="btn-back" onClick={() => setView('users')}>Users</button>
          <button className="btn-back" onClick={() => setView('logs')}>Activity Logs</button>
          <button className="btn-back" onClick={() => setView('reports')}>Reports</button>
        </div>

        {error && <div className="alert-danger">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        {view === 'dashboard' && (
          <div className="stats-grid">
            <div className="stat-card"><h3>Total Complaints</h3><div className="stat-number">{dashboard.totalComplaints || 0}</div></div>
            <div className="stat-card"><h3>Pending</h3><div className="stat-number">{dashboard.pending || 0}</div></div>
            <div className="stat-card"><h3>In Review</h3><div className="stat-number">{dashboard.inReview || 0}</div></div>
            <div className="stat-card"><h3>Resolved</h3><div className="stat-number">{(dashboard.approved || 0) + (dashboard.completed || 0)}</div></div>
          </div>
        )}

        {view === 'complaints' && (
          <div className="content-box">
            <h2>Complaint Management</h2>

            <form onSubmit={applyFilters} className="add-form">
              <select value={filters.user} onChange={(e) => setFilters((p) => ({ ...p, user: e.target.value }))}>
                <option value="">All Users</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </select>

              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">All Status</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <input
                placeholder="Search title or description"
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              />

              <button className="btn-add" type="submit">Apply Filters</button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>User</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((item) => (
                  <tr key={item._id}>
                    <td>{item.title}</td>
                    <td>{item.submittedBy?.name} ({item.submittedBy?.role})</td>
                    <td>{item.category}</td>
                    <td>{item.status}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td><button className="btn-edit" onClick={() => openReview(item)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'review' && reviewing && (
          <div className="content-box">
            <h2>Review Complaint</h2>
            <p><strong>Title:</strong> {reviewing.title}</p>
            <p><strong>Submitter:</strong> {reviewing.submittedBy?.name} ({reviewing.submittedBy?.email})</p>
            <p><strong>Description:</strong> {reviewing.description}</p>

            <form onSubmit={submitReview}>
              <div className="form-group">
                <label>Status</label>
                <select value={reviewPayload.status} onChange={(e) => setReviewPayload((p) => ({ ...p, status: e.target.value }))}>
                  {statusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Assign To (optional faculty/admin)</label>
                <select value={reviewPayload.assignedTo} onChange={(e) => setReviewPayload((p) => ({ ...p, assignedTo: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.filter((u) => ['faculty', 'admin'].includes(u.role)).map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Admin Response</label>
                <textarea
                  style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid #d2ddd8' }}
                  value={reviewPayload.adminResponse}
                  onChange={(e) => setReviewPayload((p) => ({ ...p, adminResponse: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Internal Note</label>
                <input value={reviewPayload.note} onChange={(e) => setReviewPayload((p) => ({ ...p, note: e.target.value }))} />
              </div>

              <div className="form-group">
                <label>Reply Comment (optional)</label>
                <input value={reviewPayload.comment} onChange={(e) => setReviewPayload((p) => ({ ...p, comment: e.target.value }))} />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={reviewPayload.complianceCompleted}
                  onChange={(e) => setReviewPayload((p) => ({ ...p, complianceCompleted: e.target.checked }))}
                  id="completed"
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="completed" style={{ marginBottom: 0 }}>Mark compliance completed</label>
              </div>

              <button className="btn-primary" type="submit">Save Review</button>
            </form>
          </div>
        )}

        {view === 'users' && (
          <div className="content-box">
            <h2>User Management</h2>

            <form className="add-form" onSubmit={createUser}>
              <input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} required />
              <input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} required />
              <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} required />
              <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                <option value="student">student</option>
                <option value="faculty">faculty</option>
                <option value="admin">admin</option>
              </select>
              <button className="btn-add" type="submit">Add User</button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.isBlocked ? 'Blocked' : 'Active'}</td>
                    <td>
                      <button className="btn-edit" onClick={() => setEditUser({ ...u })}>Edit</button>
                      <button className="btn-add" style={{ marginLeft: 8 }} onClick={() => toggleBlock(u)}>
                        {u.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                      <button className="btn-delete" style={{ marginLeft: 8 }} onClick={() => removeUser(u)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editUser && (
              <div className="modal">
                <div className="modal-content">
                  <h2>Edit User</h2>
                  <form onSubmit={saveUserEdit}>
                    <input value={editUser.name} onChange={(e) => setEditUser((p) => ({ ...p, name: e.target.value }))} required />
                    <input value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} required />
                    <select value={editUser.role} onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}>
                      <option value="student">student</option>
                      <option value="faculty">faculty</option>
                      <option value="admin">admin</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(editUser.isBlocked)}
                        onChange={(e) => setEditUser((p) => ({ ...p, isBlocked: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                      Block account
                    </label>

                    <button className="btn-primary" type="submit">Save</button>
                    <button className="btn-cancel" type="button" onClick={() => setEditUser(null)}>Cancel</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'logs' && (
          <div className="content-box">
            <h2>Activity Logs</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.actor?.name || 'System'}</td>
                    <td>{log.action}</td>
                    <td>{log.targetType} {log.targetId || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'reports' && (
          <div className="content-box">
            <h2>Reports Export</h2>
            <p>Download reports in JSON, Excel-compatible CSV, or PDF format.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn-add" onClick={() => downloadReport('json')}>Download JSON</button>
              <button className="btn-add" onClick={() => downloadReport('excel')}>Download Excel (CSV)</button>
              <button className="btn-add" onClick={() => downloadReport('pdf')}>Download PDF</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
