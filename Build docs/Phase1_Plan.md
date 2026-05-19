# Phase 1 — Goal Creation & Approval: Detailed Build Plan

---

## 1. Tech Stack Decision

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Tailwind CSS | Fast UI, component reuse across roles |
| Backend | Node.js + Express | Lightweight REST API |
| Database | PostgreSQL | Relational data suits goal/approval hierarchy |
| Auth | JWT (role-based) | Simple role separation: Employee / Manager / Admin |
| Hosting | AWS (EC2 or Elastic Beanstalk + RDS) | Cost-aware, scalable |

---

## 2. Database Schema

### Tables

**users**
```
id, name, email, password_hash, role (employee | manager | admin),
manager_id (FK → users.id), department, created_at
```

**thrust_areas**
```
id, name, description
```

**goal_sheets**
```
id, employee_id (FK → users), cycle_year, status (draft | submitted | approved | rework),
submitted_at, approved_at, approved_by (FK → users)
```

**goals**
```
id, goal_sheet_id (FK → goal_sheets), thrust_area_id (FK → thrust_areas),
title, description, uom_type (numeric_min | numeric_max | timeline | zero),
target_value, target_date, weightage, is_shared (bool),
shared_from_goal_id (FK → goals, nullable), is_locked (bool), created_at, updated_at
```

**goal_approvals**
```
id, goal_sheet_id, action (approved | returned | edited), actor_id (FK → users),
comment, changed_fields (JSONB), timestamp
```

**shared_goal_assignments**
```
id, source_goal_id (FK → goals), assigned_to (FK → users),
employee_goal_id (FK → goals), weightage_override
```

---

## 3. API Endpoints

### Auth
```
POST /api/auth/login          → returns JWT with role
GET  /api/auth/me             → current user profile
```

### Thrust Areas
```
GET  /api/thrust-areas        → list all thrust areas
```

### Goal Sheet (Employee)
```
POST /api/goal-sheets                        → create new draft sheet for current cycle
GET  /api/goal-sheets/mine                   → get own goal sheet
POST /api/goal-sheets/:id/submit             → submit for manager approval
```

### Goals (Employee)
```
POST   /api/goal-sheets/:sheetId/goals       → add a goal
PUT    /api/goals/:id                        → edit goal (only if sheet is draft/rework)
DELETE /api/goals/:id                        → remove goal (only if sheet is draft/rework)
```

### Manager Approval
```
GET  /api/manager/team-sheets                → list all submitted sheets for manager's team
GET  /api/manager/team-sheets/:id            → view a specific sheet with goals
PUT  /api/manager/goals/:id                  → inline edit target/weightage before approval
POST /api/manager/goal-sheets/:id/approve    → approve and lock goals
POST /api/manager/goal-sheets/:id/return     → return for rework with comment
```

### Shared Goals (Admin / Manager)
```
POST /api/shared-goals                       → push a departmental KPI to multiple employees
GET  /api/shared-goals/mine                  → employee views shared goals on their sheet
PUT  /api/shared-goals/:id/weightage         → employee adjusts weightage only
```

### Admin
```
GET  /api/admin/goal-sheets                  → view all sheets across org
POST /api/admin/goals/:id/unlock             → unlock a locked goal for editing
GET  /api/admin/audit-log                    → view full audit trail
```

---

## 4. Validation Rules (Backend-enforced)

| Rule | Where Enforced |
|---|---|
| Total weightage of all goals on a sheet must equal 100% | On submit + on approve |
| Minimum weightage per goal: 10% | On goal create/edit |
| Maximum 8 goals per employee per cycle | On goal create |
| Shared goal: title and target are read-only for recipients | PUT /goals/:id guard |
| Goals locked after approval — no edits without Admin unlock | Middleware check on PUT /goals/:id |

---

## 5. Frontend Pages & Components

### Employee Views
- **Login Page** — email/password, redirects by role
- **My Goal Sheet** — lists all goals with weightage, total weightage indicator (turns red if ≠ 100%)
- **Add / Edit Goal Form** — fields: Thrust Area (dropdown), Title, Description, UoM (dropdown), Target Value / Date, Weightage
- **Shared Goals Section** — read-only title/target, editable weightage only
- **Submit Button** — disabled until total weightage = 100% and at least 1 goal exists

