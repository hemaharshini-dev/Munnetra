const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireWindow(action) {
  return async (req, res, next) => {
    const year = new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT * FROM check_in_windows
       WHERE action=$1 AND cycle_year=$2
       AND opens_at <= CURRENT_DATE AND closes_at >= CURRENT_DATE`,
      [action, year]
    );
    if (!rows.length) {
      const labels = { goal_setting: 'Goal Setting (May–Jun)', checkin: 'a Check-in' };
      return res.status(403).json({
        error: `This action is only available during the ${labels[action]} window. The portal is currently between cycles.`,
        window_closed: true
      });
    }
    req.activeWindow = rows[0];
    next();
  };
}

module.exports = { authenticate, requireRole, requireWindow };
