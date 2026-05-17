# Plan: 2.3 Check-in Schedule & Section 3 User Roles & Personas

---

## Part A — 2.3 Check-in Schedule

---

### A1. What the BRD Requires

The portal must enforce the following quarterly windows. Each window controls what actions are permitted:

| Period | Window Opens | Action Allowed |
|---|---|---|
| Phase 1 — Goal Setting | 1st May | Goal Creation, Submission & Approval only |
| Q1 Check-in | July | Progress Update — Planned vs. Actual |
| Q2 Check-in | October | Progress Update — Planned vs. Actual |
| Q3 Check-in | January | Progress Update — Planned vs. Actual |
| Q4 / Annual | March / April | Final Achievement Capture |

Key word: **enforce** — the system must block actions outside their permitted window, not just display a message.

---

### A2. New Database Table — `check_in_windows`

```
id          SERIAL PRIMARY KEY
period      VARCHAR(30)   -- 'goal_setting' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
label       VARCHAR(60)   -- e.g. 'Q1 Check-in (Jul–Sep)'
opens_at    DATE NOT NULL
closes_at   DATE NOT NULL
cycle_year  INTEGER NOT NULL
action      VARCHAR(30)   -- 'goal_setting' | 'checkin'
UNIQUE(period, cycle_year)
```

- `opens_at` and `closes_at` define the exact enforcement boundary
- `action` tells the backend which operations are permitted in this window
- Admin can update these dates at any time via the UI

---

### A3. Window Dates (Seeded for Current Cycle Year)

| Period | Opens | Closes | Action |
|---|---|---|---|
| goal_setting | 1 May | 30 Jun | goal_setting |
| Q1 | 1 Jul | 30 Sep | checkin |
| Q2 | 1 Oct | 31 Dec | checkin |
| Q3 | 1 Jan (+1yr) | 28 Feb (+1yr) | checkin |
| Q4 | 1 Mar (+1yr) | 30 Apr (+1yr) | checkin |

**Demo override:** For hackathon purposes, seed sets Q1 `opens_at = today - 1 day` and `closes_at = today + 365 days` so the check-in flow is immediately demonstrable without waiting for July.

---

### A4. Backend Enforcement Logic

#### New endpoint
```
GET /api/checkin-windows/active
    → returns the window where opens_at <= TODAY AND closes_at >= TODAY
    → returns null if no window is currently open (gap between windows)
```

#### Enforcement in existing endpoints

| Endpoint | Check Added |
|---|---|
| `POST /api/goal-sheets` | Active window must be `goal_setting` |
| `POST /api/goal-sheets/:id/submit` | Active window must be `goal_setting` |
| `POST /api/manager/team-sheets/:id/approve` | Active window must be `goal_setting` |
| `POST /api/manager/team-sheets/:id/return` | Active window must be `goal_setting` |
| `POST /api/achievements` | Active window must be `checkin` |
| `POST /api/manager/checkins` | Active window must be `checkin` |

**Implementation pattern** — a reusable middleware helper:
```js
async function requireWindow(action) {
  return async (req, res, next) => {
    const { rows } = await pool.query(
      `SELECT * FROM check_in_windows
       WHERE action=$1 AND opens_at <= CURRENT_DATE AND closes_at >= CURRENT_DATE
       AND cycle_year=$2`,
      [action, new Date().getFullYear()]
    );
    if (!rows.length) {
      return res.status(403).json({
        error: `This action is not available outside the ${action} window.`
      });
    }
    req.activeWindow = rows[0];
    next();
  };
}
```

Usage:
```js
router.post('/', authenticate, requireRole('employee'), requireWindow('goal_setting'), async (req, res) => { ... });
router.post('/achievements', authenticate, requireRole('employee'), requireWindow('checkin'), async (req, res) => { ... });
```

---

### A5. Frontend Enforcement

#### Global window context
- On app load, fetch `GET /api/checkin-windows/active` and store in a React context (`WindowContext`)
- All pages read from this context — no repeated API calls

```js
// WindowContext.js
const { activeWindow } = useWindow();
// activeWindow = { period: 'Q1', label: 'Q1 Check-in (Jul–Sep)', action: 'checkin', opens_at, closes_at }
// or null if no window is open
```

#### Per-page behaviour

| Page | Window Open (goal_setting) | Window Open (checkin) | No Active Window |
|---|---|---|---|
| Employee — My Goals | Add/Edit/Submit enabled | Add/Edit/Submit disabled + banner | All disabled + banner |
| Employee — Check-in | Check-in page shows "Goal setting period — check-ins not open yet" | Inputs enabled | Inputs disabled + "No active window" banner |
| Manager — Review Sheet | Approve/Return enabled | Approve/Return disabled | Disabled |
| Manager — Check-in | Comment disabled + "Not in check-in window" | Comment + Submit enabled | Disabled |

