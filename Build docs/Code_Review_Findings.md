# Code Review Findings
### Goal Setting & Tracking Portal — Full Codebase Analysis

---

## Backend

### Security & Correctness

- **`backend/src/index.js`** — CORS is wide open (`app.use(cors())`). Should restrict to `http://localhost:3000` in production.
- **`backend/src/middleware/auth.js`** — `requireWindow` has no try/catch; a DB error will crash the request unhandled.
- **`backend/src/routes/auth.js`** — No rate limiting on `POST /login`. Brute-force attacks are possible.
- **`backend/src/routes/goalSheets.js`** — `CYCLE_YEAR` is computed once at module load time (top-level `const`). If the server runs across a year boundary without restart, it will use the wrong year. Same issue exists in `achievements.js`, `manager.js`, `sharedGoals.js`, `checkinWindows.js`, and `escalationJob.js`.
- **`backend/src/routes/goalSheets.js`** — `getGoalForEmployee` only returns goals on sheets with status `draft` or `rework`. If a sheet is `approved` and admin unlocks a goal, the employee can't edit it because the query filters out `approved` status.
- **`backend/src/routes/sharedGoals.js`** — When pushing a shared goal, `source_goal_id` in `shared_goal_assignments` is set to the newly created employee goal itself (not a true "source" goal). The sync logic in `achievements.js` won't work correctly for cross-employee syncing.
- **`backend/src/routes/admin.js`** — No error handling (no try/catch) on any route — unhandled promise rejections will crash or hang.
- **`backend/src/routes/analytics.js`** — `manager-effectiveness` uses string concatenation (`mc.goal_sheet_id || '-' || mc.quarter`) for `COUNT(DISTINCT ...)` which is fragile. Should use a proper composite key or subquery.

### Logic Bugs

- **`backend/src/routes/achievements.js`** — `numeric_max` score: when `actual_value` is `0`, it returns `1.0` (line: `if (!actual_value || parseFloat(actual_value) === 0) return 1.0`). Zero actual for a "lower is better" metric should arguably not auto-score 1.0 without a target.
- **`backend/src/routes/manager.js`** — Manager can inline-edit goals on `submitted` sheets, but there's no `requireWindow('goal_setting')` guard on `PUT /goals/:id`. A manager could edit goals outside the goal-setting window.
- **`backend/src/jobs/escalationJob.js`** — `CYCLE_YEAR` is module-level, same year-boundary bug. Also, escalation levels can stack indefinitely if the job runs multiple times — there's no cap at level 3 for `checkin_overdue` (only goes to L2).

### Missing Features / Improvements

- **`backend/src/routes/admin.js`** — `GET /achievement-report` fetches the manager name via `manager_id` but never joins the `users` table for manager name — it's in the SELECT but not joined.
- **`backend/src/routes/checkinWindows.js`** — `GET /active` uses `CYCLE_YEAR` (module-level constant) but `activate` sets `closes_at` to `CYCLE_YEAR + 2`, which could activate a window for the wrong year if the server is long-running.

---

## Frontend

### Bugs

- **`frontend/src/pages/employee/CheckinPage.js`** — The status `<select>` for shared recipient goals is not disabled even though actual value is. A shared recipient can still change the status, which is inconsistent.
- **`frontend/src/pages/manager/Dashboard.js`** — Loads check-in data for every approved sheet with `Promise.all` on mount, making N parallel API calls. With a large team this will be slow and could hit rate limits.
- **`frontend/src/pages/admin/Dashboard.js`** — The `Completion` and `Reports` tabs auto-load on tab switch via `useEffect`, but filters are not applied on initial load for Escalations (it uses state defaults). Changing filters requires a manual "Filter" click while other tabs auto-refresh. Inconsistent UX.
- **`frontend/src/components/NotificationBell.js`** — `fetchNotifications` is called in `useEffect` with no dependency array cleanup. If the component unmounts mid-fetch, it will try to set state on an unmounted component.
- **`frontend/src/pages/admin/Dashboard.js`** — The `confirmUnlock` popup uses `z-[60]` while the sheet modal uses `z-50`. If both are open simultaneously (edge case), the sheet modal doesn't close when confirm is triggered — both remain visible.

### UX Improvements

- **`frontend/src/pages/employee/GoalSheet.js`** — The rework banner says "Please update your goals and resubmit" but doesn't show the manager's return comment. The comment is in the audit log but not surfaced here.
- **`frontend/src/pages/manager/ReviewSheet.js`** — After approving, the Approve & Return buttons remain visible briefly before the sheet reloads. No loading state on the approve button.
- **`frontend/src/pages/Login.js`** — Demo credentials are shown in plain text on the login page. Fine for a hackathon, but worth noting for production.
- **`frontend/src/components/WindowBanner.js`** — When `activeWindow === undefined` (loading), it renders nothing. A skeleton/loading state would prevent layout shift.
- **`frontend/src/pages/admin/Dashboard.js`** — The tabs bar (`flex gap-1 ... w-fit`) will overflow on small screens since all 8 tabs are in a single row with no wrapping.

### Code Quality

- **`frontend/src/pages/employee/CheckinPage.js`** and **`frontend/src/pages/manager/ManagerCheckin.js`** — The `QUARTERS` array is duplicated in both files. Should be extracted to a shared constant (e.g., `src/constants.js`).
- **`frontend/src/pages/admin/Dashboard.js`** — This file is ~600 lines. The 8 tabs should each be their own component for maintainability.
- **`frontend/src/pages/employee/CheckinPage.js`** — `computeScore` is duplicated from the backend (`achievements.js`). A single source of truth would prevent drift.

---

## Database / Migration

- **`backend/src/db/migrate.js`** — The `ALTER TABLE goal_approvals DROP CONSTRAINT ... ADD CONSTRAINT` runs every migration. This is idempotent but noisy and could fail if the DB is in an unexpected state.
- **`backend/src/db/migrate.js`** — No indexes defined. For a production system, `goal_achievements(goal_id, quarter, cycle_year)`, `goal_sheets(employee_id, cycle_year)`, and `escalations(employee_id, cycle_year)` should have indexes.
- **`backend/src/db/seed.js`** — Only 3 users seeded. For a more realistic demo, more employees under the manager would make the completion dashboard and analytics charts more meaningful.
