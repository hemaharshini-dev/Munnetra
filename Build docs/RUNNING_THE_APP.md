# How to Run the Goal Setting & Tracking Portal

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [PostgreSQL Setup](#2-postgresql-setup)
3. [Project Structure](#3-project-structure)
4. [Backend Setup](#4-backend-setup)
5. [Frontend Setup](#5-frontend-setup)
6. [Running the Application](#6-running-the-application)
7. [Demo Walkthrough](#7-demo-walkthrough)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

### Node.js (v18 or higher)
Download from: https://nodejs.org/en/download

```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

### PostgreSQL (v14 or higher)
Download from: https://www.postgresql.org/download

```bash
psql --version   # should print psql (PostgreSQL) 14.x or higher
```

> **Windows users:** PostgreSQL is typically installed with pgAdmin. You can use pgAdmin or the `psql` command-line tool.

---

## 2. PostgreSQL Setup

### Step 1 — Start PostgreSQL
- **Windows:** `Win + R` → `services.msc` → find `postgresql-x64-xx` → Start
- **Or via pgAdmin:** Open pgAdmin and connect to your local server

### Step 2 — Create the database
```bash
psql -U postgres
```
```sql
CREATE DATABASE goal_tracker;
\q
```

### Step 3 — Note your connection details
- Host: `localhost`
- Port: `5432`
- Database: `goal_tracker`
- Username: `postgres`
- Password: set during PostgreSQL installation

---

## 3. Project Structure

```
Munnetra/
├── backend/
│   ├── src/
│   │   ├── db/          ← migrate.js, seed.js, pool.js
│   │   ├── jobs/        ← escalationJob.js (daily cron)
│   │   ├── middleware/  ← auth.js
│   │   ├── routes/      ← all API routes
│   │   └── index.js
│   ├── .env             ← YOU MUST EDIT THIS
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
├── Build docs/          ← all planning and setup docs
├── .gitignore
└── README.md
```

---

## 4. Backend Setup

### Step 1 — Navigate to the backend folder
```bash
cd Munnetra/backend
```

### Step 2 — Configure environment variables

Open `backend/.env` and fill in your values:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/goal_tracker
JWT_SECRET=any_long_random_string_here
```

Replace `YOUR_PASSWORD` with your PostgreSQL password.

**Example:**
```env
PORT=5000
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/goal_tracker
JWT_SECRET=supersecretjwtkey2024
```

### Step 3 — Install dependencies
```bash
npm install
```

### Step 4 — Run database migrations

Creates all 10 tables:
```bash
npm run migrate
```

Expected output:
```
Migration complete.
```

### Step 5 — Seed demo data
```bash
npm run seed
```

Expected output:
```
Seed complete.
```

Inserts:
- 3 demo users (employee, manager, admin)
- 7 thrust areas
- 5 check-in windows (Q1 set as active for demo)

> Migrate and seed only need to run **once**. Re-running seed is safe — uses `ON CONFLICT DO UPDATE`.

### Step 6 — Start the backend server
```bash
npm run dev
```

Expected output:
```
Server running on port 5000
[EscalationJob] Scheduled — runs daily at 9:00 AM
```

API live at: **http://localhost:5000**

---

## 5. Frontend Setup

Open a **new terminal** (keep the backend terminal running).

```bash
cd Munnetra/frontend
npm install
npm start
```

Opens automatically at: **http://localhost:3000**

---

## 6. Running the Application

Two terminals required simultaneously:

| Terminal | Command | URL |
|---|---|---|
| Terminal 1 (Backend) | `cd backend && npm run dev` | http://localhost:5000 |
| Terminal 2 (Frontend) | `cd frontend && npm start` | http://localhost:3000 |

---

## 7. Demo Walkthrough

### Credentials

| Role | Email | Password |
|---|---|---|
| Employee | employee@demo.com | demo1234 |
| Manager | manager@demo.com | demo1234 |
| Admin | admin@demo.com | demo1234 |

---

### Step 0 — Activate the Goal Setting Window (do this first)

1. Log in as **admin@demo.com**
2. Go to Admin Dashboard → **Cycle Windows** tab
3. Click **Set Active Now** on the **Goal Setting (May–Jun)** row
4. The WindowBanner turns green — goal creation is now open
5. Log out

---

### Employee Journey

1. Log in as **employee@demo.com**
2. Click **Create Goal Sheet**
3. Click **+ Add Goal** — fill in Thrust Area, Title, UoM, Target, Weightage (min 10%)
4. Add goals until total weightage = 100% (counter turns green)
5. Click **Submit for Approval** — sheet status changes to `submitted`

---

### Manager Journey — Approval

1. Log in as **manager@demo.com**
2. Team Dashboard shows the submitted sheet
3. Click **Review →** — inline edit target/weightage if needed, click Save
4. Click **✓ Approve & Lock** — goals are locked, sheet status = `approved`

---

### Admin Journey — Activate Check-in Window

1. Log in as **admin@demo.com**
2. Admin Dashboard → **Cycle Windows** tab
3. Click **Set Active Now** on **Q1 Check-in (Jul–Sep)**
4. WindowBanner turns blue — check-in is now open

---

### Employee Journey — Check-in

1. Log in as **employee@demo.com**
2. Click **Check-in** in the navbar
3. Select the **Q1 (Jul–Sep)** tab
4. For each goal: enter Actual Value or Date, select Status
5. Click **Save for Q1 (Jul–Sep)** — progress score bar appears
6. Score colors: green ≥ 70%, orange 40–70%, red < 40%

---

### Manager Journey — Check-in Review

1. Log in as **manager@demo.com**
2. Team Dashboard — Q1 badge shows employee completion status
3. Click **Check-in →** next to the employee
4. View Planned Target vs Actual Achievement side by side
5. Enter a check-in comment and click **Submit Q1 (Jul–Sep) Check-in**

---

### Admin Journey — Full Dashboard

Log in as **admin@demo.com** and explore all 8 tabs:

| Tab | What to do |
|---|---|
| Sheets | Click any row to view goals with IDs, unlock a locked goal |
| Shared Goals | Push a KPI to the employee — verify it appears on their sheet |
| Audit Log | See all actions: approved, edited, checkin, achievement_updated |
| Completion | Verify Q1 Emp ✓ and Q1 Mgr ✓ for the employee |
| Reports | Click Load → verify data → click Export CSV |
| Escalations | View any auto-generated escalation records, mark resolved |
| Analytics | View all 4 charts — QoQ trends, completion rates, distribution, manager effectiveness |
| Cycle Windows | Edit dates, Set Active Now for any window |

---

### Full End-to-End Flow

```
Admin  → Activate Goal Setting window
Employee → Create sheet → Add goals (100% weightage) → Submit
Manager → Review → Inline edit → Approve & Lock
Admin  → Push shared goal to employee
Admin  → Activate Q1 Check-in window
Employee → Log actuals for all goals → Verify scores
Manager → View planned vs actual → Submit Q1 check-in comment
Admin  → Completion tab → Verify Q1 done
Admin  → Reports tab → Load → Export CSV
Admin  → Analytics tab → View all 4 charts
Admin  → Audit Log → Verify all action types present
```

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on backend start | PostgreSQL is not running. Start the service. |
| `database "goal_tracker" does not exist` | Run `psql -U postgres -c "CREATE DATABASE goal_tracker;"` |
| `Migration complete` but tables missing | Check `DATABASE_URL` in `.env` |
| Login returns "Invalid credentials" | Run `npm run seed` from `backend/` |
| Submit button stays disabled | Total weightage must equal exactly 100% |
| Check-in inputs are disabled | Admin → Cycle Windows → Set Active Now on Q1 |
| Goal creation is disabled | Admin → Cycle Windows → Set Active Now on Goal Setting |
| Port 5000 already in use | Change `PORT` in `.env`, update `frontend/src/api/client.js` baseURL |
| `npm install` fails | Delete `node_modules/` and `package-lock.json`, retry |
| Shared goal actual is read-only | Expected — syncs from source owner only |
| Analytics charts empty | Log achievements first, then click Refresh |
| No escalations showing | Job runs at 9 AM daily — trigger conditions must be met first |
| `[EscalationJob] Error` in console | Check DB connection and that `escalations` table exists (`npm run migrate`) |

---

## Quick Reference

```bash
# One-time setup
cd backend
npm install
npm run migrate
npm run seed

cd ../frontend
npm install

# Every time you run the app (2 terminals)
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```
