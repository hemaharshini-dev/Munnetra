const pool = require('./pool');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'manager', 'admin')),
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      department VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS thrust_areas (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS goal_sheets (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cycle_year INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rework')),
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(employee_id, cycle_year)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      goal_sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
      thrust_area_id INTEGER REFERENCES thrust_areas(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      uom_type VARCHAR(20) NOT NULL CHECK (uom_type IN ('numeric_min','numeric_max','timeline','zero')),
      target_value NUMERIC,
      target_date DATE,
      weightage NUMERIC NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
      is_shared BOOLEAN DEFAULT FALSE,
      shared_from_goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
      is_locked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goal_approvals (
      id SERIAL PRIMARY KEY,
      goal_sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
      action VARCHAR(20) NOT NULL CHECK (action IN ('approved','returned','edited','unlocked')),
      actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT,
      changed_fields JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shared_goal_assignments (
      id SERIAL PRIMARY KEY,
      source_goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      employee_goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
      weightage_override NUMERIC
    );

    CREATE TABLE IF NOT EXISTS goal_achievements (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      quarter VARCHAR(5) NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
      cycle_year INTEGER NOT NULL,
      actual_value NUMERIC,
      actual_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','on_track','completed')),
      progress_score NUMERIC,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(goal_id, quarter, cycle_year)
    );

    CREATE TABLE IF NOT EXISTS manager_checkins (
      id SERIAL PRIMARY KEY,
      goal_sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
      manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quarter VARCHAR(5) NOT NULL,
      cycle_year INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(goal_sheet_id, quarter, cycle_year)
    );

    CREATE TABLE IF NOT EXISTS check_in_windows (
      id SERIAL PRIMARY KEY,
      period VARCHAR(30) NOT NULL,
      label VARCHAR(60) NOT NULL,
      opens_at DATE NOT NULL,
      closes_at DATE NOT NULL,
      cycle_year INTEGER NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('goal_setting','checkin')),
      UNIQUE(period, cycle_year)
    );

    -- Add unique constraint on thrust_areas.name if not already present
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'thrust_areas_name_key'
      ) THEN
        -- Remove duplicates first, keeping lowest id
        DELETE FROM thrust_areas WHERE id NOT IN (
          SELECT MIN(id) FROM thrust_areas GROUP BY name
        );
        ALTER TABLE thrust_areas ADD CONSTRAINT thrust_areas_name_key UNIQUE (name);
      END IF;
    END $$;

    -- Extend goal_approvals action constraint to include new Phase 2 actions
    ALTER TABLE goal_approvals DROP CONSTRAINT IF EXISTS goal_approvals_action_check;
    ALTER TABLE goal_approvals ADD CONSTRAINT goal_approvals_action_check
      CHECK (action IN ('approved','returned','edited','unlocked','checkin','achievement_updated'));

    CREATE TABLE IF NOT EXISTS escalations (
      id             SERIAL PRIMARY KEY,
      type           VARCHAR(30) NOT NULL CHECK (type IN ('goal_not_submitted','approval_overdue','checkin_overdue')),
      employee_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      manager_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      goal_sheet_id  INTEGER REFERENCES goal_sheets(id) ON DELETE SET NULL,
      quarter        VARCHAR(5),
      cycle_year     INTEGER NOT NULL,
      level          INTEGER NOT NULL DEFAULT 1,
      message        TEXT,
      resolved       BOOLEAN DEFAULT FALSE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('Migration complete.');
}

module.exports = migrate;

// Run directly: node src/db/migrate.js
if (require.main === module) {
  migrate().then(() => pool.end()).catch(err => { console.error(err); process.exit(1); });
}
