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

// Achievement report — planned vs actual for all employees, all quarters
router.get('/achievement-report', authenticate, requireRole('admin'), async (req, res) => {
  const { department, cycle_year } = req.query;
  const year = parseInt(cycle_year) || new Date().getFullYear();

  let baseQuery = `
    SELECT
      u.name AS employee_name, u.email, u.department,
      u.manager_id,
      g.id AS goal_id, g.title AS goal_title, g.uom_type,
      g.target_value, g.target_date, g.weightage,
      ta.name AS thrust_area,
      ga_q1.actual_value AS q1_actual, ga_q1.actual_date AS q1_date,
        ga_q1.status AS q1_status, ga_q1.progress_score AS q1_score,
      ga_q2.actual_value AS q2_actual, ga_q2.actual_date AS q2_date,
        ga_q2.status AS q2_status, ga_q2.progress_score AS q2_score,
      ga_q3.actual_value AS q3_actual, ga_q3.actual_date AS q3_date,
        ga_q3.status AS q3_status, ga_q3.progress_score AS q3_score,
      ga_q4.actual_value AS q4_actual, ga_q4.actual_date AS q4_date,
        ga_q4.status AS q4_status, ga_q4.progress_score AS q4_score
    FROM goals g
    JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
    JOIN users u ON u.id = gs.employee_id
    LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
    LEFT JOIN goal_achievements ga_q1 ON ga_q1.goal_id = g.id AND ga_q1.quarter='Q1' AND ga_q1.cycle_year=$1
    LEFT JOIN goal_achievements ga_q2 ON ga_q2.goal_id = g.id AND ga_q2.quarter='Q2' AND ga_q2.cycle_year=$1
    LEFT JOIN goal_achievements ga_q3 ON ga_q3.goal_id = g.id AND ga_q3.quarter='Q3' AND ga_q3.cycle_year=$1
    LEFT JOIN goal_achievements ga_q4 ON ga_q4.goal_id = g.id AND ga_q4.quarter='Q4' AND ga_q4.cycle_year=$1
    WHERE gs.cycle_year=$1 AND gs.status='approved'
  `;
  const params = [year];
  if (department) { params.push(department); baseQuery += ` AND u.department=$${params.length}`; }
  baseQuery += ' ORDER BY u.name, g.id';

  const { rows } = await pool.query(baseQuery, params);
  res.json(rows);
});

// Completion dashboard — per employee: which quarters employee + manager have completed
router.get('/completion-dashboard', authenticate, requireRole('admin'), async (req, res) => {
  const { department } = req.query;
  const year = new Date().getFullYear();

  let query = `
    SELECT
      u.id AS employee_id, u.name AS employee_name, u.email, u.department,
      m.name AS manager_name,
      -- Employee done: at least one achievement logged that quarter
      BOOL_OR(ga.quarter='Q1') FILTER (WHERE ga.quarter='Q1') AS q1_employee_done,
      BOOL_OR(ga.quarter='Q2') FILTER (WHERE ga.quarter='Q2') AS q2_employee_done,
      BOOL_OR(ga.quarter='Q3') FILTER (WHERE ga.quarter='Q3') AS q3_employee_done,
      BOOL_OR(ga.quarter='Q4') FILTER (WHERE ga.quarter='Q4') AS q4_employee_done,
      -- Manager done: check-in comment submitted that quarter
      BOOL_OR(mc.quarter='Q1') FILTER (WHERE mc.quarter='Q1') AS q1_manager_done,
      BOOL_OR(mc.quarter='Q2') FILTER (WHERE mc.quarter='Q2') AS q2_manager_done,
      BOOL_OR(mc.quarter='Q3') FILTER (WHERE mc.quarter='Q3') AS q3_manager_done,
      BOOL_OR(mc.quarter='Q4') FILTER (WHERE mc.quarter='Q4') AS q4_manager_done
    FROM users u
    LEFT JOIN users m ON m.id = u.manager_id
    LEFT JOIN goal_sheets gs ON gs.employee_id = u.id AND gs.cycle_year=$1 AND gs.status='approved'
    LEFT JOIN goals g ON g.goal_sheet_id = gs.id
    LEFT JOIN goal_achievements ga ON ga.goal_id = g.id AND ga.cycle_year=$1
    LEFT JOIN manager_checkins mc ON mc.goal_sheet_id = gs.id AND mc.cycle_year=$1
    WHERE u.role='employee'
  `;
  const params = [year];
  if (department) { params.push(department); query += ` AND u.department=$${params.length}`; }
  query += ' GROUP BY u.id, u.name, u.email, u.department, m.name ORDER BY u.name';

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

module.exports = router;
