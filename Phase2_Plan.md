# Phase 2.2 — Achievement Tracking & Quarterly Check-ins: Build Plan

---

## 1. What Needs to Be Built (BRD 2.2 Only)

From the problem statement:

> - Quarterly update interface for employees to log Actual Achievement against Planned Targets
> - Status selection per goal: Not Started / On Track / Completed
> - Manager Check-in module: View Planned vs Achievement, Add a structured Check-in Comment
> - System-computed progress scores (for tracking only, not ratings)

---

## 2. New Database Tables

### `goal_achievements`
One row per goal per quarter. Employee logs actual here.
```
id             SERIAL PRIMARY KEY
goal_id        INTEGER NOT NULL  FK → goals
quarter        VARCHAR(5)        CHECK IN ('Q1','Q2','Q3','Q4')
cycle_year     INTEGER NOT NULL
actual_value   NUMERIC           -- numeric_min / numeric_max / zero UoM
actual_date    DATE              -- timeline UoM
status         VARCHAR(20)       CHECK IN ('not_started','on_track','completed')
progress_score NUMERIC           -- system-computed 0.0–1.0, stored on save
updated_at     TIMESTAMPTZ       DEFAULT NOW()
UNIQUE(goal_id, quarter, cycle_year)
```

### `manager_checkins`
One structured comment per employee sheet per quarter.
```
id             SERIAL PRIMARY KEY
goal_sheet_id  INTEGER NOT NULL  FK → goal_sheets
manager_id     INTEGER NOT NULL  FK → users
quarter        VARCHAR(5)
cycle_year     INTEGER NOT NULL
comment        TEXT NOT NULL
created_at     TIMESTAMPTZ       DEFAULT NOW()
UNIQUE(goal_sheet_id, quarter, cycle_year)
```

---

## 3. Progress Score Formulas

Computed in backend on every achievement save, stored in `goal_achievements.progress_score`.

| UoM Type | Formula | Notes |
|---|---|---|
| `numeric_min` | `actual_value ÷ target_value` | Cap at 1.0; higher is better |
| `numeric_max` | `target_value ÷ actual_value` | Cap at 1.0; guard divide-by-zero |
| `timeline` | `1.0` if `actual_date <= target_date`, else `0.0` | Binary |
| `zero` | `1.0` if `actual_value = 0`, else `0.0` | Binary |

Stored as decimal (0.0–1.0), displayed as % in UI.

---

## 4. New API Endpoints

### Employee — Achievement
```
GET  /api/achievements/mine
     → returns all goals (approved sheet) with their achievements for all quarters

POST /api/achievements
     body: { goal_id, quarter, cycle_year, actual_value, actual_date, status }
     → upserts achievement, computes + stores progress_score
     → syncs actual to linked shared goal recipients
```

### Manager — Check-in
```
GET  /api/manager/checkins/:sheetId?quarter=Q1
     → returns goals + achievements + existing check-in comment for that quarter

POST /api/manager/checkins
     body: { goal_sheet_id, quarter, cycle_year, comment }
     → saves structured check-in comment (comment required)
```

---

## 5. Modified Existing Endpoints

| Endpoint | Change |
|---|---|
| `GET /api/goal-sheets/mine` | Also join `goal_achievements` for current quarter per goal |
| `GET /api/manager/team-sheets/:id` | Also return achievements + check-in comment for selected quarter |

---

## 6. Shared Goal Achievement Sync

When the source goal owner saves an achievement:
1. Backend looks up `shared_goal_assignments` where `source_goal_id = goal_id`
2. Upserts the same `actual_value` / `actual_date` / `progress_score` into `goal_achievements` for every linked `employee_goal_id`
3. `status` is NOT synced — each recipient sets their own

---

## 7. Frontend Pages

### Employee — Check-in Page (`/employee/checkin`)