#### Window status banner component
Shown at the top of every page when a window is active:
```
┌─────────────────────────────────────────────────────────┐
│ 📅  Q1 Check-in window is open  ·  Jul 1 – Sep 30, 2025 │
└─────────────────────────────────────────────────────────┘
```
Color: blue for active, gray for closed, orange for "closing soon" (within 7 days of closes_at).

---

### A6. Admin — Window Management UI

New tab in Admin Dashboard: **"Cycle Windows"**

- Table showing all 5 windows for the current cycle year with their open/close dates
- Edit button per row — opens inline date pickers to update `opens_at` and `closes_at`
- "Set as Active Now" shortcut button — sets `opens_at = today` for demo purposes
- Changes take effect immediately — no restart needed

**New admin endpoint:**
```
GET  /api/admin/checkin-windows          → list all windows for cycle_year
PUT  /api/admin/checkin-windows/:id      → update opens_at / closes_at
```

---

### A7. Seed Data for `check_in_windows`

```js
const YEAR = new Date().getFullYear();
const windows = [
  { period: 'goal_setting', label: 'Goal Setting (May–Jun)', opens_at: `${YEAR}-05-01`, closes_at: `${YEAR}-06-30`, action: 'goal_setting' },
  { period: 'Q1', label: 'Q1 Check-in (Jul–Sep)',  opens_at: `${YEAR}-07-01`, closes_at: `${YEAR}-09-30`, action: 'checkin' },
  { period: 'Q2', label: 'Q2 Check-in (Oct–Dec)',  opens_at: `${YEAR}-10-01`, closes_at: `${YEAR}-12-31`, action: 'checkin' },
  { period: 'Q3', label: 'Q3 Check-in (Jan–Feb)',  opens_at: `${YEAR+1}-01-01`, closes_at: `${YEAR+1}-02-28`, action: 'checkin' },
  { period: 'Q4', label: 'Q4 / Annual (Mar–Apr)',  opens_at: `${YEAR+1}-03-01`, closes_at: `${YEAR+1}-04-30`, action: 'checkin' },
];
// Demo override: make Q1 open now
windows[1].opens_at = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
windows[1].closes_at = `${YEAR + 2}-12-31`;
```

---

### A8. Edge Cases

| Scenario | Handling |
|---|---|
| No window is currently open (gap between periods) | All write actions blocked with "Portal is between cycles" message |
| Admin tries to overlap two windows | Backend validates no overlap on PUT — returns 400 |
| Employee submits goal during check-in window | 403 — "Goal submission is only allowed during the Goal Setting window (May–Jun)" |
| Employee logs achievement during goal setting window | 403 — "Achievement logging is only allowed during a Check-in window" |
| Manager approves during check-in window | 403 — "Approvals are only allowed during the Goal Setting window" |
| Window closes while user is mid-form | On submit, backend re-validates — returns 403 with clear message |

---

### A9. Build Order for 2.3

1. Add `check_in_windows` table to `migrate.js`
2. Add seed data for all 5 windows with demo override
3. Create `requireWindow(action)` middleware helper
4. Add `GET /api/checkin-windows/active` endpoint
5. Apply `requireWindow` to all relevant existing endpoints
6. Create `WindowContext.js` in frontend
7. Create `WindowBanner` component
8. Apply window-aware disabling to Employee Goal Sheet, Employee Check-in, Manager Review, Manager Check-in pages
9. Add Admin "Cycle Windows" tab with `GET` + `PUT` endpoints

---
---

## Part B — Section 3: User Roles & Personas

---

### B1. Overview

The BRD defines three roles with completely separate responsibilities and system capabilities. Each role sees a different UI, has different API access, and is enforced at the backend via JWT role middleware.

| Role | Core Responsibility | Phase 1 Focus | Phase 2 Focus |
|---|---|---|---|
| Employee | Individual contributor | Draft & submit goals | Log actuals, update status |
| Manager (L1) | Team lead | Approve/return goals | Conduct check-ins, log feedback |
| Admin / HR | System operator | Unlock goals, push shared KPIs | Manage windows, oversee completion |

---

### B2. Employee Role

**BRD responsibilities:** Draft goals; enter quarterly achievement; update progress status

