const ActivityLog = require('../models/ActivityLog');

async function logActivity({ actor, action, targetType = '', targetId = '', details = {}, ipAddress = '' }) {
  try {
    await ActivityLog.create({ actor, action, targetType, targetId, details, ipAddress });
  } catch (error) {
    console.error('Failed to write activity log', error.message);
  }
}

module.exports = { logActivity };
