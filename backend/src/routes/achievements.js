const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole, requireWindow } = require('../middleware/auth');

const CYCLE_YEAR = new Date().getFullYear();

// Compute progress score based on UoM type
function computeScore(uom_type, target_value, target_date, actual_value, actual_date) {
  if (uom_type === 'numeric_min') {
    if (!target_value || !actual_value) return null;
    return Math.min(parseFloat(actual_value) / parseFloat(target_value), 1.0);
  }
  if (uom_type === 'numeric_max') {
    if (!target_value || !actual_value || parseFloat(actual_value) === 0) return 1.0;
    return Math.min(parseFloat(target_value) / parseFloat(actual_value), 1.0);
  }
  if (uom_type === 'timeline') {
    if (!target_date || !actual_date) return null;
    return new Date(actual_date) <= new Date(target_date) ? 1.0 : 0.0;
  }
  if (uom_type === 'zero') {
    if (actual_value === null || actual_value === undefined) return null;
    return parseFloat(actual_value) === 0 ? 1.0 : 0.0;
  }
  return null;
}

// GET /api/achievements/mine — all goals with achievements for all quarters
router.get('/mine', authenticate, requireRole('employee'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.*, ta.name AS thrust_area_name,
       json_agg(
         json_build_object(
           'id', ga.id, 'quarter', ga.quarter, 'cycle_year', ga.cycle_year,
           'actual_value', ga.actual_value, 'actual_date', ga.actual_date,
           'status', ga.status, 'progress_score', ga.progress_score,
           'updated_at', ga.updated_at
         ) ORDER BY ga.quarter
       ) FILTER (WHERE ga.id IS NOT NULL) AS achievements
     FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
     LEFT JOIN goal_achievements ga ON ga.goal_id = g.id AND ga.cycle_year = $2
     WHERE gs.employee_id = $1 AND gs.cycle_year = $2 AND gs.status = 'approved'
     GROUP BY g.id, ta.name
     ORDER BY g.id`,
    [req.user.id, CYCLE_YEAR]
  );
  res.json(rows);
});

// POST /api/achievements — upsert achievement + compute score + sync shared goals
router.post('/', authenticate, requireRole('employee'), requireWindow('checkin'), async (req, res) => {
  const { goal_id, quarter, actual_value, actual_date, status } = req.body;

  if (!goal_id || !quarter || !status) {
    return res.status(400).json({ error: 'goal_id, quarter, and status are required' });
  }
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
    return res.status(400).json({ error: 'quarter must be Q1, Q2, Q3, or Q4' });
  }

  // Verify goal belongs to employee's approved sheet
  const { rows: goalRows } = await pool.query(
    `SELECT g.*, gs.employee_id FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     WHERE g.id = $1 AND gs.employee_id = $2 AND gs.status = 'approved' AND gs.cycle_year = $3`,
    [goal_id, req.user.id, CYCLE_YEAR]
  );
  if (!goalRows.length) return res.status(404).json({ error: 'Goal not found or sheet not approved' });

  const goal = goalRows[0];

  // Shared goal — recipient cannot change actual value
  if (goal.is_shared && goal.shared_from_goal_id) {
    const { rows: srcRows } = await pool.query(
      `SELECT gs.employee_id FROM goals g
       JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
       WHERE g.id = $1`,
      [goal.shared_from_goal_id]
    );
    if (srcRows.length && srcRows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Shared goal — actual value is synced from the source owner. You can only update status.' });
    }
  }

  const score = computeScore(goal.uom_type, goal.target_value, goal.target_date, actual_value, actual_date);

  // Check if this is an update (existing record) for audit logging
  const { rows: existing } = await pool.query(
    `SELECT actual_value, actual_date, status FROM goal_achievements
     WHERE goal_id=$1 AND quarter=$2 AND cycle_year=$3`,
    [goal_id, quarter, CYCLE_YEAR]
  );
  const isUpdate = existing.length > 0;

  const { rows } = await pool.query(
    `INSERT INTO goal_achievements (goal_id, quarter, cycle_year, actual_value, actual_date, status, progress_score, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (goal_id, quarter, cycle_year) DO UPDATE SET
       actual_value = EXCLUDED.actual_value,
       actual_date = EXCLUDED.actual_date,
       status = EXCLUDED.status,
       progress_score = EXCLUDED.progress_score,
       updated_at = NOW()
     RETURNING *`,
    [goal_id, quarter, CYCLE_YEAR, actual_value ?? null, actual_date ?? null, status, score]
  );

  // Audit log for updates to achievements after initial save
  if (isUpdate) {
    const before = existing[0];
    await pool.query(
      `INSERT INTO goal_approvals (goal_sheet_id, action, actor_id, changed_fields)
       VALUES ($1, 'achievement_updated', $2, $3)`,
      [
        goal.goal_sheet_id,
        req.user.id,
        JSON.stringify({ quarter, goal_id, before, after: { actual_value, actual_date, status } })
      ]
    );
  }

  // Sync actual to all shared goal recipients
  if (!goal.is_shared) {
    const { rows: assignments } = await pool.query(
      `SELECT employee_goal_id FROM shared_goal_assignments WHERE source_goal_id = $1`,
      [goal_id]
    );
    for (const a of assignments) {
      if (!a.employee_goal_id) continue;
      await pool.query(
        `INSERT INTO goal_achievements (goal_id, quarter, cycle_year, actual_value, actual_date, progress_score, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'not_started', NOW())
         ON CONFLICT (goal_id, quarter, cycle_year) DO UPDATE SET
           actual_value = EXCLUDED.actual_value,
           actual_date = EXCLUDED.actual_date,
           progress_score = EXCLUDED.progress_score,
           updated_at = NOW()`,
        [a.employee_goal_id, quarter, CYCLE_YEAR, actual_value ?? null, actual_date ?? null, score]
      );
    }
  }

  res.json(rows[0]);
});

module.exports = router;
