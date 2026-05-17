const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const CYCLE_YEAR = new Date().getFullYear();

// Admin/Manager pushes a shared goal to multiple employees
router.post('/', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  const { thrust_area_id, title, description, uom_type, target_value, target_date, weightage, employee_ids } = req.body;

  if (!title || !uom_type || !employee_ids?.length) {
    return res.status(400).json({ error: 'title, uom_type, and employee_ids are required' });
  }
  if (weightage < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const results = [];
    for (const empId of employee_ids) {
      // Ensure employee has a goal sheet for this cycle
      let sheetRes = await client.query(
        'SELECT id FROM goal_sheets WHERE employee_id=$1 AND cycle_year=$2',
        [empId, CYCLE_YEAR]
      );
      let sheetId;
      if (sheetRes.rows.length === 0) {
        const newSheet = await client.query(
          `INSERT INTO goal_sheets (employee_id, cycle_year) VALUES ($1, $2) RETURNING id`,
          [empId, CYCLE_YEAR]
        );
        sheetId = newSheet.rows[0].id;
      } else {
        sheetId = sheetRes.rows[0].id;
      }

      // Check max goals
      const countRes = await client.query('SELECT COUNT(*) FROM goals WHERE goal_sheet_id=$1', [sheetId]);
      if (parseInt(countRes.rows[0].count) >= 8) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee ${empId} already has 8 goals` });
      }

      const goalRes = await client.query(
        `INSERT INTO goals (goal_sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, is_shared)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING *`,
        [sheetId, thrust_area_id, title, description, uom_type, target_value || null, target_date || null, weightage]
      );

      await client.query(
        `INSERT INTO shared_goal_assignments (source_goal_id, assigned_to, employee_goal_id, weightage_override)
         VALUES ($1,$2,$3,$4)`,
        [goalRes.rows[0].id, empId, goalRes.rows[0].id, weightage]
      );

      results.push(goalRes.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Employee views their shared goals
router.get('/mine', authenticate, requireRole('employee'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.*, ta.name AS thrust_area_name
     FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
     WHERE gs.employee_id=$1 AND g.is_shared=TRUE AND gs.cycle_year=$2`,
    [req.user.id, CYCLE_YEAR]
  );
  res.json(rows);
});

// Employee updates weightage on a shared goal
router.put('/:id/weightage', authenticate, requireRole('employee'), async (req, res) => {
  const { weightage } = req.body;
  if (weightage === undefined) return res.status(400).json({ error: 'weightage is required' });
  if (weightage < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });

  const { rows } = await pool.query(
    `SELECT g.* FROM goals g
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     WHERE g.id=$1 AND gs.employee_id=$2 AND g.is_shared=TRUE AND g.is_locked=FALSE`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Shared goal not found or locked' });

  const updated = await pool.query(
    `UPDATE goals SET weightage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [weightage, rows[0].id]
  );
  res.json(updated.rows[0]);
});

module.exports = router;
