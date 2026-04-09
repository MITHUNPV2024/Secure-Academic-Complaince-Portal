const express = require('express');
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assignment = require('../models/Assignment');
const Student = require('../models/Student');
const ComplianceReport = require('../models/ComplianceReport');
const router = express.Router();

router.get('/attendance', auth, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    const attendance = await Attendance.find({ student: student._id }).populate('course');
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/marks', auth, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    const marks = await Mark.find({ student: student._id }).populate('course');
    res.json(marks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/assignments', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find().populate('course');
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/compliance', auth, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    const total = await Attendance.countDocuments({ student: student._id });
    const present = await Attendance.countDocuments({ student: student._id, status: 'present' });
    const percentage = total > 0 ? (present / total) * 100 : 0;
    res.json({ total, present, percentage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    const attendanceCount = await Attendance.countDocuments({ student: student._id });
    const marksCount = await Mark.countDocuments({ student: student._id });
    const assignmentsCount = await Assignment.countDocuments();
    res.json({ attendanceCount, marksCount, assignmentsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/compliance-report', auth, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id });
    
    const totalAttendance = await Attendance.countDocuments({ student: student._id });
    const presentAttendance = await Attendance.countDocuments({ student: student._id, status: 'present' });
    const attendancePercentage = totalAttendance > 0 ? (presentAttendance / totalAttendance) * 100 : 0;
    
    const marks = await Mark.find({ student: student._id });
    const avgMarks = marks.length > 0 ? marks.reduce((sum, m) => sum + (m.marksObtained / m.maxMarks * 100), 0) / marks.length : 0;
    
    const totalAssignments = await Assignment.countDocuments();
    const assignmentCompletion = totalAssignments > 0 ? 75 : 0;
    
    const overallCompliance = (attendancePercentage * 0.4) + (avgMarks * 0.4) + (assignmentCompletion * 0.2);
    const status = overallCompliance >= 75 ? 'compliant' : overallCompliance >= 60 ? 'warning' : 'non-compliant';
    
    res.json({
      attendancePercentage: attendancePercentage.toFixed(2),
      internalMarksAverage: avgMarks.toFixed(2),
      assignmentCompletion: assignmentCompletion.toFixed(2),
      overallCompliance: overallCompliance.toFixed(2),
      status,
      totalClasses: totalAttendance,
      presentClasses: presentAttendance,
      totalMarks: marks.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
