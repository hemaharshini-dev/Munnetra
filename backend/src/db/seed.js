const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const hash = await bcrypt.hash('demo1234', 10);

  // Admin (no manager)
  const admin = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ('Admin User', 'admin@demo.com', $1, 'admin', 'HR')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [hash]
  );

  // Manager
  const manager = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ('Manager User', 'manager@demo.com', $1, 'manager', 'Engineering')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [hash]
  );

  // Employee linked to manager
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, manager_id, department)
     VALUES ('Employee User', 'employee@demo.com', $1, 'employee', $2, 'Engineering')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1, manager_id=$2`,
    [hash, manager.rows[0].id]
  );

  // Thrust areas
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
      `INSERT INTO thrust_areas (name, description)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [name, description]
    );
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
