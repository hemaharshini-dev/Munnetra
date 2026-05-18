# Plan: Good-to-Have Features — 5.3 & 5.4

Covers BRD sections 5.3 (Escalation Module) and 5.4 (Analytics Module).
Both are fully implementable with zero external dependencies using the current stack.

---

## Section 5.3 — Escalation Module (Rule-Based)

---

### What the BRD Requires
- Configurable escalation rules triggered by:
  - Employee has not submitted goals within N days of cycle open
  - Manager has not approved goals within N days of submission
  - Quarterly check-in not completed within the active window
- Escalation chain: employee → manager → skip-level / HR after defined intervals
- Escalation log visible to Admin / HR for tracking and resolution

---

### New Database Table — `escalations`

```
id             SERIAL PRIMARY KEY
type           VARCHAR(30)   CHECK IN ('goal_not_submitted','approval_overdue','checkin_overdue')
employee_id    INTEGER NOT NULL  FK → users
manager_id     INTEGER           FK → users
goal_sheet_id  INTEGER           FK → goal_sheets (nullable)
quarter        VARCHAR(5)        -- Q1/Q2/Q3/Q4, only for checkin_overdue
cycle_year     INTEGER NOT NULL
level          INTEGER NOT NULL  -- 1 = notified employee, 2 = notified manager, 3 = notified admin
message        TEXT
resolved       BOOLEAN DEFAULT FALSE
created_at     TIMESTAMPTZ DEFAULT NOW()
```

Added to `migrate.js` as `CREATE TABLE IF NOT EXISTS` — non-destructive.

---

### Escalation Rules Configuration

Stored as constants at the top of `escalationJob.js` — admin can change values and restart:

```js
const RULES = {
  goal_not_submitted_days: 7,  // days after goal_setting window opens before escalating
  approval_overdue_days:   3,  // days after sheet submitted before escalating
  checkin_overdue_days:    7,  // days before window closes before escalating
  level2_after_days:       3,  // days after level 1 before escalating to manager
  level3_after_days:       3,  // days after level 2 before escalating to admin
};
```

---

### Escalation Logic (Daily Cron Job — runs at 9:00 AM)

New file: `backend/src/jobs/escalationJob.js`

**Rule 1 — Goal Not Submitted**
```
IF goal_setting window is currently open
AND employee has no goal_sheet OR sheet status is 'draft'
AND (TODAY - window.opens_at) >= goal_not_submitted_days
THEN check existing escalation level for this employee + cycle:
  No record     → INSERT level 1 escalation
  Level 1 exists AND (TODAY - level1.created_at) >= level2_after_days → INSERT level 2
  Level 2 exists AND (TODAY - level2.created_at) >= level3_after_days → INSERT level 3
```

**Rule 2 — Approval Overdue**
```
IF sheet status = 'submitted'
AND (TODAY - sheet.submitted_at) >= approval_overdue_days
THEN check existing escalation level for this sheet:
  No record     → INSERT level 1 escalation
  Level 1 exists AND (TODAY - level1.created_at) >= level2_after_days → INSERT level 2
```

**Rule 3 — Check-in Overdue**
```
IF a checkin window is currently open
AND employee has an approved sheet
AND no goal_achievements exist for this employee + current quarter
AND (window.closes_at - TODAY) <= checkin_overdue_days
THEN check existing escalation level for this employee + quarter:
  No record     → INSERT level 1 escalation
  Level 1 exists AND (TODAY - level1.created_at) >= level2_after_days → INSERT level 2
```

Each INSERT also logs a human-readable `message` field, e.g.:
- Level 1: "Employee has not submitted goals 7 days after the Goal Setting window opened."
- Level 2: "Manager notified — employee still has not submitted goals after 10 days."
- Level 3: "Admin notified — goals still not submitted after 13 days."

---

### New API Endpoints (added to `admin.js`)

```
GET  /api/admin/escalations
     query: ?type=goal_not_submitted&resolved=false&department=Engineering
     → returns escalations joined with employee name, manager name, department

PUT  /api/admin/escalations/:id/resolve
     → sets resolved=TRUE, records who resolved it and when
```

---

### Admin Dashboard — New "Escalations" Tab

Table with columns:
- Employee (name + email)
- Manager
- Department
- Type — color-coded badge:
  - Red: `goal_not_submitted`
  - Orange: `approval_overdue`
  - Yellow: `checkin_overdue`
- Level — `L1 Employee` / `L2 Manager` / `L3 Admin`
- Quarter (for check-in escalations)
- Message
- Created date
- Status — ✓ Resolved / Pending
- "Mark Resolved" button (only shown for unresolved rows)

Filter controls: Type dropdown, Resolved toggle, Department input.

---

### New Files

| File | Purpose |
|---|---|
| `backend/src/jobs/escalationJob.js` | Daily cron — evaluates all 3 rules, inserts escalation records |

### Modified Files

| File | Change |
|---|---|
| `backend/src/db/migrate.js` | Add `escalations` table |
| `backend/src/routes/admin.js` | Add GET /escalations + PUT /escalations/:id/resolve |
| `backend/src/index.js` | Import and start escalationJob on server start |
| `frontend/src/pages/admin/Dashboard.js` | Add "Escalations" tab |

---

---

## Section 5.4 — Analytics Module

---