### Manager Views
- **Team Dashboard** — table of team members with sheet status (Draft / Submitted / Approved / Rework)
- **Goal Sheet Review** — inline editable target and weightage fields per goal
- **Approve / Return Actions** — approve locks all goals; return requires a comment

### Admin Views
- **All Sheets Overview** — filter by department, status, cycle
- **Push Shared Goal Form** — select KPI, select target employees/department
- **Audit Log Table** — who changed what and when, filterable
- **Unlock Goal Action** — per goal, with mandatory reason comment

---

## 6. Key UI/UX Rules

- Weightage total counter always visible on goal sheet (e.g., "Total: 85% / 100%")
- Inline validation messages on form fields (not just on submit)
- Locked goals shown with a lock icon — fields are disabled
- Shared goals badge to distinguish them from personal goals
- Role-based navigation — employees never see manager/admin routes

---

## 7. Shared Goals Logic

1. Admin/Manager creates a "shared goal" with title, thrust area, target, and a list of recipient employees.
2. System creates one canonical **source goal** (`is_shared=FALSE`, owned by the pusher) and one recipient copy per employee (`is_shared=TRUE`, `shared_from_goal_id` → source goal id).
3. Recipients can only change `weightage` — all other fields are read-only.
4. When the source goal owner logs achievement (Phase 2), it syncs to all linked recipient goals via `shared_goal_assignments`.

> **Bug fix (post-build):** The original implementation set `source_goal_id = employee_goal_id` for every recipient (each goal pointing to itself), and all goals were marked `is_shared=TRUE`. This meant the sync query (`WHERE source_goal_id = goal_id AND NOT is_shared`) never matched. Fixed in `sharedGoals.js` by creating a single source goal first, then recipient copies pointing to it.

---

## 8. Approval Workflow State Machine

```
draft → submitted → approved (locked)
                 ↘ rework → draft (employee edits) → submitted → ...
```

- Only Manager can move: submitted → approved or submitted → rework
- Only Admin can unlock an approved goal (creates audit log entry)

---

## 9. Audit Trail

Every write operation on a goal after lock date logs to `goal_approvals`:
- `actor_id` — who made the change
- `changed_fields` — JSONB diff of before/after values
- `timestamp` — exact datetime
- `action` — edited | approved | returned | unlocked

---

## 10. Build Order (Sprint Sequence)

### Sprint 1 — Foundation (Days 1–2)
- [ ] DB schema setup and migrations
- [ ] Auth: login, JWT, role middleware
- [ ] Seed data: users (3 roles), thrust areas, one cycle

### Sprint 2 — Employee Goal Flow (Days 2–3)
- [ ] Goal sheet CRUD APIs
- [ ] Validation middleware (weightage rules, max goals)
- [ ] Employee UI: goal sheet page, add/edit goal form, submit

### Sprint 3 — Manager Approval Flow (Day 3–4)
- [ ] Manager team dashboard API + UI
- [ ] Inline edit + approve/return APIs
- [ ] Goal lock logic post-approval

### Sprint 4 — Shared Goals + Admin (Day 4–5)
- [ ] Shared goal push API + UI
- [ ] Recipient weightage-only edit enforcement
- [ ] Admin: unlock goal, audit log view

### Sprint 5 — Polish & Demo Prep (Day 5)
- [ ] End-to-end testing of all 3 user journeys
- [ ] Error handling and edge cases (0 goals, over 100%, duplicate submissions)
- [ ] Demo credentials setup and hosted deployment

---

## 11. Demo Credentials (to prepare)

| Role | Email | Password |
|---|---|---|
| Employee | employee@demo.com | demo1234 |
| Manager | manager@demo.com | demo1234 |
| Admin | admin@demo.com | demo1234 |

---

## 12. Edge Cases to Handle

- Employee tries to submit with total weightage ≠ 100% → blocked with message
- Employee tries to add 9th goal → blocked with message
- Employee tries to edit a locked goal → 403 response + UI disables fields
- Manager approves a sheet where weightage ≠ 100% → backend re-validates before locking
- Shared goal recipient tries to edit title/target → 403 + fields disabled in UI
- Admin unlocks goal → audit log entry created, goal becomes editable for one edit cycle