#### Phase 1 capabilities (already built)
| Capability | UI Location | Backend Guard |
|---|---|---|
| Create goal sheet for current cycle | `/employee` | `POST /api/goal-sheets` — one per cycle |
| Add up to 8 goals | Goal sheet page | `POST /api/goal-sheets/:id/goals` — max 8 check |
| Edit / delete goals | Goal sheet page | Only allowed in `draft` or `rework` status |
| Set weightage per goal (min 10%) | Goal form | DB CHECK + backend validation |
| Submit sheet for approval | Submit button | Total weightage must = 100% |
| View locked goals (read-only) | Goal sheet page | `is_locked = true` → fields disabled |
| View shared goals (weightage-only edit) | Goal sheet page | `is_shared = true` → title/target read-only |
| Resubmit after rework | Submit button | Allowed when status = `rework` |

#### Phase 2 capabilities (built in 2.2)
| Capability | UI Location | Backend Guard |
|---|---|---|
| View approved goals for check-in | `/employee/checkin` | `GET /api/achievements/mine` — approved sheet only |
| Log actual achievement per goal per quarter | Check-in page | `POST /api/achievements` |
| Select status: Not Started / On Track / Completed | Status dropdown | DB CHECK constraint |
| See live progress score | Score bar on check-in page | Computed client-side, confirmed server-side |
| Re-save achievement within open window | Save button | Upsert — no limit on re-saves |
| View past quarters read-only | Quarter tabs | Frontend disables inputs for past quarters |
| Shared goal actual — read-only | Disabled input + "Synced" label | `POST /api/achievements` — 403 if recipient |

#### Phase 2 capabilities (to build in 2.3)
| Capability | UI Location | Backend Guard |
|---|---|---|
| Blocked from submitting goals outside goal-setting window | Banner + disabled submit | `requireWindow('goal_setting')` on submit endpoint |
| Blocked from logging achievement outside check-in window | Banner + disabled inputs | `requireWindow('checkin')` on achievements endpoint |
| See active window status on every page | `WindowBanner` component in Navbar | `GET /api/checkin-windows/active` |

#### Employee — complete navigation map
```
/employee          → My Goals (goal sheet, add/edit/submit)
/employee/checkin  → Quarterly Check-in (log actuals, view scores)
```

---

### B3. Manager (L1) Role

**BRD responsibilities:** Review & approve goals; conduct quarterly check-ins; log feedback

#### Phase 1 capabilities (already built)
| Capability | UI Location | Backend Guard |
|---|---|---|
| View all team members' goal sheets | `/manager` dashboard | `GET /api/manager/team-sheets` — filtered by `manager_id` |
| View submitted sheet with all goals | Review page | `GET /api/manager/team-sheets/:id` |
| Inline edit target / weightage before approval | Review page | `PUT /api/manager/goals/:id` — only on `submitted` sheets |
| Approve sheet — locks all goals | Approve button | `POST /api/manager/team-sheets/:id/approve` — re-validates weightage |
| Return for rework with comment | Return button + modal | `POST /api/manager/team-sheets/:id/return` — comment required |
| Push shared goals to employees | (via Admin UI) | `POST /api/shared-goals` — manager role allowed |

#### Phase 2 capabilities (built in 2.2)
| Capability | UI Location | Backend Guard |
|---|---|---|
| View team check-in completion per quarter | Dashboard — Q1/Q2/Q3/Q4 badges | `GET /api/manager/checkins/:sheetId` |
| Navigate to check-in review per employee | "Check-in →" button | Only shown for `approved` sheets |
| View planned target vs actual achievement | Check-in review page | `GET /api/manager/checkins/:sheetId?quarter=Q1` |
| See progress score per goal | Progress bar per goal | `progress_score` from `goal_achievements` |
| Select quarter to review | Quarter tabs with labels | Query param `?quarter=Q1` |
| Submit structured check-in comment | Comment textarea + Submit | `POST /api/manager/checkins` — comment required |
| Update existing check-in comment | Same textarea + Update button | Upsert on `UNIQUE(goal_sheet_id, quarter, cycle_year)` |
| View past quarters' comments read-only | Past quarter tabs | Existing comment shown, textarea pre-filled |

#### Phase 2 capabilities (to build in 2.3)
| Capability | UI Location | Backend Guard |
|---|---|---|
| Blocked from approving outside goal-setting window | Approve button disabled + banner | `requireWindow('goal_setting')` on approve endpoint |
| Blocked from submitting check-in outside check-in window | Submit button disabled + message | `requireWindow('checkin')` on checkins endpoint |
| See active window status on every page | `WindowBanner` component | `GET /api/checkin-windows/active` |

#### Manager — complete navigation map
```
/manager                      → Team Dashboard (sheet statuses, check-in badges)
/manager/review/:id           → Goal Sheet Review (approve / return)
/manager/checkin/:sheetId     → Check-in Review (planned vs actual, comment)
```

---

### B4. Admin / HR Role

**BRD responsibilities:** Configure cycles; manage org hierarchy; oversee completion rates

