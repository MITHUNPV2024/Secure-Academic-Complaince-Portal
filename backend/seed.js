const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected');

    await Promise.all([
      User.deleteMany({}),
      Complaint.deleteMany({}),
      Notification.deleteMany({}),
      ActivityLog.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    await User.create({ name: 'System Admin', email: 'admin@college.edu', password: hashedPassword, role: 'admin' });
    await User.create({ name: 'Dr. John Smith', email: 'john@college.edu', password: hashedPassword, role: 'faculty' });
    await User.create({ name: 'Alice Johnson', email: 'alice@college.edu', password: hashedPassword, role: 'student' });

    console.log('Seed data created successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
