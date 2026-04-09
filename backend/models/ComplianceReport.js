const mongoose = require('mongoose');

const complianceReportSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  semester: { type: Number, required: true },
  attendancePercentage: { type: Number, default: 0 },
  assignmentCompletion: { type: Number, default: 0 },
  internalMarksAverage: { type: Number, default: 0 },
  overallCompliance: { type: Number, default: 0 },
  status: { type: String, enum: ['compliant', 'non-compliant', 'warning'], default: 'non-compliant' },
  remarks: String,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ComplianceReport', complianceReportSchema);
