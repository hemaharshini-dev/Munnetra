# Goal Setting & Tracking Portal

A full-stack web application for managing employee goal creation, approval, quarterly check-ins, and performance reporting across an organisation.

Built for **ATOMQUEST Hackathon 1.0** — covers BRD sections 2.1 (Phase 1), 2.2 (Phase 2), 2.3 (Check-in Schedule), Section 3 (User Roles), Section 4 (Reporting & Governance), 5.3 (Escalation Module), and 5.4 (Analytics Module).

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [Prerequisites & Setup](#4-prerequisites--setup)
5. [Running the Application](#5-running-the-application)
6. [Demo Credentials](#6-demo-credentials)
7. [Features by Role](#7-features-by-role)
8. [API Reference](#8-api-reference)
9. [Check-in Schedule & Window Enforcement](#9-check-in-schedule--window-enforcement)
10. [Reporting & Governance](#10-reporting--governance)
11. [Escalation Module](#11-escalation-module)
12. [Analytics Module](#12-analytics-module)
13. [Validation Rules](#13-validation-rules)
14. [Component & Context Reference](#14-component--context-reference)
15. [Troubleshooting](#15-troubleshooting)
16. [Cost Optimisation](#16-cost-optimisation)
17. [Build Docs](#17-build-docs)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 3, React Router v7, Axios, Recharts |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 14+ |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Scheduling | node-cron (escalation job) |
| Dev tooling | nodemon |

---

## 2. Project Structure

```
Munnetra/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrate.js        # Creates all 10 tables
│   │   │   ├── seed.js           # Demo users, thrust areas, check-in windows
│   │   │   └── pool.js           # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js           # authenticate, requireRole, requireWindow
│   │   ├── jobs/
│   │   │   └── escalationJob.js  # Daily cron — 3 escalation rules
│   │   ├── routes/
│   │   │   ├── auth.js           # POST /login, GET /me
│   │   │   ├── goalSheets.js     # Employee goal sheet CRUD + submit
│   │   │   ├── achievements.js   # Employee achievement logging + score compute
│   │   │   ├── manager.js        # Manager approval + check-in module
│   │   │   ├── sharedGoals.js    # Push shared KPIs to employees
│   │   │   ├── admin.js          # Admin reporting, unlock, audit log, escalations
│   │   │   ├── analytics.js      # 4 analytics endpoints
│   │   │   ├── checkinWindows.js # Cycle window management
│   │   │   └── thrustAreas.js    # Thrust area list
│   │   └── index.js              # Express app entry point + starts escalation job
│   ├── .env                      # DATABASE_URL, JWT_SECRET, PORT
│   └── package.json
│
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.js         # Axios instance with JWT interceptor
│       ├── context/
│       │   ├── AuthContext.js    # Login/logout, user state
│       │   └── WindowContext.js  # Active check-in window state
│       ├── components/
│       │   ├── Navbar.js         # Role-based nav links + WindowBanner
│       │   ├── WindowBanner.js   # Active window status bar (all pages)
│       │   ├── NotificationBell.js # Admin activity feed bell
│       │   ├── GoalForm.js       # Add/edit goal modal
│       │   └── ProgressBar.js    # Color-coded score bar (red/orange/green)
│       ├── pages/
│       │   ├── Login.js
│       │   ├── employee/
│       │   │   ├── GoalSheet.js      # Create/edit/submit goal sheet
│       │   │   └── CheckinPage.js    # Log actuals, view scores per quarter
│       │   ├── manager/
│       │   │   ├── Dashboard.js      # Team sheet list + check-in completion
│       │   │   ├── ReviewSheet.js    # Inline edit + approve/return
│       │   │   └── ManagerCheckin.js # Planned vs actual + comment
│       │   └── admin/
│       │       ├── Dashboard.js      # 8-tab admin panel
│       │       └── AnalyticsTab.js   # 4 Recharts analytics panels
│       └── App.js                    # Routes + AuthProvider + WindowProvider
│
├── Build docs/
│   ├── Phase1_Plan.md
│   ├── Phase2_Plan.md
│   ├── Phase2_3_and_Roles_Plan.md
│   ├── Bonus_Features_Plan.md
│   ├── RUNNING_THE_APP.md
│   ├── User_Journey_Verification.md
│   ├── Problem_Statement.txt
│   └── Evaluation_Criteria.txt
│
├── .gitignore
└── README.md
```

---

## 3. Database Schema

### Tables (10 total)

**users**
```
id, name, email, password_hash, role (employee|manager|admin),
manager_id (FK → users), department, created_at
```

**thrust_areas**
```
id, name, description
```

**goal_sheets**
```
id, employee_id (FK → users), cycle_year, status (draft|submitted|approved|rework),
submitted_at, approved_at, approved_by (FK → users)
UNIQUE(employee_id, cycle_year)
```

**goals**
```
id, goal_sheet_id (FK → goal_sheets), thrust_area_id (FK → thrust_areas),
title, description, uom_type (numeric_min|numeric_max|timeline|zero),
target_value, target_date, weightage (≥10, ≤100),
is_shared, shared_from_goal_id (FK → goals), is_locked,
created_at, updated_at
```

**goal_achievements**
```
id, goal_id (FK → goals), quarter (Q1|Q2|Q3|Q4), cycle_year,
actual_value, actual_date, status (not_started|on_track|completed),
progress_score (0.0–1.0), updated_at
UNIQUE(goal_id, quarter, cycle_year)
```

**manager_checkins**
```
id, goal_sheet_id (FK → goal_sheets), manager_id (FK → users),
quarter, cycle_year, comment, created_at
UNIQUE(goal_sheet_id, quarter, cycle_year)
```

**goal_approvals** *(audit trail)*
```
id, goal_sheet_id (FK → goal_sheets),
action (approved|returned|edited|unlocked|checkin|achievement_updated),
actor_id (FK → users), comment, changed_fields (JSONB), timestamp
```

**shared_goal_assignments**
```
id, source_goal_id (FK → goals), assigned_to (FK → users),
employee_goal_id (FK → goals), weightage_override
```

**check_in_windows**
```
id, period (goal_setting|Q1|Q2|Q3|Q4), label, opens_at, closes_at,
cycle_year, action (goal_setting|checkin)
UNIQUE(period, cycle_year)
```

**escalations**
```
id, type (goal_not_submitted|approval_overdue|checkin_overdue),
employee_id (FK → users), manager_id (FK → users),
goal_sheet_id (FK → goal_sheets), quarter, cycle_year,
level (1|2|3), message, resolved (bool), created_at
```

---

## 4. Prerequisites & Setup

### Requirements
- Node.js v18+
- PostgreSQL v14+

### 1. Create the database
```bash
psql -U postgres -c "CREATE DATABASE goal_tracker;"
```

### 2. Configure backend environment
Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/goal_tracker
JWT_SECRET=any_long_random_string
```

### 3. Install dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run migrations (creates all 10 tables)
```bash
cd backend
npm run migrate
```

### 5. Seed demo data
```bash
npm run seed
```

Seed inserts:
- 3 demo users (employee, manager, admin)
- 7 thrust areas
- 5 check-in windows for the current cycle year (Q1 set as active for demo)

---

## 5. Running the Application

Two terminals required simultaneously:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
# Escalation job scheduled — runs daily at 9:00 AM
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

---

## 6. Demo Credentials

| Role | Email | Password | Landing Page |
|---|---|---|---|
| Employee | employee@demo.com | demo1234 | `/employee` |
| Manager | manager@demo.com | demo1234 | `/manager` |
| Admin | admin@demo.com | demo1234 | `/admin` |

---

## 7. Features by Role

### Employee (`/employee`, `/employee/checkin`)

**Goal Sheet (`/employee`)**
- Create a goal sheet for the current cycle year (one per cycle)
- Add up to 8 goals per sheet with Thrust Area, Title, Description, UoM, Target, Weightage
- Live weightage counter — turns green at 100%, red otherwise
- Edit and delete goals while sheet is in `draft` or `rework` status
- Submit for manager approval (blocked if total weightage ≠ 100%)
- View shared goals — title and target are read-only, only weightage is editable
- Locked goals shown with 🔒 icon — fields disabled
- All write actions blocked outside the Goal Setting window (May–Jun)

**Check-in (`/employee/checkin`)**
- View all approved goals for the current cycle
- Log actual achievement per goal per quarter (Q1–Q4)
- Quarter tabs: `Q1 (Jul–Sep)`, `Q2 (Oct–Dec)`, `Q3 (Jan–Feb)`, `Q4 (Mar–Apr)`
- Active quarter banner with calendar icon and date range
- Input types adapt to UoM: number field for numeric/zero, date picker for timeline
- Status dropdown per goal: Not Started / On Track / Completed
- Live progress score bar (red < 40%, orange 40–70%, green > 70%)
- Re-save within the same open window (upsert)
- Shared goal actual value is read-only — synced from source owner
- All inputs disabled outside a check-in window

---

### Manager (`/manager`, `/manager/review/:id`, `/manager/checkin/:sheetId`)

**Team Dashboard (`/manager`)**
- View all team members' goal sheets with status badges
- Check-in completion badges per quarter (Q1–Q4) for approved sheets
- Two action buttons per row: `Review →` and `Check-in →`

**Goal Sheet Review (`/manager/review/:id`)**
- Inline edit target value/date and weightage per goal before approval
- Approve sheet — locks all goals, logs to audit trail
- Return for rework — requires a comment
- All approval actions blocked outside the Goal Setting window

**Check-in Review (`/manager/checkin/:sheetId`)**
- Quarter selector tabs with ✓ indicator for completed quarters
- Per goal: Planned Target vs Actual Achievement side by side
- Progress score bar per goal
- Submit structured check-in comment (required, cannot be empty)
- Past quarters shown as read-only with saved comment
- Submit blocked outside a check-in window

---

### Admin (`/admin`)

Eight-tab dashboard:

**Sheets** — view all sheets, filter by status/department, unlock locked goals with confirmation popup

**Shared Goals** — push departmental KPIs to multiple employees at once

**Audit Log** — full history of all actions with color-coded badges (approved, returned, edited, unlocked, checkin, achievement_updated)

**Completion** — real-time grid showing employee + manager check-in completion per quarter

**Reports** — achievement report table with CSV export (`achievement_report_YYYY.csv`)

**Escalations** — view all escalation records, filter by type/status/department, mark resolved

**Analytics** — 4 interactive charts (QoQ trends, completion rates, goal distribution, manager effectiveness)

**Cycle Windows** — edit open/close dates, Set Active Now shortcut for demo

---

## 8. API Reference

> **Post-build bug fixes applied:**
> - **Shared goal sync** (`sharedGoals.js`, `achievements.js`): Previously every recipient goal was its own source (`source_goal_id = employee_goal_id`, `is_shared=TRUE`), so actual-value sync never fired. Fixed by creating one canonical source goal (`is_shared=FALSE`) owned by the pusher; recipient copies point to it via `shared_from_goal_id`. Sync in `achievements.js` now correctly propagates actuals to all recipients.
> - **Stale cycle year in escalation job** (`escalationJob.js`): `CYCLE_YEAR` was a module-level constant, causing wrong year if the server ran across a year boundary. Moved inside `runEscalations()` so it is computed fresh on every daily run.
> - **Employee calling admin-only audit log** (`goalSheets.js`, `GoalSheet.js`): The rework-comment fetch was hitting `GET /api/admin/audit-log`, which returns 403 for employees. Added a dedicated `GET /api/goal-sheets/:id/rework-comment` endpoint (employee-accessible) and updated the frontend to use it.

### Auth
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Returns JWT token |
| GET | `/api/auth/me` | Any | Current user profile |

### Thrust Areas
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/thrust-areas` | Any | List all thrust areas |

### Goal Sheets (Employee)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/goal-sheets/mine` | Employee | Own sheet with goals |
| POST | `/api/goal-sheets` | Employee | Create new sheet (goal_setting window required) |
| POST | `/api/goal-sheets/:id/submit` | Employee | Submit for approval (goal_setting window required) |
| GET | `/api/goal-sheets/:id/rework-comment` | Employee | Latest manager return comment for own sheet |
| POST | `/api/goal-sheets/:sheetId/goals` | Employee | Add goal to sheet |
| PUT | `/api/goal-sheets/goals/:id` | Employee | Edit own goal |
| DELETE | `/api/goal-sheets/goals/:id` | Employee | Delete own goal |

### Achievements (Employee)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/achievements/mine` | Employee | All goals with achievements for all quarters |
| POST | `/api/achievements` | Employee | Upsert achievement + compute score (checkin window required) |

### Manager
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/manager/team-sheets` | Manager | All team members' sheets |
| GET | `/api/manager/team-sheets/:id` | Manager | Sheet with goals |
| PUT | `/api/manager/goals/:id` | Manager | Inline edit goal before approval |
| POST | `/api/manager/team-sheets/:id/approve` | Manager | Approve + lock goals (goal_setting window required) |
| POST | `/api/manager/team-sheets/:id/return` | Manager | Return for rework (goal_setting window required) |
| GET | `/api/manager/checkins/:sheetId?quarter=Q1` | Manager | Goals + achievements + check-in comment |
| POST | `/api/manager/checkins` | Manager | Submit check-in comment (checkin window required) |

### Shared Goals
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/shared-goals` | Admin/Manager | Push KPI to multiple employees |
| GET | `/api/shared-goals/mine` | Employee | Own shared goals |
| PUT | `/api/shared-goals/:id/weightage` | Employee | Update weightage on shared goal |

### Admin
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/goal-sheets` | Admin | All sheets with filters |
| GET | `/api/admin/goal-sheets/:id` | Admin | Sheet with goals and IDs |
| POST | `/api/admin/goals/:id/unlock` | Admin | Unlock a locked goal |
| GET | `/api/admin/audit-log` | Admin | Full audit trail (last 500) |
| GET | `/api/admin/employees` | Admin/Manager | All employees list |
| GET | `/api/admin/achievement-report` | Admin | Planned vs actual all quarters |
| GET | `/api/admin/completion-dashboard` | Admin | Check-in completion per employee |
| GET | `/api/admin/escalations` | Admin | All escalations with filters |
| PUT | `/api/admin/escalations/:id/resolve` | Admin | Mark escalation as resolved |

### Analytics
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/analytics/qoq-trends` | Admin | Avg score per quarter per department |
| GET | `/api/admin/analytics/completion-rates` | Admin | Employee + manager completion % per quarter |
| GET | `/api/admin/analytics/goal-distribution` | Admin | Goals by thrust area, UoM type, status |
| GET | `/api/admin/analytics/manager-effectiveness` | Admin | Check-in completion rate per manager |

### Check-in Windows
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/checkin-windows/active` | Any | Currently open window |
| GET | `/api/checkin-windows` | Admin | All windows for current cycle |
| PUT | `/api/checkin-windows/:id` | Admin | Update window dates |
| PUT | `/api/checkin-windows/:id/activate` | Admin | Set window as active now |

---

## 9. Check-in Schedule & Window Enforcement

Actions outside their window are blocked at the backend with a `403` response.

| Period | Opens | Closes | Actions Permitted |
|---|---|---|---|
| Goal Setting | 1 May | 30 Jun | Create sheet, submit, approve, return |
| Q1 Check-in | 1 Jul | 30 Sep | Log achievements, submit manager check-in |
| Q2 Check-in | 1 Oct | 31 Dec | Log achievements, submit manager check-in |
| Q3 Check-in | 1 Jan | 28 Feb | Log achievements, submit manager check-in |
| Q4 / Annual | 1 Mar | 30 Apr | Final achievement capture + manager check-in |

**Demo note:** Seed sets Q1 `opens_at = yesterday` and `closes_at = far future` so check-in is immediately demonstrable. Admin can change dates via the Cycle Windows tab.

**WindowBanner** — shown below the navbar on every page:
- Blue — active check-in window
- Green — active goal setting window
- Orange — window closing within 7 days
- Gray — no active window

---

## 10. Reporting & Governance

### Achievement Report
- `GET /api/admin/achievement-report?department=X&cycle_year=2025`
- Planned target vs actual for all employees, all 4 quarters
- Exportable as CSV — `achievement_report_YYYY.csv`

### Completion Dashboard
- `GET /api/admin/completion-dashboard?department=X`
- Real-time grid: employee done = achievement logged, manager done = check-in submitted

### Audit Trail
| Action | Triggered By |
|---|---|
| `approved` | Manager approves a goal sheet |
| `returned` | Manager returns sheet for rework |
| `edited` | Manager edits a goal before approval |
| `unlocked` | Admin unlocks a locked goal |
| `checkin` | Manager submits a quarterly check-in comment |
| `achievement_updated` | Employee re-saves an existing achievement (before/after diff stored) |

---

## 11. Escalation Module

A daily cron job (runs at 9:00 AM) evaluates 3 rules and inserts records into the `escalations` table. No emails — all escalations are visible in the Admin Dashboard → Escalations tab.

### Rules

| Rule | Trigger | Levels |
|---|---|---|
| Goal Not Submitted | Employee has no submitted sheet N days after goal-setting window opens | L1 → employee notified, L2 → manager notified, L3 → admin notified |
| Approval Overdue | Sheet submitted but not approved within N days | L1 → manager notified, L2 → admin notified |
| Check-in Overdue | No achievements logged within N days before check-in window closes | L1 → employee notified, L2 → manager notified |

### Configurable thresholds (in `escalationJob.js`)
```js
goal_not_submitted_days: 7
approval_overdue_days:   3
checkin_overdue_days:    7
level2_after_days:       3
level3_after_days:       3
```

### Admin Escalations Tab
- Filter by type, resolved status, department
- Color-coded badges: red (goal not submitted), orange (approval overdue), yellow (check-in overdue)
- Level labels: L1 Employee / L2 Manager / L3 Admin
- Mark Resolved button per row

---

## 12. Analytics Module

Four interactive charts in the Admin Dashboard → Analytics tab, powered by Recharts.

| Chart | Type | What It Shows |
|---|---|---|
| QoQ Achievement Trend | Line chart | Avg progress score per quarter per department |
| Check-in Completion Rates | Grouped bar chart | Employee vs manager completion % per quarter |
| Goal Distribution | Bar + 2 pie charts | Goals by thrust area, UoM type, achievement status |
| Manager Effectiveness | Horizontal bar chart | Check-in completion rate per manager (green/orange/red) |

All charts support cycle year filtering and a Refresh button.

---

## 13. Validation Rules

All rules enforced at the backend — frontend provides UX feedback but cannot bypass them.

| Rule | Endpoint |
|---|---|
| Total weightage must equal 100% on submit | `POST /goal-sheets/:id/submit` |
| Total weightage must equal 100% on approve | `POST /manager/team-sheets/:id/approve` |
| Minimum weightage per goal: 10% | `POST /goal-sheets/:sheetId/goals`, `PUT /goal-sheets/goals/:id` |
| Maximum 8 goals per employee per cycle | `POST /goal-sheets/:sheetId/goals` |
| Shared goal: title and target read-only for recipients | `PUT /goal-sheets/goals/:id` |
| Locked goals cannot be edited without Admin unlock | `PUT /goal-sheets/goals/:id` |
| Goal creation/submission only during goal_setting window | `POST /goal-sheets`, `POST /goal-sheets/:id/submit` |
| Achievement logging only during checkin window | `POST /achievements` |
| Manager approval/return only during goal_setting window | `POST /manager/team-sheets/:id/approve`, `/return` |
| Manager check-in only during checkin window | `POST /manager/checkins` |
| Manager check-in comment cannot be empty | `POST /manager/checkins` |
| Shared goal recipient cannot change actual value | `POST /achievements` |

---

## 14. Component & Context Reference

### Contexts

**AuthContext** (`src/context/AuthContext.js`)
- `user` — `{ id, name, email, role, department }`
- `login(email, password)` — authenticates, stores JWT in localStorage
- `logout()` — clears localStorage and user state

**WindowContext** (`src/context/WindowContext.js`)
- `activeWindow` — current open window object or `null`
- `refresh()` — re-fetches active window (called after admin updates dates)

### Components

**Navbar** — role-based nav links + WindowBanner below
- Employee: My Goals | Check-in
- Manager: Team Goals
- Admin: notification bell

**WindowBanner** — color-coded bar showing active window name and dates

**NotificationBell** — admin-only; fetches audit log, tracks unread via `localStorage`, dropdown with color-coded action feed

**GoalForm** — modal for add/edit goal; UoM-aware (date picker for timeline, number for others)

**ProgressBar** — `score` prop (0.0–1.0); colored bar + percentage
- < 40% → red · 40–70% → orange · > 70% → green

**AnalyticsTab** — 4 Recharts panels with cycle year filter and refresh

---

## 15. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on backend start | PostgreSQL is not running. Start the service. |
| `database "goal_tracker" does not exist` | Run `psql -U postgres -c "CREATE DATABASE goal_tracker;"` |
| `Migration complete` but tables missing | Check `DATABASE_URL` in `.env` — wrong DB name or password |
| Login returns "Invalid credentials" | Run `npm run seed` from the `backend/` folder |
| Submit button stays disabled | Total weightage must equal exactly 100% |
| Check-in inputs are disabled | No active check-in window. Admin → Cycle Windows → Set Active Now on Q1 |
| Goal creation is disabled | No active goal setting window. Admin → Cycle Windows → Set Active Now on Goal Setting |
| Port 5000 already in use | Change `PORT` in `.env` and update `frontend/src/api/client.js` baseURL |
| `npm install` fails | Delete `node_modules/` and `package-lock.json`, then retry |
| Shared goal actual is read-only | Expected — actual value syncs from the source goal owner only |
| Rework comment not showing on employee goal sheet | Ensure you are running the latest backend — the fix replaced the admin audit-log call with `GET /api/goal-sheets/:id/rework-comment` |
| Shared goal actuals not syncing to recipients | Ensure you re-seeded or re-pushed shared goals after the fix — old shared goals created before the fix have incorrect `source_goal_id` values |
| Unlock button shows confirmation popup | By design — all unlocks require confirmation and are logged |
| Analytics charts show no data | Log some achievements first, then click Refresh on the Analytics tab |
| No escalations showing | Escalation job runs at 9 AM daily. Trigger manually via the API or wait for the next run |

---

## 16. Cost Optimisation

This section documents every architectural and implementation decision made to keep the solution efficient, low-cost, and scalable.

### Infrastructure Choices

| Decision | Rationale |
|---|---|
| Node.js + Express (single process) | Lightweight runtime with low memory footprint; no JVM or heavy framework overhead |
| PostgreSQL (single instance) | One relational DB covers all data needs — no separate cache store, message queue, or search index required at this scale |
| React SPA (static build) | Entire frontend is a static bundle — can be served from S3 + CloudFront at near-zero cost; no server-side rendering infrastructure needed |
| JWT (stateless auth) | No session store required — tokens are verified in-process with no DB or Redis lookup on every request |
| node-cron (in-process scheduler) | Escalation job runs inside the Express process — no separate worker, Lambda, or queue service needed |
| Recharts (client-side charting) | All chart rendering happens in the browser — no server-side image generation or third-party chart API calls |

---

### API Call Efficiency

| Pattern | Implementation |
|---|---|
| Aggregated goal sheet query | `GET /goal-sheets/mine` returns the sheet and all goals in a single query using `json_agg` — no separate goals fetch needed |
| Aggregated achievements query | `GET /achievements/mine` returns all goals with all quarters' achievements in one query using `json_agg` — no per-goal or per-quarter requests |
| Aggregated manager check-in query | `GET /manager/checkins/:sheetId` returns goals, achievements, and all check-in comments for the sheet in one round trip |
| Achievement report as single query | `GET /admin/achievement-report` uses four lateral joins (one per quarter) to return all Q1–Q4 data in a single SQL query instead of four separate requests |
| Analytics: parallel fetch | `AnalyticsTab` fires all 4 analytics endpoints simultaneously with `Promise.all` — total load time equals the slowest query, not the sum |
| Analytics: fetch-on-refresh only | The cycle year input is decoupled from the fetch trigger — data only reloads when the Refresh button is clicked, not on every keystroke |
| Admin tab lazy loading | Each admin tab (Audit Log, Completion, Reports, Escalations, Cycle Windows) fetches data only when that tab is first opened — no upfront bulk load |
| Shared goal push: single transaction | All recipient goal inserts and assignment records are wrapped in a single `BEGIN/COMMIT` transaction — one round trip to the DB regardless of recipient count |

---

### Database Efficiency

| Decision | Rationale |
|---|---|
| `UNIQUE` constraints as natural deduplication | `UNIQUE(employee_id, cycle_year)` on `goal_sheets`, `UNIQUE(goal_id, quarter, cycle_year)` on `goal_achievements`, and `UNIQUE(goal_sheet_id, quarter, cycle_year)` on `manager_checkins` allow `ON CONFLICT DO UPDATE` upserts — no separate SELECT + INSERT/UPDATE round trips |
| Progress score stored on save | `progress_score` is computed once at write time and stored in `goal_achievements` — analytics and reports read the stored value directly with no recomputation |
| `json_agg` in SQL | Nested data (goals inside sheets, achievements inside goals) is assembled in the DB layer rather than making multiple queries and joining in application code |
| `JSONB` for audit diff | `changed_fields` in `goal_approvals` uses JSONB — flexible schema for before/after diffs without extra audit detail tables |
| `CREATE TABLE IF NOT EXISTS` migrations | Non-destructive migrations mean re-running `npm run migrate` is safe — no teardown/rebuild cost in CI or demo resets |

---

### Hosting Cost Awareness

For a production deployment on AWS, the recommended low-cost architecture is:

| Component | AWS Service | Estimated Cost |
|---|---|---|
| Backend API | EC2 t3.micro or Elastic Beanstalk (single instance) | ~$8–10/month |
| Database | RDS PostgreSQL db.t3.micro (single-AZ) | ~$15/month |
| Frontend | S3 static hosting + CloudFront CDN | ~$1–2/month |
| Escalation job | Runs inside the Express process — no Lambda or EventBridge needed | $0 extra |
| **Total** | | **~$25/month** |

For a hackathon demo, the entire stack runs locally at zero cost.

---

## 17. Build Docs

All planning, setup, and verification documents are in the `Build docs/` folder:

| File | Purpose |
|---|---|
| `RUNNING_THE_APP.md` | Detailed step-by-step setup guide |
| `User_Journey_Verification.md` | Step-by-step guide to verify every BRD requirement (sections 1–4) |
| `Phase1_Plan.md` | Build plan for BRD 2.1 — Goal Creation & Approval |
| `Phase2_Plan.md` | Build plan for BRD 2.2 — Achievement Tracking & Check-ins |
| `Phase2_3_and_Roles_Plan.md` | Build plan for BRD 2.3 (Check-in Schedule) + Section 3 (User Roles) |
| `Bonus_Features_Plan.md` | Build plan for BRD 5.3 (Escalation) + 5.4 (Analytics) |
| `Problem_Statement.txt` | Original ATOMQUEST Hackathon 1.0 problem statement |
| `Evaluation_Criteria.txt` | Hackathon evaluation parameters and scoring criteria |
