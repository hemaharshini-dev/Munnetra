# Goal Setting & Tracking Portal — Phase 1

## Prerequisites
- Node.js 18+
- PostgreSQL running locally

---

## Backend Setup

```bash
cd backend
```

1. Edit `.env` — set your `DATABASE_URL` and a strong `JWT_SECRET`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations (creates all tables):
   ```bash
   npm run migrate
   ```
4. Seed demo data (3 users + thrust areas):
   ```bash
   npm run seed
   ```
5. Start the server:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`

---

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

App runs on `http://localhost:3000`

---

## Demo Credentials

| Role     | Email                | Password  |
|----------|----------------------|-----------|
| Employee | employee@demo.com    | demo1234  |
| Manager  | manager@demo.com     | demo1234  |
| Admin    | admin@demo.com       | demo1234  |

---

## Phase 1 Features Implemented

### Employee
- Create goal sheet for current cycle
- Add up to 8 goals with Thrust Area, Title, Description, UoM, Target, Weightage
- Live weightage counter (turns red if ≠ 100%)
- Submit for manager approval (blocked if weightage ≠ 100%)
- Edit/delete goals while in draft or rework status
- View shared goals (read-only title/target, editable weightage)

### Manager
- Team dashboard showing all members' sheet statuses
- Review submitted sheets with inline edit of target/weightage
- Approve (locks all goals) or Return for rework (requires comment)

### Admin
- View all sheets across org with status/department filters
- Push shared departmental KPIs to multiple employees
- Unlock locked goals (requires reason, creates audit log entry)
- Full audit log of all approval actions

### Validation Rules (all backend-enforced)
- Total weightage must equal 100% on submit and approve
- Minimum weightage per goal: 10%
- Maximum 8 goals per employee per cycle
- Shared goals: title and target are read-only for recipients
- Locked goals cannot be edited without Admin unlock
