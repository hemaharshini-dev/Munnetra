const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

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
router.post('/team-sheets/:id/approve', authenticate, requireRole('manager'), async (req, res) => {
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
router.post('/team-sheets/:id/return', authenticate, requireRole('manager'), async (req, res) => {
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
