import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import { useWindow } from '../../context/WindowContext';

const TABS = ['Sheets', 'Shared Goals', 'Audit Log', 'Cycle Windows'];

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rework:    'bg-red-100 text-red-700',
};

const ACTION_BADGE = {
  approved: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
  unlocked: 'bg-orange-100 text-orange-700',
  edited:   'bg-blue-100 text-blue-700',
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

  const { refresh: refreshWindow } = useWindow();
  const [windows, setWindows] = useState([]);
  const [windowEdits, setWindowEdits] = useState({});

  useEffect(() => {
    loadSheets();
    api.get('/admin/employees').then(r => setEmployees(r.data));
    api.get('/thrust-areas').then(r => setThrustAreas(r.data));
  }, []);

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

  async function loadAudit() {
    const { data } = await api.get('/admin/audit-log');
    setAuditLog(data);
  }

  useEffect(() => { if (tab === 'Audit Log') loadAudit(); }, [tab]);

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

  async function pushSharedGoal(e) {
    e.preventDefault();
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

        {message && <p className="text-green-600 bg-green-50 p-3 rounded-lg text-sm mb-4">{message}</p>}
        {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4">{error}</p>}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
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
