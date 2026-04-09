const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  credits: { type: Number, default: 3 }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
