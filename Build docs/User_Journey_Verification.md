# User Journey Verification Guide
### Goal Setting & Tracking Portal — BRD Sections 1 to 4

Use this file to verify every requirement from the Problem Statement is working correctly.
Each step tells you exactly what to do, what to look for, and what the expected result is.

---

## Before You Start

Make sure both servers are running:
```
Terminal 1 → cd backend && npm run dev   (http://localhost:5000)
Terminal 2 → cd frontend && npm start    (http://localhost:3000)
```

Open http://localhost:3000 in your browser.

---

## Setup Step — Activate the Goal Setting Window

Before testing Phase 1, the Goal Setting window must be active.

1. Log in as **admin@demo.com / demo1234**
2. Go to Admin Dashboard → **Cycle Windows** tab
3. Find the row labelled **Goal Setting (May–Jun)**
4. Click **Set Active Now**
5. ✅ The row highlights in blue and shows **Active** badge
6. ✅ The WindowBanner below the navbar turns **green** and shows "Goal Setting (May–Jun)"
7. Log out

---

## Journey 1 — Employee: Goal Sheet Creation (BRD 2.1)

**Login:** employee@demo.com / demo1234  
**Landing page:** `/employee`

---

### 1.1 Create a Goal Sheet

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click **Create Goal Sheet** | Sheet is created with status `draft` |
| 2 | Observe the page | Weightage counter shows **0% / 100%** in red |

---

### 1.2 Add Goals — Validation Rules (BRD 2.1 Validation)

**Test: Minimum weightage rule (min 10%)**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click **+ Add Goal** | Goal form modal opens |
| 2 | Fill in Title, select any Thrust Area, UoM = Numeric Min, Target = 100 | — |
| 3 | Enter Weightage = **5** | Error: "Minimum weightage is 10%" |
| 4 | Change Weightage to **30** and click Save Goal | Goal saved, weightage counter shows 30% in red |

**Test: Add goals with all 4 UoM types**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Add a goal with UoM = **Numeric Min** (e.g. Sales Revenue, target 1000000, weight 25%) | Number input shown for target |
| 2 | Add a goal with UoM = **Numeric Max** (e.g. TAT in days, target 5, weight 25%) | Number input shown for target |
| 3 | Add a goal with UoM = **Timeline** (e.g. Project delivery, target date = any future date, weight 25%) | Date picker shown instead of number |
| 4 | Add a goal with UoM = **Zero** (e.g. Safety incidents, weight 20%) | No target value needed |
| 5 | Observe weightage counter | Shows **95% / 100%** in red |

**Test: Total weightage must equal 100% to submit**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click **Submit for Approval** with total = 95% | Button is disabled (greyed out) |
| 2 | Edit the Numeric Min goal, change weightage to **30%** | Counter shows **100% / 100%** in green |
| 3 | Submit button becomes active | ✅ Button is now clickable |

**Test: Maximum 8 goals rule**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Keep adding goals until you have 8 | **+ Add Goal** button disappears after 8th goal |
| 2 | Try via API: POST /api/goal-sheets/:id/goals with 9th goal | Returns 400: "Maximum 8 goals allowed per employee" |

---

### 1.3 Submit the Goal Sheet

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ensure total weightage = 100% (adjust if needed to reach exactly 100%) | Counter is green |
| 2 | Click **Submit for Approval** | Sheet status changes to `submitted` (yellow badge) |
| 3 | Try to edit or delete a goal | Edit/Delete buttons are gone — sheet is no longer editable |

---

### 1.4 Rework Flow

| Step | Action | Expected Result |
|---|---|---|
| 1 | Log in as **manager@demo.com** | — |
| 2 | Go to Team Goals → click **Review →** next to the employee | Sheet opens with all goals |
| 3 | Click **Return for Rework** | Modal appears requiring a comment |
| 4 | Submit without a comment | Error: comment is required |
| 5 | Enter a comment and click **Send Back** | Sheet status changes to `rework` (red badge) |
| 6 | Log back in as **employee@demo.com** | — |
| 7 | Observe the goal sheet | Orange rework banner shown, goals are editable again |
| 8 | Edit a goal, resubmit | Sheet status returns to `submitted` |

