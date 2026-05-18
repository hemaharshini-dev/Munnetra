const cron = require('node-cron');
const pool = require('../db/pool');

const RULES = {
  goal_not_submitted_days: 7,
  approval_overdue_days:   3,
  checkin_overdue_days:    7,
  level2_after_days:       3,
  level3_after_days:       3,
};

const CYCLE_YEAR = new Date().getFullYear();

async function runEscalations() {
  console.log('[EscalationJob] Running at', new Date().toISOString());
  try {
    await checkGoalNotSubmitted();
    await checkApprovalOverdue();
    await checkCheckinOverdue();
    console.log('[EscalationJob] Done.');
  } catch (err) {
    console.error('[EscalationJob] Error:', err.message);
  }
}

// Rule 1 — Employee has not submitted goals within N days of goal_setting window opening
async function checkGoalNotSubmitted() {
  const { rows: windows } = await pool.query(
    `SELECT * FROM check_in_windows
     WHERE action='goal_setting' AND cycle_year=$1
     AND opens_at <= CURRENT_DATE AND closes_at >= CURRENT_DATE`,
    [CYCLE_YEAR]
  );
  if (!windows.length) return;
  const window = windows[0];
  const daysSinceOpen = Math.floor((Date.now() - new Date(window.opens_at)) / 86400000);
  if (daysSinceOpen < RULES.goal_not_submitted_days) return;

  // Employees with no submitted/approved sheet
  const { rows: employees } = await pool.query(
    `SELECT u.id, u.name, u.manager_id FROM users u
     WHERE u.role = 'employee'
     AND NOT EXISTS (
       SELECT 1 FROM goal_sheets gs
       WHERE gs.employee_id = u.id AND gs.cycle_year = $1
       AND gs.status IN ('submitted','approved','rework')
     )`,
    [CYCLE_YEAR]
  );

  for (const emp of employees) {
    const existing = await pool.query(
      `SELECT * FROM escalations
       WHERE type='goal_not_submitted' AND employee_id=$1 AND cycle_year=$2
       ORDER BY level DESC LIMIT 1`,
      [emp.id, CYCLE_YEAR]
    );
    const current = existing.rows[0];

    if (!current) {
      await insertEscalation({
        type: 'goal_not_submitted', employee_id: emp.id, manager_id: emp.manager_id,
        cycle_year: CYCLE_YEAR, level: 1,
        message: `Employee has not submitted goals ${daysSinceOpen} days after the Goal Setting window opened.`,
      });
    } else if (current.level === 1) {
      const daysSinceL1 = Math.floor((Date.now() - new Date(current.created_at)) / 86400000);
      if (daysSinceL1 >= RULES.level2_after_days) {
        await insertEscalation({
          type: 'goal_not_submitted', employee_id: emp.id, manager_id: emp.manager_id,
          cycle_year: CYCLE_YEAR, level: 2,
          message: `Manager notified — employee still has not submitted goals after ${daysSinceOpen} days.`,
        });
      }
    } else if (current.level === 2) {
      const daysSinceL2 = Math.floor((Date.now() - new Date(current.created_at)) / 86400000);
      if (daysSinceL2 >= RULES.level3_after_days) {
        await insertEscalation({
          type: 'goal_not_submitted', employee_id: emp.id, manager_id: emp.manager_id,
          cycle_year: CYCLE_YEAR, level: 3,
          message: `Admin notified — goals still not submitted after ${daysSinceOpen} days. Immediate action required.`,
        });
      }
    }
  }
}

