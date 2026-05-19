import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import { useWindow } from '../../context/WindowContext';
import AnalyticsTab from './AnalyticsTab';

const TABS = ['Sheets', 'Shared Goals', 'Audit Log', 'Completion', 'Reports', 'Escalations', 'Analytics', 'Cycle Windows', 'Org Hierarchy'];

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rework:    'bg-red-100 text-red-700',
};

const ACTION_BADGE = {
  approved:             'bg-green-100 text-green-700',
  returned:             'bg-red-100 text-red-700',
  unlocked:             'bg-orange-100 text-orange-700',
  edited:               'bg-blue-100 text-blue-700',
  checkin:              'bg-teal-100 text-teal-700',
  achievement_updated:  'bg-indigo-100 text-indigo-700',
};

export default function AdminDashboard() {
  const bellRef = useRef(null);

  const [tab, setTab] = useState('Sheets');
  const [sheets, setSheets] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [filters, setFilters] = useState({ status: '', department: '' });
  const [unlockGoalId, setUnlockGoalId] = useState('');
  const [unlockComment, setUnlockComment] = useState('');
  const [sharedForm, setSharedForm] = useState({
    thrust_area_id: '', title: '', description: '',
    uom_type: 'numeric_min', target_value: '', target_date: '', weightage: '', employee_ids: [],
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [unlockReasons, setUnlockReasons] = useState({});
  // confirmUnlock: { goalId, goalTitle, isShared, reason, isManual? }
  const [confirmUnlock, setConfirmUnlock] = useState(null);

  const [reportData, setReportData] = useState([]);
  const [reportFilters, setReportFilters] = useState({ department: '', cycle_year: new Date().getFullYear() });
  const [completionData, setCompletionData] = useState([]);
  const [completionDept, setCompletionDept] = useState('');

  const [escalations, setEscalations] = useState([]);
  const [escalationFilters, setEscalationFilters] = useState({ type: '', resolved: 'false', department: '' });

  const [orgUsers, setOrgUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [orgMessage, setOrgMessage] = useState('');
  const [orgError, setOrgError] = useState('');

  const { refresh: refreshWindow } = useWindow();
  const [windows, setWindows] = useState([]);
  const [windowEdits, setWindowEdits] = useState({});

  useEffect(() => {
    loadSheets(); // eslint-disable-line react-hooks/exhaustive-deps
    api.get('/admin/employees').then(r => setEmployees(r.data));
    api.get('/thrust-areas').then(r => setThrustAreas(r.data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'Cycle Windows') loadWindows(); }, [tab]);

  async function loadSheets() {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.department) params.set('department', filters.department);
    const { data } = await api.get(`/admin/goal-sheets?${params}`);
    setSheets(data);
  }

  async function loadWindows() {
    const { data } = await api.get('/checkin-windows');
    setWindows(data);
    const edits = {};
    data.forEach(w => { edits[w.id] = { opens_at: w.opens_at.slice(0,10), closes_at: w.closes_at.slice(0,10) }; });
    setWindowEdits(edits);
  }

  async function saveWindow(id) {
    setError(''); setMessage('');
    try {
      await api.put(`/checkin-windows/${id}`, windowEdits[id]);
      setMessage('Window updated.');
      loadWindows();
      refreshWindow();
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    }
  }

  async function activateNow(id) {
    setError(''); setMessage('');
    try {
      await api.put(`/checkin-windows/${id}/activate`);
      setMessage('Window set as active.');
      loadWindows();
      refreshWindow();
    } catch (err) {
      setError(err.response?.data?.error || 'Activation failed');
    }
  }

  async function loadCompletion() {
    const params = new URLSearchParams();
    if (completionDept) params.set('department', completionDept);
    const { data } = await api.get(`/admin/completion-dashboard?${params}`);
    setCompletionData(data);
  }

  async function loadReport() {
    const params = new URLSearchParams();
    if (reportFilters.department) params.set('department', reportFilters.department);
    if (reportFilters.cycle_year) params.set('cycle_year', reportFilters.cycle_year);
    const { data } = await api.get(`/admin/achievement-report?${params}`);
    setReportData(data);
  }

  function exportCSV() {
    if (!reportData.length) return;
    const headers = [
      'Employee', 'Email', 'Department', 'Goal Title', 'Thrust Area', 'UoM',
      'Target Value', 'Target Date', 'Weightage',
      'Q1 Actual', 'Q1 Score%', 'Q1 Status',
      'Q2 Actual', 'Q2 Score%', 'Q2 Status',
      'Q3 Actual', 'Q3 Score%', 'Q3 Status',
      'Q4 Actual', 'Q4 Score%', 'Q4 Status',
    ];
    const rows = reportData.map(r => [
      r.employee_name, r.email, r.department, r.goal_title, r.thrust_area || '', r.uom_type,
      r.target_value ?? '', r.target_date ? r.target_date.slice(0,10) : '', r.weightage,
      r.q1_actual ?? '', r.q1_score != null ? Math.round(r.q1_score * 100) + '%' : '', r.q1_status || '',
      r.q2_actual ?? '', r.q2_score != null ? Math.round(r.q2_score * 100) + '%' : '', r.q2_status || '',
      r.q3_actual ?? '', r.q3_score != null ? Math.round(r.q3_score * 100) + '%' : '', r.q3_status || '',
      r.q4_actual ?? '', r.q4_score != null ? Math.round(r.q4_score * 100) + '%' : '', r.q4_status || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `achievement_report_${reportFilters.cycle_year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => { if (tab === 'Escalations') loadEscalations(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'Org Hierarchy') return; // eslint-disable-line react-hooks/exhaustive-deps
    api.get('/admin/users').then(r => {
      setOrgUsers(r.data);
      setManagers(r.data.filter(u => u.role === 'manager'));
    });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reassignManager(employeeId, managerId) {
    setOrgError(''); setOrgMessage('');
    try {
      await api.put(`/admin/users/${employeeId}/manager`, { manager_id: managerId || null });
      setOrgMessage('Manager updated.');
      const r = await api.get('/admin/users');
      setOrgUsers(r.data);
    } catch (err) {
      setOrgError(err.response?.data?.error || 'Update failed');
    }
  }

  async function loadEscalations() {
    const params = new URLSearchParams();
    if (escalationFilters.type) params.set('type', escalationFilters.type);
    if (escalationFilters.resolved !== '') params.set('resolved', escalationFilters.resolved);
    if (escalationFilters.department) params.set('department', escalationFilters.department);
    const { data } = await api.get(`/admin/escalations?${params}`);
    setEscalations(data);
  }

  async function resolveEscalation(id) {
    await api.put(`/admin/escalations/${id}/resolve`);
    loadEscalations();
  }

  async function loadAudit() {
    const { data } = await api.get('/admin/audit-log');
    setAuditLog(data);
  }

  useEffect(() => { if (tab === 'Audit Log') loadAudit(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'Completion') loadCompletion(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'Reports') loadReport(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openSheet(sheetId) {
    const { data } = await api.get(`/admin/goal-sheets/${sheetId}`);
    setSelectedSheet(data);
    setUnlockReasons({});
    setError(''); setMessage('');
  }

  // Called from modal — stages the confirmation popup
  function requestUnlock(goal) {
    const reason = unlockReasons[goal.id];
    if (!reason?.trim()) { setError(`Enter a reason for Goal #${goal.id}`); return; }
    setError('');
    setConfirmUnlock({ goalId: goal.id, goalTitle: goal.title, isShared: goal.is_shared, reason });
  }

  // Called from manual fallback input — stages the confirmation popup
  function requestManualUnlock() {
    if (!unlockGoalId || !unlockComment) { setError('Goal ID and reason are required'); return; }
    setError('');
    setConfirmUnlock({ goalId: unlockGoalId, goalTitle: `Goal #${unlockGoalId}`, isShared: false, reason: unlockComment, isManual: true });
  }

  // Executes the actual unlock after confirmation
  async function executeUnlock() {
    const { goalId, reason, isManual } = confirmUnlock;
    setConfirmUnlock(null);
    try {
      await api.post(`/admin/goals/${goalId}/unlock`, { comment: reason });
      setMessage(`Goal #${goalId} unlocked.`);
      if (isManual) { setUnlockGoalId(''); setUnlockComment(''); }
      else openSheet(selectedSheet.id);
      // Refresh notification bell
      bellRef.current?.fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.error || 'Unlock failed');
    }
  }

  async function pushSharedGoal(ev) {
    ev.preventDefault();
    setError(''); setMessage('');
    if (!sharedForm.employee_ids.length) { setError('Select at least one employee'); return; }
    try {
      await api.post('/shared-goals', { ...sharedForm, employee_ids: sharedForm.employee_ids.map(Number) });
      setMessage('Shared goal pushed to selected employees.');
      setSharedForm({ thrust_area_id: '', title: '', description: '', uom_type: 'numeric_min', target_value: '', target_date: '', weightage: '', employee_ids: [] });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to push shared goal');
    }
  }

  function toggleEmployee(id) {
    setSharedForm(f => ({
      ...f,
      employee_ids: f.employee_ids.includes(id) ? f.employee_ids.filter(e => e !== id) : [...f.employee_ids, id],
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar bellRef={bellRef} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

        {message && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg text-sm mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Sheets Tab ── */}
        {tab === 'Sheets' && (
          <>
            <div className="flex gap-3 mb-4">
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {['draft', 'submitted', 'approved', 'rework'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="Filter by department" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} />
              <button onClick={loadSheets} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Filter</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cycle</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sheets.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openSheet(s.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{s.employee_name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.department || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.cycle_year}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-blue-500 text-xs">View Goals →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Manual unlock fallback */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Unlock a Locked Goal</h2>
              <p className="text-xs text-gray-400 mb-3">Tip: click any row above to view goals and unlock directly — or enter a Goal ID manually below.</p>
              <div className="flex gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Goal ID</label>
                  <input type="number" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28" value={unlockGoalId} onChange={e => setUnlockGoalId(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Reason *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Reason for unlocking…" value={unlockComment} onChange={e => setUnlockComment(e.target.value)} />
                </div>
                <button onClick={requestManualUnlock} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">Unlock</button>
              </div>
            </div>

            {/* Sheet Goals Modal */}
            {selectedSheet && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">{selectedSheet.employee_name}'s Goals</h2>
                      <p className="text-xs text-gray-400">{selectedSheet.email} · Cycle {selectedSheet.cycle_year}</p>
                    </div>
                    <button onClick={() => setSelectedSheet(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                  </div>

                  {error && <p className="text-red-500 bg-red-50 p-2 rounded text-sm mb-3">{error}</p>}
                  {message && <p className="text-green-600 bg-green-50 p-2 rounded text-sm mb-3">{message}</p>}

                  <div className="space-y-3">
                    {(selectedSheet.goals || []).map(goal => (
                      <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">ID: {goal.id}</span>
                          {goal.is_locked && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 Locked</span>}
                          {goal.is_shared && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>}
                        </div>
                        <p className="font-medium text-gray-800 text-sm">{goal.title}</p>
                        {goal.thrust_area_name && (
                          <p className="text-xs text-gray-400">{goal.thrust_area_name} · {goal.uom_type} · Weight: {goal.weightage}%</p>
                        )}
                        {goal.is_locked && (
                          <div className="mt-3">
                            {goal.is_shared && (
                              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 mb-2">
                                ⚠ Shared goal — after unlock, recipient can only change weightage.
                              </p>
                            )}
                            <div className="flex gap-2">
                              <input
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
                                placeholder="Reason for unlocking…"
                                value={unlockReasons[goal.id] || ''}
                                onChange={e => setUnlockReasons(r => ({ ...r, [goal.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => requestUnlock(goal)}
                                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-600 whitespace-nowrap"
                              >
                                Unlock
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Shared Goals Tab ── */}
        {tab === 'Shared Goals' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
            <h2 className="font-semibold text-gray-800 mb-4">Push Shared Goal to Employees</h2>
            <form onSubmit={pushSharedGoal} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thrust Area</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={sharedForm.thrust_area_id} onChange={e => setSharedForm(f => ({ ...f, thrust_area_id: e.target.value }))}>
                  <option value="">Select</option>
                  {thrustAreas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
                <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={sharedForm.title} onChange={e => setSharedForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={sharedForm.description} onChange={e => setSharedForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">UoM *</label>
                  <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={sharedForm.uom_type} onChange={e => setSharedForm(f => ({ ...f, uom_type: e.target.value }))}>
                    <option value="numeric_min">Numeric Min</option>
                    <option value="numeric_max">Numeric Max</option>
                    <option value="timeline">Timeline</option>
                    <option value="zero">Zero-based</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                  <input type="number" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28" value={sharedForm.target_value} onChange={e => setSharedForm(f => ({ ...f, target_value: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weightage (%)</label>
                  <input required type="number" min="10" max="100" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" value={sharedForm.weightage} onChange={e => setSharedForm(f => ({ ...f, weightage: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Employees *</label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={sharedForm.employee_ids.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                      <span>{emp.name} <span className="text-gray-400">({emp.department})</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Push Shared Goal
              </button>
            </form>
          </div>
        )}

        {/* ── Audit Log Tab ── */}
        {tab === 'Audit Log' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sheet ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Comment</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLog.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{log.actor_name}</div>
                      <div className="text-xs text-gray-400">{log.actor_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${ACTION_BADGE[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.goal_sheet_id}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{log.comment || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Completion Dashboard Tab ── */}
        {tab === 'Completion' && (
          <>
            <div className="flex gap-3 mb-4">
              <input
                placeholder="Filter by department"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={completionDept}
                onChange={e => setCompletionDept(e.target.value)}
              />
              <button onClick={loadCompletion} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Filter</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Manager</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Dept</th>
                    {['Q1 (Jul–Sep)', 'Q2 (Oct–Dec)', 'Q3 (Jan–Feb)', 'Q4 (Mar–Apr)'].map(q => (
                      <th key={q} className="text-center px-3 py-3 font-medium text-gray-600" colSpan={2}>{q}</th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th colSpan={3}></th>
                    {[1,2,3,4].map(n => (
                      <>
                        <th key={`e${n}`} className="text-center px-2 py-1 text-xs text-gray-400 font-normal">Emp</th>
                        <th key={`m${n}`} className="text-center px-2 py-1 text-xs text-gray-400 font-normal">Mgr</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completionData.map(row => {
                    const cell = done => done
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-300">—</span>;
                    return (
                      <tr key={row.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{row.employee_name}</div>
                          <div className="text-xs text-gray-400">{row.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{row.manager_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{row.department || '—'}</td>
                        <td className="text-center px-2 py-3">{cell(row.q1_employee_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q1_manager_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q2_employee_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q2_manager_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q3_employee_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q3_manager_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q4_employee_done)}</td>
                        <td className="text-center px-2 py-3">{cell(row.q4_manager_done)}</td>
                      </tr>
                    );
                  })}
                  {completionData.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-8 text-gray-400">No data found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Achievement Report Tab ── */}
        {tab === 'Reports' && (
          <>
            <div className="flex gap-3 mb-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Department</label>
                <input
                  placeholder="All departments"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={reportFilters.department}
                  onChange={e => setReportFilters(f => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cycle Year</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
                  value={reportFilters.cycle_year}
                  onChange={e => setReportFilters(f => ({ ...f, cycle_year: e.target.value }))}
                />
              </div>
              <button onClick={loadReport} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Load</button>
              <button
                onClick={exportCSV}
                disabled={!reportData.length}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Goal</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Thrust Area</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">UoM</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600" colSpan={2}>Q1 (Jul–Sep)</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600" colSpan={2}>Q2 (Oct–Dec)</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600" colSpan={2}>Q3 (Jan–Feb)</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600" colSpan={2}>Q4 (Mar–Apr)</th>
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
                    <th colSpan={5}></th>
                    {[1,2,3,4].map(n => (
                      <>
                        <th key={`a${n}`} className="text-center px-2 py-1 font-normal">Actual</th>
                        <th key={`s${n}`} className="text-center px-2 py-1 font-normal">Score</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{r.employee_name}</div>
                        <div className="text-xs text-gray-400">{r.department}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={r.goal_title}>{r.goal_title}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.thrust_area || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.uom_type}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.uom_type === 'timeline' ? (r.target_date?.slice(0,10) || '—') : (r.target_value ?? '—')}
                      </td>
                      {[['q1_actual','q1_date','q1_score','q1_status'],['q2_actual','q2_date','q2_score','q2_status'],
                        ['q3_actual','q3_date','q3_score','q3_status'],['q4_actual','q4_date','q4_score','q4_status']
                      ].map(([act, dt, sc, st], qi) => (
                        <>
                          <td key={`a${qi}`} className="text-center px-2 py-3 text-gray-600">
                            {r.uom_type === 'timeline' ? (r[dt]?.slice(0,10) || '—') : (r[act] ?? '—')}
                          </td>
                          <td key={`s${qi}`} className="text-center px-2 py-3">
                            {r[sc] != null
                              ? <span className={`text-xs font-medium ${
                                  r[sc] >= 0.7 ? 'text-green-600' : r[sc] >= 0.4 ? 'text-orange-500' : 'text-red-500'
                                }`}>{Math.round(r[sc] * 100)}%</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </>
                      ))}
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr><td colSpan={13} className="text-center py-8 text-gray-400">Click Load to fetch the report.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Escalations Tab ── */}
        {tab === 'Escalations' && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={escalationFilters.type}
                onChange={e => setEscalationFilters(f => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="goal_not_submitted">Goal Not Submitted</option>
                <option value="approval_overdue">Approval Overdue</option>
                <option value="checkin_overdue">Check-in Overdue</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={escalationFilters.resolved}
                onChange={e => setEscalationFilters(f => ({ ...f, resolved: e.target.value }))}>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
                <option value="">All</option>
              </select>
              <input placeholder="Filter by department" className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={escalationFilters.department}
                onChange={e => setEscalationFilters(f => ({ ...f, department: e.target.value }))} />
              <button onClick={loadEscalations} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Filter</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Manager</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Level</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {escalations.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No escalations found.</td></tr>
                  )}
                  {escalations.map(e => {
                    const typeBadge = {
                      goal_not_submitted: 'bg-red-100 text-red-700',
                      approval_overdue:   'bg-orange-100 text-orange-700',
                      checkin_overdue:    'bg-yellow-100 text-yellow-700',
                    }[e.type] || 'bg-gray-100 text-gray-600';
                    const typeLabel = {
                      goal_not_submitted: 'Goal Not Submitted',
                      approval_overdue:   'Approval Overdue',
                      checkin_overdue:    'Check-in Overdue',
                    }[e.type] || e.type;
                    const levelLabel = { 1: 'L1 Employee', 2: 'L2 Manager', 3: 'L3 Admin' }[e.level] || `L${e.level}`;
                    return (
                      <tr key={e.id} className={`hover:bg-gray-50 ${e.resolved ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{e.employee_name}</div>
                          <div className="text-xs text-gray-400">{e.department}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{e.manager_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeBadge}`}>{typeLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{levelLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{e.message}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {e.resolved
                            ? <span className="text-xs text-green-600 font-medium">✓ Resolved</span>
                            : <span className="text-xs text-amber-600 font-medium">Pending</span>}
                        </td>
                        <td className="px-4 py-3">
                          {!e.resolved && (
                            <button onClick={() => resolveEscalation(e.id)}
                              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 whitespace-nowrap">
                              Mark Resolved
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Org Hierarchy Tab ── */}
        {tab === 'Org Hierarchy' && (
          <>
            {orgMessage && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg text-sm mb-4">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {orgMessage}
              </div>
            )}
            {orgError && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm mb-4">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {orgError}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reporting Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orgUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.department || '—'}</td>
                      <td className="px-4 py-3">
                        {u.role === 'employee' ? (
                          <select
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                            value={u.manager_id || ''}
                            onChange={ev => reassignManager(u.id, ev.target.value)}
                          >
                            <option value="">No Manager</option>
                            {managers.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400 text-xs">{u.manager_name || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Cycle Windows Tab ── */}
        {tab === 'Cycle Windows' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Opens</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Closes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {windows.map(w => {
                  const today = new Date();
                  const isActive = new Date(w.opens_at) <= today && new Date(w.closes_at) >= today;
                  const edit = windowEdits[w.id] || {};
                  return (
                    <tr key={w.id} className={isActive ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-800">{w.label}</td>
                      <td className="px-4 py-3">
                        {isActive
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs"
                          value={edit.opens_at || ''}
                          onChange={e => setWindowEdits(prev => ({ ...prev, [w.id]: { ...prev[w.id], opens_at: e.target.value } }))} />
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs"
                          value={edit.closes_at || ''}
                          onChange={e => setWindowEdits(prev => ({ ...prev, [w.id]: { ...prev[w.id], closes_at: e.target.value } }))} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          w.action === 'goal_setting' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>{w.action === 'goal_setting' ? 'Goal Setting' : 'Check-in'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => saveWindow(w.id)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                          {!isActive && (
                            <button onClick={() => activateNow(w.id)}
                              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 whitespace-nowrap">Set Active Now</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">Edit open/close dates and click Save. Use "Set Active Now" to immediately open a window for demo purposes.</p>
            </div>
          </div>
        )}

      </div>

      {/* ── Confirmation Popup ── */}
      {confirmUnlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Confirm Unlock</h3>
                <p className="text-xs text-gray-500">This action will be logged in the audit trail</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Goal: </span>{confirmUnlock.goalTitle}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Reason: </span>{confirmUnlock.reason}
              </p>
              {confirmUnlock.isShared && (
                <p className="text-xs text-blue-600 mt-1">⚠ Shared goal — recipient can only edit weightage after unlock.</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={executeUnlock}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Yes, Unlock
              </button>
              <button
                onClick={() => setConfirmUnlock(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