---

## Journey 2 — Manager: Goal Approval (BRD 2.1)

**Login:** manager@demo.com / demo1234  
**Landing page:** `/manager`

---

### 2.1 Team Dashboard

| Step | Action | Expected Result |
|---|---|---|
| 1 | View the Team Goals dashboard | Employee row shows with status badge |
| 2 | Observe the Check-ins column | Shows Q1/Q2/Q3/Q4 badges (all inactive since not approved yet) |

---

### 2.2 Inline Edit Before Approval

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click **Review →** next to the employee | Sheet opens with all goals and inline edit fields |
| 2 | Change the Target Value of the Numeric Min goal | Input field is editable |
| 3 | Click **Save** next to that goal | Goal updated, audit log entry created |
| 4 | Observe the weightage counter | Shows current total |

---

### 2.3 Approve the Sheet

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ensure total weightage = 100% | Counter is green |
| 2 | Click **✓ Approve & Lock** | Sheet status changes to `approved` (green badge) |
| 3 | Log in as **employee@demo.com** | — |
| 4 | View the goal sheet | All goals show 🔒 Locked badge, no edit/delete buttons |

---

## Journey 3 — Admin: Shared Goals (BRD 2.1 Shared Goals)

**Login:** admin@demo.com / demo1234

---

### 3.1 Push a Shared Goal

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Admin Dashboard → **Shared Goals** tab | Push shared goal form shown |
| 2 | Fill in: Thrust Area = Revenue Growth, Title = "Dept Revenue KPI", UoM = Numeric Min, Target = 500000, Weightage = 15% | — |
| 3 | Check the checkbox next to **Employee User** | Employee selected |
| 4 | Click **Push Shared Goal** | Success message shown |
| 5 | Log in as **employee@demo.com** | — |
| 6 | View the goal sheet | New goal appears with **Shared** blue badge |
| 7 | Try to edit the Title or Target of the shared goal | Fields are disabled / read-only |
| 8 | Edit the Weightage of the shared goal | ✅ Weightage field is editable |

---

### 3.2 Unlock a Locked Goal (BRD 2.1 Admin Intervention)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Admin Dashboard → **Sheets** tab | All sheets listed |
| 2 | Click on the employee's row | Modal opens showing all goals with their IDs |
| 3 | Find a locked goal (🔒 badge) | Unlock input and button shown |
| 4 | Click **Unlock** without entering a reason | Error: reason is required |
| 5 | Enter a reason and click **Unlock** | Confirmation popup appears |
| 6 | Click **Yes, Unlock** | Goal unlocked, audit log entry created |
| 7 | Log in as **employee@demo.com** | — |
| 8 | View the goal sheet | That goal no longer shows 🔒, is now editable |

---

## Journey 4 — Check-in Window Enforcement (BRD 2.3)

---

### 4.1 Block Actions Outside Their Window

**Test: Block goal creation outside goal-setting window**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Log in as **admin@demo.com** | — |
| 2 | Go to Cycle Windows → click **Set Active Now** on **Q1 Check-in** | Q1 window is now active, WindowBanner turns blue |
| 3 | Log in as **employee@demo.com** | — |
| 4 | Try to create a new goal sheet or submit | Buttons are disabled, amber notice shown |
| 5 | Try via API: POST /api/goal-sheets | Returns 403: "only available during the Goal Setting window" |

**Test: Block achievement logging outside check-in window**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Log in as **admin@demo.com** | — |
| 2 | Go to Cycle Windows → click **Set Active Now** on **Goal Setting** | Goal Setting window active |
| 3 | Log in as **employee@demo.com** → go to **Check-in** page | Amber notice: "Check-in inputs are disabled" |
| 4 | All actual inputs and Save buttons are disabled | ✅ Inputs greyed out |