// Rule 2 — Manager has not approved goals within N days of submission
async function checkApprovalOverdue() {
  const { rows: sheets } = await pool.query(
    `SELECT gs.*, u.manager_id FROM goal_sheets gs
     JOIN users u ON u.id = gs.employee_id
     WHERE gs.status = 'submitted' AND gs.cycle_year = $1
     AND (CURRENT_DATE - gs.submitted_at::date) >= $2`,
    [CYCLE_YEAR, RULES.approval_overdue_days]
  );

  for (const sheet of sheets) {
    const daysSinceSubmit = Math.floor((Date.now() - new Date(sheet.submitted_at)) / 86400000);
    const existing = await pool.query(
      `SELECT * FROM escalations
       WHERE type='approval_overdue' AND goal_sheet_id=$1
       ORDER BY level DESC LIMIT 1`,
      [sheet.id]
    );
    const current = existing.rows[0];

    if (!current) {
      await insertEscalation({
        type: 'approval_overdue', employee_id: sheet.employee_id,
        manager_id: sheet.manager_id, goal_sheet_id: sheet.id,
        cycle_year: CYCLE_YEAR, level: 1,
        message: `Goal sheet submitted ${daysSinceSubmit} days ago and has not been approved yet.`,
      });
    } else if (current.level === 1) {
      const daysSinceL1 = Math.floor((Date.now() - new Date(current.created_at)) / 86400000);
      if (daysSinceL1 >= RULES.level2_after_days) {
        await insertEscalation({
          type: 'approval_overdue', employee_id: sheet.employee_id,
          manager_id: sheet.manager_id, goal_sheet_id: sheet.id,
          cycle_year: CYCLE_YEAR, level: 2,
          message: `Admin notified — manager has not approved the goal sheet after ${daysSinceSubmit} days.`,
        });
      }
    }
  }
}

// Rule 3 — Check-in not completed within N days before window closes
async function checkCheckinOverdue() {
  const { rows: windows } = await pool.query(
    `SELECT * FROM check_in_windows
     WHERE action='checkin' AND cycle_year=$1
     AND opens_at <= CURRENT_DATE AND closes_at >= CURRENT_DATE`,
    [CYCLE_YEAR]
  );
  if (!windows.length) return;
  const window = windows[0];
  const daysUntilClose = Math.ceil((new Date(window.closes_at) - Date.now()) / 86400000);
  if (daysUntilClose > RULES.checkin_overdue_days) return;

  const quarter = window.period;

  // Employees with approved sheet but no achievements logged this quarter
  const { rows: employees } = await pool.query(
    `SELECT u.id, u.name, u.manager_id FROM users u
     JOIN goal_sheets gs ON gs.employee_id = u.id
     WHERE u.role = 'employee' AND gs.status = 'approved' AND gs.cycle_year = $1
     AND NOT EXISTS (
       SELECT 1 FROM goals g
       JOIN goal_achievements ga ON ga.goal_id = g.id
       WHERE g.goal_sheet_id = gs.id AND ga.quarter = $2 AND ga.cycle_year = $1
     )`,
    [CYCLE_YEAR, quarter]
  );

  for (const emp of employees) {
    const existing = await pool.query(
      `SELECT * FROM escalations
       WHERE type='checkin_overdue' AND employee_id=$1 AND quarter=$2 AND cycle_year=$3
       ORDER BY level DESC LIMIT 1`,
      [emp.id, quarter, CYCLE_YEAR]
    );
    const current = existing.rows[0];

    if (!current) {
      await insertEscalation({
        type: 'checkin_overdue', employee_id: emp.id, manager_id: emp.manager_id,
        quarter, cycle_year: CYCLE_YEAR, level: 1,
        message: `Employee has not logged ${quarter} check-in. Window closes in ${daysUntilClose} day(s).`,
      });
    } else if (current.level === 1) {
      const daysSinceL1 = Math.floor((Date.now() - new Date(current.created_at)) / 86400000);
      if (daysSinceL1 >= RULES.level2_after_days) {
        await insertEscalation({
          type: 'checkin_overdue', employee_id: emp.id, manager_id: emp.manager_id,
          quarter, cycle_year: CYCLE_YEAR, level: 2,
          message: `Manager notified — employee still has not completed ${quarter} check-in. Window closes in ${daysUntilClose} day(s).`,
        });
      }
    }
  }
}

async function insertEscalation({ type, employee_id, manager_id, goal_sheet_id, quarter, cycle_year, level, message }) {
  await pool.query(
    `INSERT INTO escalations (type, employee_id, manager_id, goal_sheet_id, quarter, cycle_year, level, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [type, employee_id, manager_id || null, goal_sheet_id || null, quarter || null, cycle_year, level, message]
  );
}

function start() {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', runEscalations);
  console.log('[EscalationJob] Scheduled — runs daily at 9:00 AM');
}

module.exports = { start, runEscalations };
