const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

// QoQ Achievement Trends — avg score per quarter per department
router.get('/qoq-trends', authenticate, requireRole('admin'), async (req, res) => {
  const year = parseInt(req.query.cycle_year) || new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT
       ga.quarter,
       u.department,
       ROUND(AVG(ga.progress_score) * 100, 1) AS avg_score
     FROM goal_achievements ga
     JOIN goals g ON g.id = ga.goal_id
     JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
     JOIN users u ON u.id = gs.employee_id
     WHERE ga.cycle_year = $1 AND ga.progress_score IS NOT NULL
     GROUP BY ga.quarter, u.department
     ORDER BY ga.quarter, u.department`,
    [year]
  );

  // Pivot: [{ quarter, dept1: score, dept2: score }, ...]
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const depts = [...new Set(rows.map(r => r.department).filter(Boolean))];
  const pivoted = quarters.map(q => {
    const entry = { quarter: q };
    depts.forEach(d => {
      const match = rows.find(r => r.quarter === q && r.department === d);
      entry[d] = match ? parseFloat(match.avg_score) : null;
    });
    return entry;
  });

  res.json({ data: pivoted, departments: depts });
});

// Completion Rates — employee + manager completion % per quarter
router.get('/completion-rates', authenticate, requireRole('admin'), async (req, res) => {
  const year = parseInt(req.query.cycle_year) || new Date().getFullYear();

  const { rows: totals } = await pool.query(
    `SELECT COUNT(*) AS total FROM goal_sheets WHERE cycle_year=$1 AND status='approved'`,
    [year]
  );
  const total = parseInt(totals[0].total) || 1;

  const { rows } = await pool.query(
    `SELECT
       q.quarter,
       COUNT(DISTINCT ga.employee_id) AS emp_done,
       COUNT(DISTINCT mc.manager_id)  AS mgr_done
     FROM (VALUES ('Q1'),('Q2'),('Q3'),('Q4')) AS q(quarter)
     LEFT JOIN (
       SELECT DISTINCT ga.quarter, gs.employee_id
       FROM goal_achievements ga
       JOIN goals g ON g.id = ga.goal_id
       JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
       WHERE ga.cycle_year = $1
     ) ga ON ga.quarter = q.quarter
     LEFT JOIN (
       SELECT DISTINCT quarter, manager_id FROM manager_checkins WHERE cycle_year = $1
     ) mc ON mc.quarter = q.quarter
     GROUP BY q.quarter ORDER BY q.quarter`,
    [year]
  );

  const result = rows.map(r => ({
    quarter: r.quarter,
    employee_pct: Math.round((parseInt(r.emp_done) / total) * 100),
    manager_pct:  Math.round((parseInt(r.mgr_done) / total) * 100),
  }));

  res.json(result);
});

// Goal Distribution — by thrust area, uom type, and achievement status
router.get('/goal-distribution', authenticate, requireRole('admin'), async (req, res) => {
  const year = parseInt(req.query.cycle_year) || new Date().getFullYear();

  const [byThrust, byUom, byStatus] = await Promise.all([
    pool.query(
      `SELECT COALESCE(ta.name, 'Unassigned') AS name, COUNT(*) AS count
       FROM goals g
       JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
       LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
       WHERE gs.cycle_year=$1 AND gs.status='approved'
       GROUP BY ta.name ORDER BY count DESC`,
      [year]
    ),
    pool.query(
      `SELECT g.uom_type AS name, COUNT(*) AS count
       FROM goals g
       JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
       WHERE gs.cycle_year=$1 AND gs.status='approved'
       GROUP BY g.uom_type ORDER BY count DESC`,
      [year]
    ),
    pool.query(
      `SELECT COALESCE(ga.status, 'not_started') AS name, COUNT(*) AS count
       FROM goals g
       JOIN goal_sheets gs ON gs.id = g.goal_sheet_id
       LEFT JOIN LATERAL (
         SELECT status FROM goal_achievements
         WHERE goal_id = g.id AND cycle_year = $1
         ORDER BY updated_at DESC LIMIT 1
       ) ga ON true
       WHERE gs.cycle_year=$1 AND gs.status='approved'
       GROUP BY ga.status ORDER BY count DESC`,
      [year]
    ),
  ]);

  res.json({
    by_thrust_area: byThrust.rows.map(r => ({ name: r.name, value: parseInt(r.count) })),
    by_uom:         byUom.rows.map(r => ({ name: r.name, value: parseInt(r.count) })),
    by_status:      byStatus.rows.map(r => ({ name: r.name, value: parseInt(r.count) })),
  });
});

// Manager Effectiveness — check-in completion rate per manager
router.get('/manager-effectiveness', authenticate, requireRole('admin'), async (req, res) => {
  const year = parseInt(req.query.cycle_year) || new Date().getFullYear();

  const { rows } = await pool.query(
    `SELECT
       m.id AS manager_id,
       m.name AS manager_name,
       COUNT(DISTINCT gs.id) AS team_size,
       COUNT(DISTINCT (mc.goal_sheet_id || '-' || mc.quarter)) AS checkins_done
     FROM users m
     JOIN users emp ON emp.manager_id = m.id
     JOIN goal_sheets gs ON gs.employee_id = emp.id AND gs.cycle_year=$1 AND gs.status='approved'
     LEFT JOIN manager_checkins mc ON mc.goal_sheet_id = gs.id AND mc.cycle_year=$1
     WHERE m.role='manager'
     GROUP BY m.id, m.name
     ORDER BY m.name`,
    [year]
  );

  const result = rows.map(r => {
    const possible = parseInt(r.team_size) * 4;
    const done = parseInt(r.checkins_done);
    return {
      manager_name: r.manager_name,
      rate: possible > 0 ? Math.round((done / possible) * 100) : 0,
      done,
      possible,
    };
  });

  res.json(result);
});

module.exports = router;