- Lists all goals from the approved sheet
- Per goal row:
  - Title, UoM type, Target value/date, Weightage
  - Actual input: number field (numeric/zero UoM) or date picker (timeline UoM)
  - Status dropdown: Not Started / On Track / Completed
  - Progress score shown after save (color-coded bar)
  - Shared goal badge + disabled actual input if recipient
- Active quarter shown at top (e.g. "Q1 Check-in")
- Save button per goal — can re-save multiple times
- Quarter tabs (Q1 / Q2 / Q3 / Q4) — past quarters read-only

### Manager — Check-in Review Page (`/manager/checkin/:sheetId`)

- Quarter selector tabs: Q1 / Q2 / Q3 / Q4
- Per goal: Planned Target | Actual Achievement | Progress Score bar | Status badge
- Structured comment textarea at bottom (required)
- Submit Check-in button — saves `manager_checkins` record
- Past quarters show saved comment as read-only

### Manager — Team Dashboard update (`/manager`)

- Add "Check-in" column showing ✓ submitted / — not yet per active quarter

---

## 8. Reusable Component — ProgressBar

```
props: score (0.0–1.0)
renders: filled bar + percentage label
  < 40%  → red
  40–70% → orange
  > 70%  → green
```

Used on employee check-in page, manager check-in review page.

---

## 9. Validation Rules (Backend-enforced)

| Rule | Enforced At |
|---|---|
| Sheet must be approved before logging achievement | `POST /api/achievements` |
| Status must be one of: not_started, on_track, completed | DB CHECK constraint |
| Manager comment cannot be empty | `POST /api/manager/checkins` |
| Shared goal recipient cannot change actual value | `POST /api/achievements` — 403 if `is_shared=true` and not source owner |

---

## 10. Migration Changes

Add to `migrate.js` (non-destructive — `CREATE TABLE IF NOT EXISTS`):
- `goal_achievements`
- `manager_checkins`

---

## 11. Routes to Register in `index.js`

```js
app.use('/api/achievements', require('./routes/achievements'));
// manager checkin endpoints added to existing routes/manager.js
```

---

## 12. Frontend Routing in `App.js`

```jsx
<Route path="/employee/checkin"
  element={<ProtectedRoute role="employee"><CheckinPage /></ProtectedRoute>} />

<Route path="/manager/checkin/:sheetId"
  element={<ProtectedRoute role="manager"><ManagerCheckin /></ProtectedRoute>} />
```

- Employee Navbar: **My Goals** | **Check-in**
- Manager Navbar: **Team Goals** | **Check-ins**

---

## 13. Build Order

### Step 1 — DB + Achievement API
- [ ] Add `goal_achievements` and `manager_checkins` to `migrate.js`
- [ ] `POST /api/achievements` — upsert, score compute, shared sync
- [ ] `GET /api/achievements/mine`

### Step 2 — Employee Check-in UI
- [ ] Check-in page with goal list, actual inputs, status dropdown
- [ ] Live score bar after save
- [ ] Quarter tabs — past quarters read-only
- [ ] Nav link from employee navbar

### Step 3 — Manager Check-in Module
- [ ] `GET /api/manager/checkins/:sheetId`
- [ ] `POST /api/manager/checkins`
- [ ] Manager check-in review page — planned vs actual, progress bars, comment
- [ ] Quarter tabs with history
- [ ] Check-in column on team dashboard

### Step 4 — Polish
- [ ] ProgressBar component reused across both views
- [ ] Edge cases (no approved sheet, zero-division, no actual yet)
- [ ] End-to-end test: employee logs → manager reviews → manager submits comment

---

## 14. Edge Cases

| Scenario | Handling |
|---|---|
| Employee has no approved sheet | Check-in page shows "No approved goals for this cycle" |
| `numeric_max` with actual = 0 | Score = 1.0 (guard divide-by-zero) |
| `timeline` with no actual date saved yet | Score = null, display as "—" |
| Shared goal recipient tries to change actual | 403 + input disabled in UI |
| Manager submits empty comment | 400 — comment required |
| Goal has no target_value set | Score = null, display as "—" |
