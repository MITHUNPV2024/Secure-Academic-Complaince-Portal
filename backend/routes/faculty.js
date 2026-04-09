const express = require('express');
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assignment = require('../models/Assignment');
const Student = require('../models/Student');
const Course = require('../models/Course');
const ComplianceReport = require('../models/ComplianceReport');
const router = express.Router();

router.post('/attendance', auth, async (req, res) => {
  try {
    const attendance = new Attendance(req.body);
    await attendance.save();
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/marks', auth, async (req, res) => {
  try {
    const mark = new Mark(req.body);
    await mark.save();
    res.status(201).json(mark);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/assignments', auth, async (req, res) => {
  try {
    const assignment = new Assignment(req.body);
    await assignment.save();
    res.status(201).json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/students', auth, async (req, res) => {
  try {
    const students = await Student.find().populate('userId');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/courses', auth, async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    const totalStudents = await Student.countDocuments();
    const totalAssignments = await Assignment.countDocuments();
    res.json({ totalCourses, totalStudents, totalAssignments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/compliance', auth, async (req, res) => {
  try {
    const students = await Student.find().populate('userId').populate('department');
    const compliance = await Promise.all(students.map(async (student) => {
      const total = await Attendance.countDocuments({ student: student._id });
      const present = await Attendance.countDocuments({ student: student._id, status: 'present' });
      const percentage = total > 0 ? (present / total) * 100 : 0;
      
      const marks = await Mark.find({ student: student._id });
      const avgMarks = marks.length > 0 ? marks.reduce((sum, m) => sum + (m.marksObtained / m.maxMarks * 100), 0) / marks.length : 0;
      
      const overallCompliance = (percentage * 0.6) + (avgMarks * 0.4);
      const status = overallCompliance >= 75 ? 'compliant' : 'non-compliant';
      
      return { student, attendancePercentage: percentage, marksAverage: avgMarks, overallCompliance, status };
    }));
    res.json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