#### Phase 1 capabilities (already built)
| Capability | UI Location | Backend Guard |
|---|---|---|
| View all goal sheets across org | Admin Dashboard → Sheets tab | `GET /api/admin/goal-sheets` — no manager_id filter |
| Filter sheets by department / status | Filter controls | Query params on endpoint |
| View goals inside any sheet | Click row → modal | `GET /api/admin/goal-sheets/:id` |
| Unlock a locked goal | Unlock button in modal | `POST /api/admin/goals/:id/unlock` — comment required |
| Push shared departmental KPI to employees | Shared Goals tab | `POST /api/shared-goals` |
| View full audit log | Audit Log tab | `GET /api/admin/audit-log` |
| Receive activity notification bell | Navbar | Fetches audit log, tracks unread via localStorage |

#### Phase 2 capabilities (to build in 2.3)
| Capability | UI Location | Backend Guard |
|---|---|---|
| View all check-in windows for current cycle | Admin Dashboard → Cycle Windows tab | `GET /api/admin/checkin-windows` |
| Edit window open / close dates | Inline date pickers per row | `PUT /api/admin/checkin-windows/:id` |
| Set a window as active immediately (demo shortcut) | "Set Active Now" button | Sets `opens_at = today` via PUT |
| See which window is currently active | Active badge on windows table | Computed from `opens_at <= today <= closes_at` |

#### Admin — complete navigation map
```
/admin   → Admin Dashboard with tabs:
           Sheets         — all org sheets, unlock goals
           Shared Goals   — push KPIs to employees
           Audit Log      — full activity feed
           Cycle Windows  — manage check-in window dates (new in 2.3)
```

---

### B5. Role Access Control Matrix (Full — Phase 1 + 2.2 + 2.3)

| Feature | Employee | Manager | Admin |
|---|---|---|---|
| Create goal sheet | ✓ | — | — |
| Add / edit / delete goals | ✓ (draft/rework only) | — | — |
| Submit goal sheet | ✓ | — | — |
| Approve goal sheet | — | ✓ | — |
| Return goal sheet for rework | — | ✓ | — |
| Inline edit goals before approval | — | ✓ | — |
| Push shared goals | — | ✓ | ✓ |
| Unlock locked goals | — | — | ✓ |
| Log actual achievement | ✓ | — | — |
| Update goal status (Not Started / On Track / Completed) | ✓ | — | — |
| View own progress scores | ✓ | — | — |
| View team planned vs actual | — | ✓ | ✓ |
| Submit quarterly check-in comment | — | ✓ | — |
| View check-in completion per team | — | ✓ (own team) | ✓ (full org) |
| Manage check-in windows | — | — | ✓ |
| View audit log | — | — | ✓ |
| Receive notification bell | — | — | ✓ |
| See active window banner | ✓ | ✓ | ✓ |

---

### B6. JWT Token Payload & Role Enforcement

Every API request carries a JWT with:
```json
{ "id": 3, "role": "employee", "name": "Employee User", "email": "employee@demo.com", "department": "Engineering" }
```

Backend middleware chain for every protected route:
```
authenticate → verify JWT → attach req.user
requireRole('employee') → check req.user.role
requireWindow('checkin') → check active window (2.3 addition)
```

Frontend route guard:
```jsx
function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return children;
}
```

Employees navigating to `/manager` or `/admin` are redirected to `/login` — no data leakage.

---

### B7. Demo Credentials & Role Switching

| Role | Email | Password | Landing Page |
|---|---|---|---|
| Employee | employee@demo.com | demo1234 | `/employee` |
| Manager | manager@demo.com | demo1234 | `/manager` |
| Admin | admin@demo.com | demo1234 | `/admin` |

For the hackathon demo, log out and log back in with a different credential to switch roles. Each role sees a completely different UI with no overlap.

---

### B8. Build Order for Section 3 (2.3 additions only)

1. `WindowContext.js` — fetch active window on app load, expose via context
2. `WindowBanner.js` — reusable banner component showing active window name + dates
3. Add `WindowBanner` to `Navbar.js` (shown for all roles)
4. Apply `requireWindow('goal_setting')` middleware to:
   - `POST /api/goal-sheets` (create)
   - `POST /api/goal-sheets/:id/submit`
   - `POST /api/manager/team-sheets/:id/approve`
   - `POST /api/manager/team-sheets/:id/return`
5. Apply `requireWindow('checkin')` middleware to:
   - `POST /api/achievements`
   - `POST /api/manager/checkins`
6. Disable UI controls when window doesn't match (read from `WindowContext`)
7. Add Admin "Cycle Windows" tab — list + edit window dates
8. Add `GET /api/admin/checkin-windows` and `PUT /api/admin/checkin-windows/:id`
