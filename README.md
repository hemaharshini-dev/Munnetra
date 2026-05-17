# Goal Setting & Tracking Portal

A full-stack web application for managing employee goal creation, approval, quarterly check-ins, and performance reporting across an organisation.

Built for **ATOMQUEST Hackathon 1.0** — covers BRD sections 2.1 (Phase 1), 2.2 (Phase 2), 2.3 (Check-in Schedule), Section 3 (User Roles), and Section 4 (Reporting & Governance).

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
11. [Validation Rules](#11-validation-rules)
12. [Component & Context Reference](#12-component--context-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Build Docs](#14-build-docs)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 3, React Router v7, Axios |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 14+ |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Dev tooling | nodemon |

---

## 2. Project Structure

```
Munnetra/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrate.js        # Creates all 9 tables
│   │   │   ├── seed.js           # Demo users, thrust areas, check-in windows
│   │   │   └── pool.js           # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js           # authenticate, requireRole, requireWindow
│   │   ├── routes/
│   │   │   ├── auth.js           # POST /login, GET /me
│   │   │   ├── goalSheets.js     # Employee goal sheet CRUD + submit
│   │   │   ├── achievements.js   # Employee achievement logging + score compute
│   │   │   ├── manager.js        # Manager approval + check-in module
│   │   │   ├── sharedGoals.js    # Push shared KPIs to employees
│   │   │   ├── admin.js          # Admin reporting, unlock, audit log
│   │   │   ├── checkinWindows.js # Cycle window management
│   │   │   └── thrustAreas.js    # Thrust area list
│   │   └── index.js              # Express app entry point
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
│       │   │   ├── GoalSheet.js  # Create/edit/submit goal sheet
│       │   │   └── CheckinPage.js # Log actuals, view scores per quarter
│       │   ├── manager/
│       │   │   ├── Dashboard.js  # Team sheet list + check-in completion
│       │   │   ├── ReviewSheet.js # Inline edit + approve/return
│       │   │   └── ManagerCheckin.js # Planned vs actual + comment
│       │   └── admin/
│       │       └── Dashboard.js  # 6-tab admin panel
│       └── App.js                # Routes + AuthProvider + WindowProvider
│
├── Build docs/
│   ├── Phase1_Plan.md            # Phase 1 build plan
│   ├── Phase2_Plan.md            # Phase 2.2 build plan
│   ├── Phase2_3_and_Roles_Plan.md # 2.3 + Section 3 build plan
│   ├── RUNNING_THE_APP.md        # Detailed setup guide
│   ├── User_Journey_Verification.md # Step-by-step BRD verification guide
│   ├── Problem_Statement.txt     # Original hackathon problem statement
│   └── Evaluation_Criteria.txt   # Hackathon evaluation parameters
│
├── .gitignore
└── README.md                     # This file
```

---

## 3. Database Schema

### Tables

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

### 4. Run migrations (creates all 9 tables)
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
- Add up to 8 goals per sheet with:
  - Thrust Area, Title, Description
  - Unit of Measurement: Numeric Min, Numeric Max, Timeline, Zero-based
  - Target Value or Target Date
  - Weightage (minimum 10% per goal)
- Live weightage counter — turns green at 100%, red otherwise
- Edit and delete goals while sheet is in `draft` or `rework` status
- Submit for manager approval (blocked if total weightage ≠ 100%)
- View shared goals — title and target are read-only, only weightage is editable
- Locked goals shown with 🔒 icon — fields disabled
- All write actions blocked outside the Goal Setting window (May–Jun)

**Check-in (`/employee/checkin`)**
- View all approved goals for the current cycle
- Log actual achievement per goal per quarter (Q1–Q4)
- Quarter tabs labelled with month ranges: `Q1 (Jul–Sep)`, `Q2 (Oct–Dec)`, `Q3 (Jan–Feb)`, `Q4 (Mar–Apr)`
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
- View submitted sheet with all goals
- Inline edit target value/date and weightage per goal before approval
- Approve sheet — locks all goals, logs to audit trail
- Return for rework — requires a comment, sheet goes back to employee
- Live weightage counter shown during review
- All approval actions blocked outside the Goal Setting window

**Check-in Review (`/manager/checkin/:sheetId`)**
- Quarter selector tabs with ✓ indicator for completed quarters
- Per goal: Planned Target vs Actual Achievement side by side
- Progress score bar per goal
- Submit structured check-in comment (required, cannot be empty)
- Update existing comment within the same window
- Past quarters shown as read-only with saved comment
- Submit blocked outside a check-in window

---

### Admin (`/admin`)

Six-tab dashboard:

**Sheets**
- View all goal sheets across the organisation
- Filter by status and department
- Click any row to open a goal detail modal showing all goals with their IDs
- Unlock locked goals directly from the modal with a reason (confirmation popup required)
- Manual unlock by Goal ID as fallback
- Unlock action logged to audit trail

**Shared Goals**
- Push a departmental KPI to multiple employees at once
- Select thrust area, title, UoM, target, weightage
- Select recipient employees via checkboxes
- Recipients get the goal on their sheet — title and target are read-only for them

**Audit Log**
- Full history of all actions: approved, returned, edited, unlocked, checkin, achievement_updated
- Color-coded badges per action type
- Shows actor name, sheet ID, comment, and timestamp
- Notification bell in navbar shows unread count with live feed dropdown

**Completion**
- Real-time grid: Employee | Manager | Dept | Q1 Emp | Q1 Mgr | Q2 Emp | Q2 Mgr | Q3 | Q4
- ✓ = completed, — = not yet done
- Filter by department

**Reports**
- Achievement report: Employee | Goal | Thrust Area | UoM | Target | Q1–Q4 Actual + Score%
- Filter by department and cycle year
- Export to CSV button — downloads `achievement_report_YYYY.csv`
- Scores color-coded green/orange/red inline

**Cycle Windows**
- View all 5 check-in windows for the current cycle year
- Edit open/close dates inline with date pickers
- Active window highlighted in blue
- "Set Active Now" button — opens a window immediately (demo shortcut)
- Changes reflected instantly in the WindowBanner across all pages

---

## 8. API Reference

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

### Check-in Windows
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/checkin-windows/active` | Any | Currently open window |
| GET | `/api/checkin-windows` | Admin | All windows for current cycle |
| PUT | `/api/checkin-windows/:id` | Admin | Update window dates |
| PUT | `/api/checkin-windows/:id/activate` | Admin | Set window as active now |

---

## 9. Check-in Schedule & Window Enforcement

The portal enforces the following calendar windows. Actions outside their window are blocked at the backend with a `403` response.

| Period | Opens | Closes | Actions Permitted |
|---|---|---|---|
| Goal Setting | 1 May | 30 Jun | Create sheet, submit, approve, return |
| Q1 Check-in | 1 Jul | 30 Sep | Log achievements, submit manager check-in |
| Q2 Check-in | 1 Oct | 31 Dec | Log achievements, submit manager check-in |
| Q3 Check-in | 1 Jan | 28 Feb | Log achievements, submit manager check-in |
| Q4 / Annual | 1 Mar | 30 Apr | Final achievement capture + manager check-in |

**Demo note:** The seed script sets Q1 `opens_at = yesterday` and `closes_at = far future` so the check-in flow is immediately demonstrable. Admin can change window dates via the Cycle Windows tab.

**WindowBanner** — shown below the navbar on every page for all roles:
- Blue — active check-in window
- Green — active goal setting window
- Orange — window closing within 7 days
- Gray — no active window (between cycles)

---

## 10. Reporting & Governance

### Achievement Report
- Endpoint: `GET /api/admin/achievement-report?department=X&cycle_year=2025`
- Shows every employee's planned target vs actual achievement for all 4 quarters
- Exportable as CSV from the Admin Dashboard → Reports tab
- Filename: `achievement_report_YYYY.csv`

### Completion Dashboard
- Endpoint: `GET /api/admin/completion-dashboard?department=X`
- Real-time grid showing which employees and managers have completed each quarterly check-in
- Employee done = at least one achievement logged that quarter
- Manager done = check-in comment submitted that quarter

### Audit Trail
Every significant action is logged to `goal_approvals`:

| Action | Triggered By |
|---|---|
| `approved` | Manager approves a goal sheet |
| `returned` | Manager returns sheet for rework |
| `edited` | Manager edits a goal before approval |
| `unlocked` | Admin unlocks a locked goal |
| `checkin` | Manager submits a quarterly check-in comment |
| `achievement_updated` | Employee re-saves an existing achievement (before/after diff stored) |

---

## 11. Validation Rules

All rules are enforced at the backend — frontend provides UX feedback but cannot bypass them.

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

## 12. Component & Context Reference

### Contexts

**AuthContext** (`src/context/AuthContext.js`)
- `user` — current logged-in user object `{ id, name, email, role, department }`
- `login(email, password)` — authenticates and stores JWT in localStorage
- `logout()` — clears localStorage and user state

**WindowContext** (`src/context/WindowContext.js`)
- `activeWindow` — current open window object or `null` if between cycles
- `refresh()` — re-fetches active window (called after admin updates window dates)

### Components

**Navbar** — role-based nav links + WindowBanner below
- Employee: My Goals | Check-in
- Manager: Team Goals
- Admin: notification bell

**WindowBanner** — color-coded bar showing active window name and dates

**NotificationBell** — admin-only; fetches audit log, tracks unread via `localStorage`, dropdown with color-coded action feed

**GoalForm** — modal for add/edit goal with all fields; UoM-aware (shows date picker for timeline, number for others)

**ProgressBar** — `score` prop (0.0–1.0); renders colored bar + percentage
- < 40% → red
- 40–70% → orange
- > 70% → green

---

## 13. Troubleshooting

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
| Unlock button shows confirmation popup | By design — all unlocks require confirmation and are logged to audit trail |

---

## 14. Build Docs

All planning, setup, and verification documents are in the `Build docs/` folder:

| File | Purpose |
|---|---|
| `RUNNING_THE_APP.md` | Detailed step-by-step setup guide with screenshots and troubleshooting |
| `User_Journey_Verification.md` | Step-by-step guide to verify every BRD requirement (sections 1–4) is working |
| `Phase1_Plan.md` | Detailed build plan for BRD 2.1 — Goal Creation & Approval |
| `Phase2_Plan.md` | Detailed build plan for BRD 2.2 — Achievement Tracking & Check-ins |
| `Phase2_3_and_Roles_Plan.md` | Detailed build plan for BRD 2.3 (Check-in Schedule) + Section 3 (User Roles) |
| `Problem_Statement.txt` | Original ATOMQUEST Hackathon 1.0 problem statement |
| `Evaluation_Criteria.txt` | Hackathon evaluation parameters and scoring criteria |
