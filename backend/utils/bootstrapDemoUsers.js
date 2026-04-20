const bcrypt = require('bcryptjs');
const User = require('../models/User');

const demoUsers = [
  { name: 'System Admin', email: 'admin@college.edu', role: 'admin' },
  { name: 'Dr. John Smith', email: 'john@college.edu', role: 'faculty' },
  { name: 'Alice Johnson', email: 'alice@college.edu', role: 'student' }
];

async function bootstrapDemoUsers() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await Promise.all(demoUsers.map(async (demoUser) => {
    const existingUser = await User.findOne({ email: demoUser.email });
    if (existingUser) return;

    await User.create({
      ...demoUser,
      password: hashedPassword
    });
  }));
}

module.exports = { bootstrapDemoUsers };
