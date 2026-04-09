const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const upload = require('../middleware/upload');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();
const allowedRoles = ['student', 'faculty'];

function canAccessComplaint(complaint, user) {
  if (!complaint) return false;
  if (user.role === 'admin') return true;
  return complaint.submittedBy && complaint.submittedBy.toString() === user.id;
}

router.post('/', auth, authorize(...allowedRoles), (req, res) => {
  upload.single('document')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });

    try {
      const { title, description, category } = req.body;
      const validCategories = ['Academic', 'Infrastructure', 'Discipline', 'Others'];

      if (!title || !description || !category) {
        return res.status(400).json({ message: 'title, description and category are required' });
      }

      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        submittedBy: req.user.id,
        statusHistory: [{ status: 'Pending', changedBy: req.user.id, note: 'Complaint submitted' }]
      };

      if (req.file) {
        payload.supportingDocument = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          uploadedAt: new Date()
        };
      }

      const complaint = await Complaint.create(payload);

      const admins = await User.find({ role: 'admin', isBlocked: false }).select('_id');
      if (admins.length) {
        await Notification.insertMany(
          admins.map((admin) => ({
            user: admin._id,
            complaint: complaint._id,
            message: `New complaint submitted: "${complaint.title}" by ${req.user.name}`
          }))
        );
      }

      await logActivity({
        actor: req.user.id,
        action: 'Complaint Submitted',
        targetType: 'Complaint',
        targetId: complaint._id.toString(),
        details: { title: complaint.title, category: complaint.category },
        ipAddress: req.ip
      });

      res.status(201).json(complaint);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
});

router.get('/mine', auth, authorize(...allowedRoles), async (req, res) => {
  try {
    const complaints = await Complaint.find({ submittedBy: req.user.id })
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/summary', auth, authorize(...allowedRoles), async (req, res) => {
  try {
    const list = await Complaint.find({ submittedBy: req.user.id });

    const summary = list.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === 'Pending') acc.pending += 1;
      if (item.status === 'In Review') acc.inReview += 1;
      if (item.status === 'Approved' || item.status === 'Compliance Completed') acc.resolved += 1;
      if (item.status === 'Rejected') acc.rejected += 1;
      return acc;
    }, { total: 0, pending: 0, inReview: 0, resolved: 0, rejected: 0 });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/notifications', auth, authorize(...allowedRoles), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/notifications/:id/read', auth, authorize(...allowedRoles), async (req, res) => {
  try {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Notification not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('comments.author', 'name role');

    if (!canAccessComplaint(complaint, req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/comments', auth, authorize(...allowedRoles), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: 'message is required' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint || complaint.submittedBy.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    complaint.comments.push({
      author: req.user.id,
      role: req.user.role,
      message: message.trim()
    });
    await complaint.save();

    const admins = await User.find({ role: 'admin', isBlocked: false }).select('_id');
    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          user: admin._id,
          complaint: complaint._id,
          message: `${req.user.name} added a comment on complaint "${complaint.title}"`
        }))
      );
    }

    await logActivity({
      actor: req.user.id,
      action: 'Complaint Comment Added',
      targetType: 'Complaint',
      targetId: complaint._id.toString(),
      details: { role: req.user.role },
      ipAddress: req.ip
    });

    const updated = await Complaint.findById(complaint._id).populate('comments.author', 'name role');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/document', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!canAccessComplaint(complaint, req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!complaint.supportingDocument || !complaint.supportingDocument.path) {
      return res.status(404).json({ message: 'No supporting document found' });
    }

    const absolutePath = path.resolve(complaint.supportingDocument.path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    return res.download(absolutePath, complaint.supportingDocument.originalName);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
