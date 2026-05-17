const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole, requireWindow } = require('../middleware/auth');

const CYCLE_YEAR = new Date().getFullYear();

// List all team members' sheets
router.get('/team-sheets', authenticate, requireRole('manager'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT gs.*, u.name AS employee_name, u.email AS employee_email
     FROM goal_sheets gs
     JOIN users u ON u.id = gs.employee_id
     WHERE u.manager_id=$1
     ORDER BY gs.submitted_at DESC NULLS LAST`,
    [req.user.id]
  );
  res.json(rows);
});

// View one sheet with goals
router.get('/team-sheets/:id', authenticate, requireRole('manager'), async (req, res) => {
  const sheet = await getTeamSheet(req.params.id, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

  const { rows: goals } = await pool.query(
    `SELECT g.*, ta.name AS thrust_area_name
     FROM goals g
     LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
     WHERE g.goal_sheet_id=$1 ORDER BY g.id`,
    [sheet.id]
  );
  res.json({ ...sheet, goals });
});

// Inline edit a goal before approval
router.put('/goals/:id', authenticate, requireRole('manager'), async (req, res) => {
  const goal = await getGoalInTeamSheet(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.sheet_status !== 'submitted') {
    return res.status(400).json({ error: 'Can only edit goals on submitted sheets' });
  }

  const { target_value, target_date, weightage } = req.body;
  if (weightage !== undefined && weightage < 10) {
    return res.status(400).json({ error: 'Minimum weightage is 10%' });
  }

  const before = { target_value: goal.target_value, target_date: goal.target_date, weightage: goal.weightage };
  const { rows } = await pool.query(
    `UPDATE goals SET
       target_value=COALESCE($1, target_value),
       target_date=COALESCE($2, target_date),
       weightage=COALESCE($3, weightage),
       updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [target_value, target_date, weightage, goal.id]
  );

  await pool.query(
    `INSERT INTO goal_approvals (goal_sheet_id, action, actor_id, changed_fields)
     VALUES ($1, 'edited', $2, $3)`,
    [goal.goal_sheet_id, req.user.id, JSON.stringify({ before, after: { target_value, target_date, weightage } })]
  );

  res.json(rows[0]);
});

// Approve sheet — locks all goals
router.post('/team-sheets/:id/approve', authenticate, requireRole('manager'), requireWindow('goal_setting'), async (req, res) => {
  const sheet = await getTeamSheet(req.params.id, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.status !== 'submitted') return res.status(400).json({ error: 'Sheet must be submitted before approval' });

  const { rows: goals } = await pool.query(
    'SELECT weightage FROM goals WHERE goal_sheet_id=$1', [sheet.id]
  );
  if (goals.length === 0) return res.status(400).json({ error: 'No goals to approve' });

  const total = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
  if (Math.round(total) !== 100) {
    return res.status(400).json({ error: `Total weightage must equal 100%. Current: ${total}%` });
  }

  await pool.query(
    `UPDATE goal_sheets SET status='approved', approved_at=NOW(), approved_by=$1 WHERE id=$2`,
    [req.user.id, sheet.id]
  );
  await pool.query(`UPDATE goals SET is_locked=TRUE WHERE goal_sheet_id=$1`, [sheet.id]);
  await pool.query(
    `INSERT INTO goal_approvals (goal_sheet_id, action, actor_id) VALUES ($1, 'approved', $2)`,
    [sheet.id, req.user.id]
  );

  res.json({ message: 'Sheet approved and goals locked' });
});

// Return sheet for rework
router.post('/team-sheets/:id/return', authenticate, requireRole('manager'), requireWindow('goal_setting'), async (req, res) => {
  const sheet = await getTeamSheet(req.params.id, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (sheet.status !== 'submitted') return res.status(400).json({ error: 'Sheet must be submitted to return' });

  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment is required when returning for rework' });

  await pool.query(`UPDATE goal_sheets SET status='rework' WHERE id=$1`, [sheet.id]);
  await pool.query(
    `INSERT INTO goal_approvals (goal_sheet_id, action, actor_id, comment) VALUES ($1, 'returned', $2, $3)`,
    [sheet.id, req.user.id, comment]
  );

  res.json({ message: 'Sheet returned for rework' });
});

// Get check-in data for a sheet — goals + achievements + existing comment for a quarter
router.get('/checkins/:sheetId', authenticate, requireRole('manager'), async (req, res) => {
  const { quarter = 'Q1' } = req.query;
  const sheet = await getTeamSheet(req.params.sheetId, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

  const { rows: goals } = await pool.query(
    `SELECT g.*, ta.name AS thrust_area_name,
       ga.actual_value, ga.actual_date, ga.status AS achievement_status,
       ga.progress_score
     FROM goals g
     LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
     LEFT JOIN goal_achievements ga ON ga.goal_id = g.id AND ga.quarter = $2 AND ga.cycle_year = $3
     WHERE g.goal_sheet_id = $1
     ORDER BY g.id`,
    [sheet.id, quarter, CYCLE_YEAR]
  );

  const { rows: checkins } = await pool.query(
    `SELECT * FROM manager_checkins
     WHERE goal_sheet_id = $1 AND cycle_year = $2
     ORDER BY quarter`,
    [sheet.id, CYCLE_YEAR]
  );

  res.json({ ...sheet, goals, checkins });
});

// Submit manager check-in comment
router.post('/checkins', authenticate, requireRole('manager'), requireWindow('checkin'), async (req, res) => {
  const { goal_sheet_id, quarter, comment } = req.body;
  if (!goal_sheet_id || !quarter || !comment?.trim()) {
    return res.status(400).json({ error: 'goal_sheet_id, quarter, and comment are required' });
  }
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
    return res.status(400).json({ error: 'quarter must be Q1, Q2, Q3, or Q4' });
  }

  const sheet = await getTeamSheet(goal_sheet_id, req.user.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

  const { rows } = await pool.query(
    `INSERT INTO manager_checkins (goal_sheet_id, manager_id, quarter, cycle_year, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (goal_sheet_id, quarter, cycle_year) DO UPDATE SET
       comment = EXCLUDED.comment,
       created_at = NOW()
     RETURNING *`,
    [goal_sheet_id, req.user.id, quarter, CYCLE_YEAR, comment.trim()]
  );
  res.json(rows[0]);
});

// Helpers
async function getTeamSheet(sheetId, managerId) {
  const { rows } = await pool.query(
    `SELECT gs.* FROM goal_sheets gs
     JOIN users u ON u.id = gs.employee_id
     WHERE gs.id=$1 AND u.manager_id=$2`,
    [sheetId, managerId]
  );
  return rows[0] || null;
}

async function getGoalInTeamSheet(goalId, managerId) {
  const { rows } = await pool.query(
    `SELECT g.*, gs.status AS sheet_status, gs.id AS goal_sheet_id
     FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     JOIN users u ON u.id = gs.employee_id
     WHERE g.id=$1 AND u.manager_id=$2`,
    [goalId, managerId]
  );
  return rows[0] || null;
}

module.exports = router;