### What the BRD Requires
- Quarter-on-Quarter (QoQ) goal achievement trends at individual, team, and department levels
- Heatmaps or progress charts showing completion rates across the organisation
- Goal distribution analysis — breakdown by Thrust Area, UoM type, and status
- Manager effectiveness dashboard — comparison of check-in completion rates across L1 managers

---

### New Frontend Dependency

```bash
cd frontend
npm install recharts
```

Recharts is a free React charting library. No account, no API key, no cost.

---

### New Backend Endpoints — `routes/analytics.js`

All 4 endpoints query existing tables — no new DB tables needed.

**1. QoQ Achievement Trends**
```
GET /api/admin/analytics/qoq-trends?cycle_year=2025&department=Engineering
→ Query: AVG(progress_score) from goal_achievements
  grouped by quarter, then by department
→ Returns: [{ quarter: 'Q1', Engineering: 72, HR: 65 }, ...]
→ Used for: Line chart
```

**2. Completion Rates**
```
GET /api/admin/analytics/completion-rates?cycle_year=2025
→ Query: For each quarter —
    employee_done = COUNT DISTINCT employees with at least 1 achievement
    manager_done  = COUNT DISTINCT managers with at least 1 check-in comment
    total_employees = COUNT employees with approved sheets
→ Returns: [{ quarter: 'Q1', employee_pct: 80, manager_pct: 60 }, ...]
→ Used for: Grouped bar chart
```

**3. Goal Distribution**
```
GET /api/admin/analytics/goal-distribution?cycle_year=2025
→ Query 1: COUNT goals grouped by thrust_area name
→ Query 2: COUNT goals grouped by uom_type
→ Query 3: COUNT goal_achievements grouped by status (latest per goal)
→ Returns: { by_thrust_area: [...], by_uom: [...], by_status: [...] }
→ Used for: Horizontal bar + two pie charts
```

**4. Manager Effectiveness**
```
GET /api/admin/analytics/manager-effectiveness?cycle_year=2025
→ Query: Per manager —
    submitted = COUNT DISTINCT (goal_sheet_id, quarter) from manager_checkins
    possible  = COUNT approved sheets under this manager × 4 quarters
    rate      = submitted / possible × 100
→ Returns: [{ manager_name: 'X', rate: 75, submitted: 3, possible: 4 }, ...]
→ Used for: Horizontal bar chart
```

---

### Frontend — New Admin Dashboard Tab: "Analytics"

New file: `frontend/src/pages/admin/AnalyticsTab.js`

Four panels in a 2×2 responsive grid:

**Panel 1 — QoQ Achievement Trend (LineChart)**
- X axis: Q1 (Jul–Sep), Q2 (Oct–Dec), Q3 (Jan–Feb), Q4 (Mar–Apr)
- Y axis: Average Score % (0–100)
- One colored line per department
- Filter: cycle year input
- Tooltip shows exact % on hover

**Panel 2 — Check-in Completion Rates (BarChart)**
- X axis: Q1–Q4
- Y axis: Completion % (0–100)
- Two bars per quarter: Employee (blue) and Manager (green)
- Shows at a glance which quarters have low engagement

**Panel 3 — Goal Distribution (3 sub-panels)**
- By Thrust Area: `BarChart` horizontal — which areas have most goals
- By UoM Type: `PieChart` — numeric_min / numeric_max / timeline / zero
- By Status: `PieChart` — not_started / on_track / completed

**Panel 4 — Manager Effectiveness (BarChart horizontal)**
- One bar per manager showing check-in completion rate %
- Color fill: green ≥ 75%, orange 50–74%, red < 50%
- Tooltip shows: "3 of 4 possible check-ins submitted"

---

### New Files

| File | Purpose |
|---|---|
| `backend/src/routes/analytics.js` | All 4 analytics query endpoints |
| `frontend/src/pages/admin/AnalyticsTab.js` | All 4 Recharts panels |

### Modified Files

| File | Change |
|---|---|
| `backend/src/index.js` | Register `app.use('/api/admin/analytics', require('./routes/analytics'))` |
| `frontend/src/pages/admin/Dashboard.js` | Add "Analytics" tab + import AnalyticsTab |
| `frontend/package.json` | Add recharts |

---

---

## Build Order

### Sprint 1 — Escalation Module (5.3)
- [ ] Add `escalations` table to `migrate.js`
- [ ] Run `npm run migrate`
- [ ] Create `backend/src/jobs/escalationJob.js` with all 3 rules
- [ ] Add GET + PUT escalation endpoints to `admin.js`
- [ ] Add "Escalations" tab to Admin Dashboard
- [ ] Register escalationJob in `index.js`
- [ ] Test: seed data that triggers each rule, verify records created in DB

### Sprint 2 — Analytics Module (5.4)
- [ ] Install recharts in frontend
- [ ] Create `backend/src/routes/analytics.js` with all 4 endpoints
- [ ] Register analytics route in `index.js`
- [ ] Create `frontend/src/pages/admin/AnalyticsTab.js` with all 4 chart panels
- [ ] Add "Analytics" tab to Admin Dashboard
- [ ] Test: verify all 4 charts render correctly with real data

---

## Summary

| Feature | New Files | Modified Files | External Dependency |
|---|---|---|---|
| 5.3 Escalation Module | `escalationJob.js` | `migrate.js`, `admin.js`, `index.js`, `Dashboard.js` | None |
| 5.4 Analytics Module | `analytics.js`, `AnalyticsTab.js` | `index.js`, `Dashboard.js`, `package.json` | None (Recharts) |
