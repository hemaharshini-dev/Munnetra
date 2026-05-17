# How to Run the Goal Setting & Tracking Portal

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [PostgreSQL Setup](#2-postgresql-setup)
3. [Clone & Project Structure](#3-clone--project-structure)
4. [Backend Setup](#4-backend-setup)
5. [Frontend Setup](#5-frontend-setup)
6. [Running the Application](#6-running-the-application)
7. [Demo Walkthrough](#7-demo-walkthrough)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Make sure the following are installed on your machine before proceeding.

### Node.js (v18 or higher)
Download from: https://nodejs.org/en/download

Verify installation:
```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

### PostgreSQL (v14 or higher)
Download from: https://www.postgresql.org/download

Verify installation:
```bash
psql --version   # should print psql (PostgreSQL) 14.x or higher
```

> **Windows users:** PostgreSQL is typically installed with pgAdmin. You can use pgAdmin or the `psql` command-line tool.

---

## 2. PostgreSQL Setup

### Step 1 — Start PostgreSQL
Make sure the PostgreSQL service is running.

- **Windows:** Open Services (`Win + R` → `services.msc`) → find `postgresql-x64-xx` → Start
- **Or via pgAdmin:** Open pgAdmin and connect to your local server

### Step 2 — Create the database

Open a terminal and run:
```bash
psql -U postgres
```

Then inside the psql shell:
```sql
CREATE DATABASE goal_tracker;
\q
```

> If your PostgreSQL username is not `postgres`, replace it with your actual username throughout.

### Step 3 — Note your connection details

You will need:
- **Host:** `localhost`
- **Port:** `5432` (default)
- **Database:** `goal_tracker`
- **Username:** `postgres` (or your username)
- **Password:** whatever you set during PostgreSQL installation

---

## 3. Clone & Project Structure

```
Munnetra/
├── backend/          ← Node.js + Express API
│   ├── src/
│   │   ├── db/       ← migrate.js, seed.js, pool.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── index.js
│   ├── .env          ← YOU MUST EDIT THIS
│   └── package.json
├── frontend/         ← React + Tailwind CSS
│   ├── src/
│   └── package.json
├── .gitignore
├── README.md
└── Phase1_Plan.md
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

Replace:
- `YOUR_PASSWORD` → your PostgreSQL password
- `any_long_random_string_here` → any secret string (e.g. `mysecretkey123`)

**Example with password `admin123`:**
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

This creates all the required tables (`users`, `goals`, `goal_sheets`, etc.):
```bash
npm run migrate
```

Expected output:
```
Migration complete.
```

### Step 5 — Seed demo data

This inserts 3 demo users (Employee, Manager, Admin) and 7 thrust areas:
```bash
npm run seed
```

Expected output:
```
Seed complete.
```

> You only need to run migrate and seed **once**. Re-running seed is safe — it uses `ON CONFLICT DO UPDATE` so it won't duplicate data.

### Step 6 — Start the backend server
```bash
npm run dev
```

Expected output:
```
Server running on port 5000
```

The API is now live at: **http://localhost:5000**

---

## 5. Frontend Setup

Open a **new terminal** (keep the backend terminal running).

### Step 1 — Navigate to the frontend folder
```bash
cd Munnetra/frontend
```

### Step 2 — Install dependencies
```bash
npm install
```

### Step 3 — Start the frontend
```bash
npm start
```

This will automatically open your browser at: **http://localhost:3000**

If it doesn't open automatically, navigate to `http://localhost:3000` manually.

---

## 6. Running the Application

You need **two terminals running simultaneously**:

| Terminal | Command | URL |
|---|---|---|
| Terminal 1 (Backend) | `cd backend && npm run dev` | http://localhost:5000 |
| Terminal 2 (Frontend) | `cd frontend && npm start` | http://localhost:3000 |

---

## 7. Demo Walkthrough

Use these credentials to explore each role:

| Role     | Email                | Password  |
|----------|----------------------|-----------|
| Employee | employee@demo.com    | demo1234  |
| Manager  | manager@demo.com     | demo1234  |
| Admin    | admin@demo.com       | demo1234  |

---

### Employee Journey

1. Go to `http://localhost:3000` and log in as **employee@demo.com / demo1234**
2. Click **Create Goal Sheet** to start a new sheet for the current cycle
3. Click **+ Add Goal** and fill in:
   - Thrust Area (dropdown)
   - Goal Title and Description
   - Unit of Measurement (UoM)
   - Target Value or Date
   - Weightage (minimum 10%)
4. Add more goals — the **Total Weightage** counter updates live
   - Counter turns **green** when total = 100%
   - Counter turns **red** when total ≠ 100%
5. Once total weightage = 100%, click **Submit for Approval**
6. The sheet status changes to `submitted` — goals are no longer editable

---

### Manager Journey

1. Log in as **manager@demo.com / demo1234**
2. The **Team Dashboard** shows all team members and their sheet statuses
3. Click **Review →** next to the employee who submitted
4. On the review page:
   - Edit **Target Value** or **Weightage** inline for any goal, then click **Save**
   - Click **✓ Approve & Lock** to approve — all goals become locked
   - Or click **Return for Rework** — enter a comment and send back to the employee
5. After approval, the sheet status changes to `approved` and goals show a 🔒 lock icon

---

### Admin Journey

1. Log in as **admin@demo.com / demo1234**
2. The Admin Dashboard has 3 tabs:

   **Sheets Tab**
   - View all goal sheets across the organisation
   - Filter by Status or Department
   - Unlock a locked goal by entering the Goal ID and a reason

   **Shared Goals Tab**
   - Push a departmental KPI to multiple employees at once
   - Fill in the goal details, select employees via checkboxes, click **Push Shared Goal**
   - Selected employees will see the goal on their sheet — title and target are read-only for them

   **Audit Log Tab**
   - View a full history of all approval actions (approved, returned, edited, unlocked)
   - Shows who did what and when

---

### Full End-to-End Flow

```
Employee creates sheet
       ↓
Employee adds goals (total weightage = 100%)
       ↓
Employee submits sheet
       ↓
Manager reviews → edits inline if needed
       ↓
Manager approves → goals locked
       ↓
(Optional) Admin unlocks a goal → audit log entry created
       ↓
(Optional) Admin pushes shared goal → appears on employee sheets
```

---

## 8. Troubleshooting

### ❌ `ECONNREFUSED` or `database connection failed`
- PostgreSQL is not running. Start the service (see Section 2, Step 1).
- Double-check `DATABASE_URL` in `backend/.env` — password, username, and database name must be correct.

### ❌ `database "goal_tracker" does not exist`
- You haven't created the database yet. Run:
  ```bash
  psql -U postgres -c "CREATE DATABASE goal_tracker;"
  ```

### ❌ `npm run migrate` fails with permission error
- Your PostgreSQL user may not have CREATE TABLE privileges. Connect as a superuser or grant privileges:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE goal_tracker TO postgres;
  ```

### ❌ Frontend shows blank page or routing errors
- Make sure the backend is running on port 5000 before starting the frontend.
- Check the browser console (F12) for CORS or network errors.

### ❌ `npm install` fails
- Delete `node_modules/` and `package-lock.json`, then retry:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### ❌ Port 5000 already in use
- Change the port in `backend/.env`:
  ```env
  PORT=5001
  ```
- Then update the API base URL in `frontend/src/api/client.js`:
  ```js
  baseURL: 'http://localhost:5001/api'
  ```

### ❌ Login returns "Invalid credentials"
- The seed script hasn't been run yet. Run `npm run seed` from the `backend/` folder.
- Or the database was reset — re-run `npm run migrate && npm run seed`.

### ❌ Submit button stays disabled
- Total weightage across all goals must equal exactly **100%**.
- Check the weightage counter at the top of the goal sheet — it shows the current total.

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

# Every time you want to run the app (2 terminals)
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```