---

### 4.2 WindowBanner Across All Roles

| Step | Action | Expected Result |
|---|---|---|
| 1 | With Q1 window active, log in as **employee@demo.com** | Blue banner: "Q1 Check-in (Jul–Sep) · July – September" |
| 2 | Log in as **manager@demo.com** | Same blue banner visible |
| 3 | Log in as **admin@demo.com** | Same blue banner visible |
| 4 | Go to Cycle Windows → set a window closing date to tomorrow | Banner turns **orange** with "Closes in 1 day" |
| 5 | Set all windows to past dates (no active window) | Banner turns **gray**: "Portal is currently between cycles" |

---

## Journey 5 — Employee: Quarterly Check-in (BRD 2.2)

**Pre-condition:** Q1 check-in window must be active (Admin → Cycle Windows → Set Active Now on Q1)  
**Pre-condition:** Employee must have an approved goal sheet

**Login:** employee@demo.com / demo1234  
**Navigate to:** Check-in (nav link)

---

### 5.1 Log Actual Achievement

| Step | Action | Expected Result |
|---|---|---|
| 1 | Observe the quarter tabs | Shows Q1 (Jul–Sep), Q2 (Oct–Dec), Q3 (Jan–Feb), Q4 (Mar–Apr) |
| 2 | Observe the active quarter banner | Calendar icon + "Q1 (Jul–Sep) · July – September" |
| 3 | For the **Numeric Min** goal: enter Actual Value = 750000, Status = On Track | — |
| 4 | Click **Save for Q1 (Jul–Sep)** | Progress score bar appears — should show ~75% (orange) |
| 5 | For the **Numeric Max** goal: enter Actual Value = 3 (better than target 5), Status = Completed | — |
| 6 | Click Save | Score bar shows 100% (green) — target ÷ actual = 5 ÷ 3 > 1, capped at 100% |
| 7 | For the **Timeline** goal: enter Actual Date = before the target date, Status = Completed | — |
| 8 | Click Save | Score bar shows 100% (green) |
| 9 | For the **Zero** goal: enter Actual Value = 0, Status = Completed | — |
| 10 | Click Save | Score bar shows 100% (green) — zero = success |
| 11 | For the **Zero** goal: change Actual Value to 2, Status = On Track | — |
| 12 | Click Save | Score bar shows 0% (red) — non-zero = failure |

---

### 5.2 Progress Score Formula Verification

| UoM | Target | Actual | Expected Score | Color |
|---|---|---|---|---|
| numeric_min | 1000000 | 750000 | 75% | Orange |
| numeric_min | 1000000 | 1200000 | 100% (capped) | Green |
| numeric_max | 5 | 3 | 100% (capped) | Green |
| numeric_max | 5 | 10 | 50% | Orange |
| timeline | 2025-12-31 | 2025-11-01 | 100% | Green |
| timeline | 2025-12-31 | 2026-01-15 | 0% | Red |
| zero | — | 0 | 100% | Green |
| zero | — | 1 | 0% | Red |

---

### 5.3 Shared Goal Actual is Read-Only

| Step | Action | Expected Result |
|---|---|---|
| 1 | Find the shared goal on the check-in page | Actual input is disabled, "Synced from source owner" label shown |
| 2 | Try to type in the actual field | Cannot type — field is disabled |

---

### 5.4 Re-save Within Window

| Step | Action | Expected Result |
|---|---|---|
| 1 | Change the Numeric Min actual from 750000 to 900000 | — |
| 2 | Click Save | Score updates to 90% (green) |
| 3 | Check Admin → Audit Log | Entry with action `achievement_updated` showing before/after values |

---

## Journey 6 — Manager: Check-in Review (BRD 2.2)

**Login:** manager@demo.com / demo1234

---

