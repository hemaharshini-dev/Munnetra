const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole, requireWindow } = require('../middleware/auth');

const CYCLE_YEAR = new Date().getFullYear();

// Get or create own goal sheet
router.get('/mine', authenticate, requireRole('employee'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT gs.*, json_agg(g.* ORDER BY g.id) FILTER (WHERE g.id IS NOT NULL) AS goals
     FROM goal_sheets gs
     LEFT JOIN goals g ON g.goal_sheet_id = gs.id
     WHERE gs.employee_id=$1 AND gs.cycle_year=$2
     GROUP BY gs.id`,
    [req.user.id, CYCLE_YEAR]
  );
  res.json(rows[0] || null);
});

router.post('/', authenticate, requireRole('employee'), requireWindow('goal_setting'), async (req, res) => {
  const existing = await pool.query(
    'SELECT id FROM goal_sheets WHERE employee_id=$1 AND cycle_year=$2',
    [req.user.id, CYCLE_YEAR]
  );
  if (existing.rows.length) return res.status(409).json({ error: 'Goal sheet already exists for this cycle' });

  const { rows } = await pool.query(
    `INSERT INTO goal_sheets (employee_id, cycle_year) VALUES ($1, $2) RETURNING *`,
    [req.user.id, CYCLE_YEAR]
  );
  res.status(201).json(rows[0]);
});

// Submit sheet for approval
router.post('/:id/submit', authenticate, requireRole('employee'), requireWindow('goal_setting'), async (req, res) => {
  const sheet = await getOwnSheet(req.params.id, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (!['draft', 'rework'].includes(sheet.status)) {
    return res.status(400).json({ error: 'Sheet cannot be submitted in its current status' });
  }

  const { rows: goals } = await pool.query(
    'SELECT weightage FROM goals WHERE goal_sheet_id=$1', [sheet.id]
  );
  if (goals.length === 0) return res.status(400).json({ error: 'Add at least one goal before submitting' });

  const total = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
  if (Math.round(total) !== 100) {
    return res.status(400).json({ error: `Total weightage must equal 100%. Current: ${total}%` });
  }

  const { rows } = await pool.query(
    `UPDATE goal_sheets SET status='submitted', submitted_at=NOW() WHERE id=$1 RETURNING *`,
    [sheet.id]
  );
  res.json(rows[0]);
});

// Add goal to sheet
router.post('/:sheetId/goals', authenticate, requireRole('employee'), async (req, res) => {
  const sheet = await getOwnSheet(req.params.sheetId, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (!['draft', 'rework'].includes(sheet.status)) {
    return res.status(400).json({ error: 'Cannot add goals — sheet is not editable' });
  }

  const { rows: existing } = await pool.query(
    'SELECT COUNT(*) FROM goals WHERE goal_sheet_id=$1', [sheet.id]
  );
  if (parseInt(existing[0].count) >= 8) {
    return res.status(400).json({ error: 'Maximum 8 goals allowed per employee' });
  }

  const { thrust_area_id, title, description, uom_type, target_value, target_date, weightage } = req.body;
  if (!title || !uom_type || weightage === undefined) {
    return res.status(400).json({ error: 'title, uom_type, and weightage are required' });
  }
  if (weightage < 10) return res.status(400).json({ error: 'Minimum weightage per goal is 10%' });

  const { rows } = await pool.query(
    `INSERT INTO goals (goal_sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [sheet.id, thrust_area_id, title, description, uom_type, target_value || null, target_date || null, weightage]
  );
  res.status(201).json(rows[0]);
});

// Edit own goal
router.put('/goals/:id', authenticate, requireRole('employee'), async (req, res) => {
  const goal = await getGoalForEmployee(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.is_locked) return res.status(403).json({ error: 'Goal is locked' });
  if (goal.is_shared) {
    // Shared goal: only weightage allowed
    const { weightage } = req.body;
    if (weightage === undefined) return res.status(400).json({ error: 'Only weightage can be updated on shared goals' });
    if (weightage < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });
    const { rows } = await pool.query(
      `UPDATE goals SET weightage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [weightage, goal.id]
    );
    return res.json(rows[0]);
  }

  const { thrust_area_id, title, description, uom_type, target_value, target_date, weightage } = req.body;
  if (req.body.weightage !== undefined && req.body.weightage < 10) {
    return res.status(400).json({ error: 'Minimum weightage is 10%' });
  }

  const { rows } = await pool.query(
    `UPDATE goals SET
       thrust_area_id=COALESCE($1, thrust_area_id),
       title=COALESCE($2, title),
       description=COALESCE($3, description),
       uom_type=COALESCE($4, uom_type),
       target_value=COALESCE($5, target_value),
       target_date=COALESCE($6, target_date),
       weightage=COALESCE($7, weightage),
       updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [thrust_area_id, title, description, uom_type, target_value, target_date, weightage, goal.id]
  );
  res.json(rows[0]);
});

// Delete own goal
router.delete('/goals/:id', authenticate, requireRole('employee'), async (req, res) => {
  const goal = await getGoalForEmployee(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.is_locked) return res.status(403).json({ error: 'Goal is locked' });
  await pool.query('DELETE FROM goals WHERE id=$1', [goal.id]);
  res.json({ message: 'Goal deleted' });
});

// Helpers
async function getOwnSheet(sheetId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM goal_sheets WHERE id=$1 AND employee_id=$2', [sheetId, userId]
  );
  return rows[0] || null;
}

async function getGoalForEmployee(goalId, userId) {
  const { rows } = await pool.query(
    `SELECT g.* FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     WHERE g.id=$1 AND gs.employee_id=$2 AND gs.status IN ('draft','rework')`,
    [goalId, userId]
  );
  return rows[0] || null;
}

module.exports = router;
