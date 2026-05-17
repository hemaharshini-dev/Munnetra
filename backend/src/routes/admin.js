const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

// All sheets across org with filters
router.get('/goal-sheets', authenticate, requireRole('admin'), async (req, res) => {
  const { department, status, cycle_year } = req.query;
  let query = `
    SELECT gs.*, u.name AS employee_name, u.email, u.department
    FROM goal_sheets gs
    JOIN users u ON u.id = gs.employee_id
    WHERE 1=1
  `;
  const params = [];

  if (department) { params.push(department); query += ` AND u.department=$${params.length}`; }
  if (status) { params.push(status); query += ` AND gs.status=$${params.length}`; }
  if (cycle_year) { params.push(cycle_year); query += ` AND gs.cycle_year=$${params.length}`; }

  query += ' ORDER BY gs.submitted_at DESC NULLS LAST';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Get one sheet with all goals (so admin can see goal IDs)
router.get('/goal-sheets/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { rows: sheetRows } = await pool.query(
    `SELECT gs.*, u.name AS employee_name, u.email, u.department
     FROM goal_sheets gs JOIN users u ON u.id = gs.employee_id
     WHERE gs.id=$1`,
    [req.params.id]
  );
  if (!sheetRows.length) return res.status(404).json({ error: 'Sheet not found' });

  const { rows: goals } = await pool.query(
    `SELECT g.*, ta.name AS thrust_area_name
     FROM goals g LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
     WHERE g.goal_sheet_id=$1 ORDER BY g.id`,
    [req.params.id]
  );
  res.json({ ...sheetRows[0], goals });
});

// Unlock a locked goal
router.post('/goals/:id/unlock', authenticate, requireRole('admin'), async (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Reason comment is required to unlock a goal' });

  const { rows } = await pool.query('SELECT * FROM goals WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
  if (!rows[0].is_locked) return res.status(400).json({ error: 'Goal is not locked' });

  await pool.query(`UPDATE goals SET is_locked=FALSE, updated_at=NOW() WHERE id=$1`, [req.params.id]);
  await pool.query(
    `INSERT INTO goal_approvals (goal_sheet_id, action, actor_id, comment)
     VALUES ($1, 'unlocked', $2, $3)`,
    [rows[0].goal_sheet_id, req.user.id, comment]
  );

  res.json({ message: 'Goal unlocked' });
});

// Audit log
router.get('/audit-log', authenticate, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ga.*, u.name AS actor_name, u.email AS actor_email
     FROM goal_approvals ga
     JOIN users u ON u.id = ga.actor_id
     ORDER BY ga.timestamp DESC
     LIMIT 500`
  );
  res.json(rows);
});

// List all employees (for shared goal assignment)
router.get('/employees', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, department FROM users WHERE role='employee' ORDER BY name`
  );
  res.json(rows);
});

module.exports = router;