### 6.1 View Planned vs Actual

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Team Goals dashboard | Q1 column shows employee completion status |
| 2 | Click **Check-in →** next to the employee | Check-in review page opens |
| 3 | Observe the Q1 tab | Goals listed with Planned Target | Actual Achievement | Score columns |
| 4 | Verify Planned Target matches what was set during goal creation | ✅ Correct values shown |
| 5 | Verify Actual Achievement matches what employee logged | ✅ Correct values shown |
| 6 | Verify progress score bars are color-coded correctly | ✅ Red/orange/green based on score |

---

### 6.2 Submit Check-in Comment

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click **Submit Q1 (Jul–Sep) Check-in** without entering a comment | Error: "Comment is required" |
| 2 | Enter a comment: "Good progress on revenue goal. Timeline goal on track." | — |
| 3 | Click **Submit Q1 (Jul–Sep) Check-in** | Success message shown |
| 4 | Q1 tab shows ✓ indicator | ✅ Check-in marked as done |
| 5 | Go back to Team Dashboard | Q1 badge for this employee shows ✓ green |
| 6 | Check Admin → Audit Log | Entry with action `checkin` shown in teal |

---

### 6.3 Past Quarter is Read-Only

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click on Q2 tab | Goals shown but no actual values (not logged yet) |
| 2 | Click on Q1 tab again | Saved comment shown as read-only text with timestamp |
| 3 | Update comment textarea and click **Update Check-in** | Comment updated (upsert) |

---

## Journey 7 — Admin: Reporting & Governance (BRD Section 4)

**Login:** admin@demo.com / demo1234

---

### 7.1 Achievement Report (BRD 4 — Exportable Report)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Admin Dashboard → **Reports** tab | Filter controls and empty table shown |
| 2 | Click **Load** | Table populates with all employees' goals and Q1–Q4 actuals |
| 3 | Verify columns: Employee, Goal, Thrust Area, UoM, Target, Q1 Actual, Q1 Score%, Q2–Q4 | ✅ All columns present |
| 4 | Verify scores are color-coded: green ≥70%, orange 40–70%, red <40% | ✅ Colors match |
| 5 | Filter by Department = "Engineering" and click Load | Only Engineering employees shown |
| 6 | Click **Export CSV** | File `achievement_report_2025.csv` downloads |
| 7 | Open the CSV | Headers and data rows present, scores shown as percentages |

---

### 7.2 Completion Dashboard (BRD 4 — Real-time View)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Admin Dashboard → **Completion** tab | Grid table shown |
| 2 | Verify columns: Employee, Manager, Dept, Q1 Emp, Q1 Mgr, Q2 Emp, Q2 Mgr, Q3, Q4 | ✅ All columns present |
| 3 | Find the employee row | Q1 Emp = ✓ (achievement logged), Q1 Mgr = ✓ (check-in submitted) |
| 4 | Q2–Q4 columns | Show — (not done yet) |
| 5 | Filter by Department = "Engineering" | Only Engineering employees shown |

---

### 7.3 Audit Trail (BRD 4 — Post-lock Changes)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Admin Dashboard → **Audit Log** tab | Full history shown |
| 2 | Verify `approved` action exists | Green badge — manager approved the sheet |
| 3 | Verify `edited` action exists | Blue badge — manager edited a goal before approval |
| 4 | Verify `unlocked` action exists | Orange badge — admin unlocked a goal |
| 5 | Verify `checkin` action exists | Teal badge — manager submitted Q1 check-in |
| 6 | Verify `achievement_updated` action exists | Indigo badge — employee re-saved an achievement |
| 7 | Click on an `achievement_updated` row | Comment column shows before/after values |
| 8 | Verify `returned` action exists (from rework test) | Red badge — manager returned sheet |

---

### 7.4 Notification Bell (Admin Activity Feed)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Observe the bell icon in the navbar | Red badge showing unread count |
| 2 | Click the bell | Dropdown opens with activity feed |
| 3 | Verify all action types are shown with color-coded dots | ✅ Green/red/orange/blue/teal/indigo dots |
| 4 | Verify time-ago labels (e.g. "2m ago", "1h ago") | ✅ Relative timestamps shown |
| 5 | Close and reopen the bell | Badge resets to 0 (marked as read) |

