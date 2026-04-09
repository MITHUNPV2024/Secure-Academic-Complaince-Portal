const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

const allowedStatuses = ['Pending', 'In Review', 'Approved', 'Rejected', 'Compliance Completed'];
const allowedCategories = ['Academic', 'Infrastructure', 'Discipline', 'Others'];

function escapeCsv(value) {
  const safe = value == null ? '' : String(value);
  if (/[,"\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function createSimplePdfBuffer(lines) {
  const escapedLines = lines.map((line) => String(line).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
  const textBlock = ['BT', '/F1 11 Tf', '50 780 Td']
    .concat(escapedLines.flatMap((line, index) => index === 0 ? [`(${line}) Tj`] : ['0 -16 Td', `(${line}) Tj`]))
    .concat(['ET'])
    .join('\n');

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(textBlock, 'utf8')} >>\nstream\n${textBlock}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

router.use(auth, authorize('admin'));

router.get('/dashboard', async (req, res) => {
  try {
    const [totalComplaints, pending, inReview, approved, rejected, completed, totalUsers] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'Pending' }),
      Complaint.countDocuments({ status: 'In Review' }),
      Complaint.countDocuments({ status: 'Approved' }),
      Complaint.countDocuments({ status: 'Rejected' }),
      Complaint.countDocuments({ status: 'Compliance Completed' }),
      User.countDocuments()
    ]);

    const byCategory = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({
      totalComplaints,
      pending,
      inReview,
      approved,
      rejected,
      completed,
      totalUsers,
      byCategory
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    const { status, category, user, search } = req.query;
    const query = {};

    if (status && allowedStatuses.includes(status)) query.status = status;
    if (category && allowedCategories.includes(category)) query.category = category;
    if (user) query.submittedBy = user;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const complaints = await Complaint.find(query)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('comments.author', 'name role')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/complaints/:id/review', async (req, res) => {
  try {
    const { status, adminResponse, assignedTo, complianceCompleted, note } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid complaint status' });
    }

    if (status) complaint.status = status;
    if (typeof adminResponse === 'string') complaint.adminResponse = adminResponse.trim();
    if (assignedTo) complaint.assignedTo = assignedTo;
    if (typeof complianceCompleted === 'boolean') complaint.complianceCompleted = complianceCompleted;

    if (status || note) {
      complaint.statusHistory.push({
        status: complaint.status,
        changedBy: req.user.id,
        note: note || adminResponse || 'Status updated by admin'
      });
    }

    await complaint.save();

    await Notification.create({
      user: complaint.submittedBy,
      complaint: complaint._id,
      message: `Your complaint "${complaint.title}" is now ${complaint.status}`
    });

    await logActivity({
      actor: req.user.id,
      action: 'Complaint Reviewed',
      targetType: 'Complaint',
      targetId: complaint._id.toString(),
      details: { status: complaint.status, complianceCompleted: complaint.complianceCompleted },
      ipAddress: req.ip
    });

    const updated = await Complaint.findById(complaint._id)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('comments.author', 'name role');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/complaints/:id/comments', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: 'message is required' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.comments.push({
      author: req.user.id,
      role: req.user.role,
      message: message.trim()
    });
    await complaint.save();

    await Notification.create({
      user: complaint.submittedBy,
      complaint: complaint._id,
      message: `Admin responded on complaint "${complaint.title}"`
    });

    await logActivity({
      actor: req.user.id,
      action: 'Admin Comment Added',
      targetType: 'Complaint',
      targetId: complaint._id.toString(),
      details: {},
      ipAddress: req.ip
    });

    const updated = await Complaint.findById(complaint._id).populate('comments.author', 'name role');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }

    if (!['student', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role
    });

    await logActivity({
      actor: req.user.id,
      action: 'Admin Created User',
      targetType: 'User',
      targetId: user._id.toString(),
      details: { role: user.role },
      ipAddress: req.ip
    });

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const updates = {};
    const { name, email, role, isBlocked } = req.body;

    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (role && ['student', 'faculty', 'admin'].includes(role)) updates.role = role;
    if (typeof isBlocked === 'boolean') updates.isBlocked = isBlocked;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logActivity({
      actor: req.user.id,
      action: 'Admin Updated User',
      targetType: 'User',
      targetId: user._id.toString(),
      details: updates,
      ipAddress: req.ip
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/users/:id/block', async (req, res) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') return res.status(400).json({ message: 'isBlocked must be boolean' });

    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logActivity({
      actor: req.user.id,
      action: isBlocked ? 'Admin Blocked User' : 'Admin Unblocked User',
      targetType: 'User',
      targetId: user._id.toString(),
      details: { isBlocked },
      ipAddress: req.ip
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Admin cannot remove own account' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await Complaint.deleteMany({ submittedBy: user._id });

    await logActivity({
      actor: req.user.id,
      action: 'Admin Removed User',
      targetType: 'User',
      targetId: req.params.id,
      details: { email: user.email },
      ipAddress: req.ip
    });

    res.json({ message: 'User removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/activity-logs', async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const { format = 'json', status, category } = req.query;
    const query = {};

    if (status && allowedStatuses.includes(status)) query.status = status;
    if (category && allowedCategories.includes(category)) query.category = category;

    const complaints = await Complaint.find(query)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    const reportRows = complaints.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      category: c.category,
      status: c.status,
      submitter: c.submittedBy?.name || '',
      submitterEmail: c.submittedBy?.email || '',
      assignedTo: c.assignedTo?.name || '',
      complianceCompleted: c.complianceCompleted ? 'Yes' : 'No',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    if (format === 'excel' || format === 'csv') {
      const headers = ['ID', 'Title', 'Category', 'Status', 'Submitter', 'Submitter Email', 'Assigned To', 'Compliance Completed', 'Created At', 'Updated At'];
      const csvLines = [headers.join(',')].concat(reportRows.map((row) => [
        row.id,
        row.title,
        row.category,
        row.status,
        row.submitter,
        row.submitterEmail,
        row.assignedTo,
        row.complianceCompleted,
        new Date(row.createdAt).toISOString(),
        new Date(row.updatedAt).toISOString()
      ].map(escapeCsv).join(',')));

      res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.csv"');
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvLines.join('\n'));
    }

    if (format === 'pdf') {
      const lines = [
        'Secure Academic Compliance Portal - Complaints Report',
        `Generated: ${new Date().toISOString()}`,
        `Total Records: ${reportRows.length}`,
        '----------------------------------------'
      ];

      reportRows.slice(0, 35).forEach((row, index) => {
        lines.push(`${index + 1}. ${row.title} | ${row.category} | ${row.status} | ${row.submitter}`);
      });

      if (reportRows.length > 35) {
        lines.push(`...and ${reportRows.length - 35} more records`);
      }

      const pdfBuffer = createSimplePdfBuffer(lines);
      res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(pdfBuffer);
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      filters: { status: status || null, category: category || null },
      total: reportRows.length,
      rows: reportRows
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
