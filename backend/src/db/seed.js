const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const hash = await bcrypt.hash('demo1234', 10);

  const admin = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ('Admin User', 'admin@demo.com', $1, 'admin', 'HR')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [hash]
  );

  const manager = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ('Manager User', 'manager@demo.com', $1, 'manager', 'Engineering')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [hash]
  );

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, manager_id, department)
     VALUES ('Employee User', 'employee@demo.com', $1, 'employee', $2, 'Engineering')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1, manager_id=$2`,
    [hash, manager.rows[0].id]
  );

  const areas = [
    ['Revenue Growth', 'Goals related to increasing revenue'],
    ['Cost Optimisation', 'Goals focused on reducing costs'],
    ['Customer Satisfaction', 'Goals around customer experience'],
    ['People & Culture', 'Goals related to team and culture'],
    ['Operational Excellence', 'Process improvement goals'],
    ['Innovation', 'New product or process innovation goals'],
    ['Safety & Compliance', 'Safety incidents and regulatory compliance'],
  ];
  for (const [name, description] of areas) {
    await pool.query(
      `INSERT INTO thrust_areas (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [name, description]
    );
  }

  const YEAR = new Date().getFullYear();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const windows = [
    { period: 'goal_setting', label: 'Goal Setting (May–Jun)',  opens_at: yesterday,            closes_at: `${YEAR + 2}-12-31`, action: 'goal_setting' },
    { period: 'Q1',           label: 'Q1 Check-in (Jul–Sep)',  opens_at: yesterday,            closes_at: `${YEAR + 2}-12-31`, action: 'checkin' },
    { period: 'Q2',           label: 'Q2 Check-in (Oct–Dec)',  opens_at: `${YEAR}-10-01`,     closes_at: `${YEAR}-12-31`,     action: 'checkin' },
    { period: 'Q3',           label: 'Q3 Check-in (Jan–Feb)',  opens_at: `${YEAR + 1}-01-01`, closes_at: `${YEAR + 1}-02-28`, action: 'checkin' },
    { period: 'Q4',           label: 'Q4 / Annual (Mar–Apr)',  opens_at: `${YEAR + 1}-03-01`, closes_at: `${YEAR + 1}-04-30`, action: 'checkin' },
  ];
  for (const w of windows) {
    await pool.query(
      `INSERT INTO check_in_windows (period, label, opens_at, closes_at, cycle_year, action)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (period, cycle_year) DO UPDATE SET
         label=EXCLUDED.label, opens_at=EXCLUDED.opens_at,
         closes_at=EXCLUDED.closes_at, action=EXCLUDED.action`,
      [w.period, w.label, w.opens_at, w.closes_at, YEAR, w.action]
    );
  }

  console.log('Seed complete.');
}

module.exports = seed;

// Run directly: node src/db/seed.js
if (require.main === module) {
  seed().then(() => pool.end()).catch(err => { console.error(err); process.exit(1); });
}