---

## Journey 8 — User Roles & Access Control (BRD Section 3)

---

### 8.1 Role Separation

| Step | Action | Expected Result |
|---|---|---|
| 1 | Log in as **employee@demo.com** | Lands on `/employee`, sees My Goals + Check-in nav links only |
| 2 | Manually navigate to `/manager` | Redirected to `/login` |
| 3 | Manually navigate to `/admin` | Redirected to `/login` |
| 4 | Log in as **manager@demo.com** | Lands on `/manager`, sees Team Goals nav link only |
| 5 | Manually navigate to `/employee` | Redirected to `/login` |
| 6 | Manually navigate to `/admin` | Redirected to `/login` |
| 7 | Log in as **admin@demo.com** | Lands on `/admin`, sees notification bell only |
| 8 | Manually navigate to `/employee` | Redirected to `/login` |

---

### 8.2 Role-specific Capabilities Summary

| Capability | Employee | Manager | Admin |
|---|---|---|---|
| Create / submit goal sheet | ✅ | ❌ | ❌ |
| Approve / return goal sheet | ❌ | ✅ | ❌ |
| Inline edit goals before approval | ❌ | ✅ | ❌ |
| Push shared goals | ❌ | ✅ | ✅ |
| Unlock locked goals | ❌ | ❌ | ✅ |
| Log actual achievement | ✅ | ❌ | ❌ |
| Submit check-in comment | ❌ | ✅ | ❌ |
| View completion dashboard | ❌ | ❌ | ✅ |
| Export achievement CSV | ❌ | ❌ | ✅ |
| Manage cycle windows | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ✅ |

---

## Full End-to-End Sequence (Quick Demo Run)

Run these steps in order for a complete demo covering all BRD sections:

```
1.  Admin  → Cycle Windows → Set Active Now on Goal Setting
2.  Employee → Create Goal Sheet
3.  Employee → Add 4 goals (one per UoM type), total weightage = 100%
4.  Employee → Submit for Approval
5.  Manager → Review → Inline edit one goal → Approve & Lock
6.  Admin  → Shared Goals → Push a KPI to the employee
7.  Employee → View shared goal (read-only title/target, editable weightage)
8.  Admin  → Sheets → Unlock one goal → Confirm with reason
9.  Admin  → Audit Log → Verify approved + edited + unlocked entries
10. Admin  → Cycle Windows → Set Active Now on Q1 Check-in
11. Employee → Check-in → Log actuals for all 4 goals → Verify score bars
12. Manager → Check-in → View planned vs actual → Submit Q1 comment
13. Employee → Check-in → Re-save one achievement → Verify score updates
14. Admin  → Completion → Verify Q1 Emp ✓ and Q1 Mgr ✓
15. Admin  → Reports → Load → Verify data → Export CSV → Open file
16. Admin  → Audit Log → Verify checkin + achievement_updated entries
17. Admin  → Notification Bell → Verify unread count + activity feed
```

---

## Edge Cases to Spot-Check

| Scenario | How to Test | Expected |
|---|---|---|
| Submit with weightage ≠ 100% | Leave total at 95%, click Submit | Button disabled, red counter |
| Add 9th goal | Add 8 goals, try to add one more | + Add Goal button hidden |
| Approve with weightage ≠ 100% | Manager edits a goal to make total ≠ 100%, click Approve | 400 error: "Total weightage must equal 100%" |
| Shared goal recipient edits actual | Employee tries to type in shared goal actual field | Field disabled |
| Manager submits empty check-in | Leave comment blank, click Submit | Error: "Comment is required" |
| Unlock without reason | Click Unlock with empty reason field | Error: reason required |
| numeric_max with actual = 0 | Log actual = 0 for a numeric_max goal | Score = 100% (divide-by-zero guard) |
| No active window | Set all windows to past dates | All write actions disabled, gray banner |
