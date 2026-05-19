import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import GoalForm from '../../components/GoalForm';
import Toast from '../../components/Toast';
import { useWindow } from '../../context/WindowContext';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rework:    'bg-red-100 text-red-700',
};

function WeightageDonut({ total }) {
  const pct = Math.min(Math.round(total), 100);
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct === 100 ? '#16a34a' : total > 100 ? '#dc2626' : '#d97706';
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{Math.round(total)}%</span>
      </div>
    </div>
  );
}

export default function EmployeeGoalSheet() {
  const [sheet, setSheet] = useState(null);
  const [reworkComment, setReworkComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = (message, type = 'success') => setToast({ message, type });

  const load = useCallback(async () => {
    const { data } = await api.get('/goal-sheets/mine');
    setSheet(data);
    if (data?.status === 'rework' && data?.id) {
      try {
        const { data: rc } = await api.get(`/goal-sheets/${data.id}/rework-comment`);
        setReworkComment(rc.comment || '');
      } catch { /* non-critical */ }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createSheet() {
    try {
      await api.post('/goal-sheets');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create sheet', 'error');
    }
  }

  async function deleteGoal(id) {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goal-sheets/goals/${id}`);
      showToast('Goal deleted.');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  }

  async function submitSheet() {
    try {
      await api.post(`/goal-sheets/${sheet.id}/submit`);
      showToast('Goal sheet submitted for manager approval.');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Submission failed', 'error');
    }
  }

  const { activeWindow } = useWindow();
  const windowOpen = activeWindow === undefined || activeWindow?.action === 'goal_setting';
  const goals = sheet?.goals || [];
  const totalWeightage = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const isEditable = sheet && windowOpen;
  const canSubmit = sheet && ['draft', 'rework'].includes(sheet.status) && windowOpen && goals.length > 0 && Math.round(totalWeightage) === 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Goal Sheet</h1>
            <p className="text-gray-500 text-sm">Cycle Year: {new Date().getFullYear()}</p>
          </div>
          {sheet && (
            <span className={`text-sm px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[sheet.status]}`}>
              {sheet.status}
            </span>
          )}
        </div>

        {activeWindow !== undefined && !windowOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
            <p className="font-medium">Goal editing is currently disabled.</p>
            <p className="text-xs mt-1">
              Active window: <span className="font-mono">{activeWindow ? `${activeWindow.action} (${activeWindow.label})` : 'none'}</span>.
              {' '}To enable editing, log in as Admin → Cycle Windows → click <strong>Set Active Now</strong> on the <strong>Goal Setting</strong> row.
            </p>
          </div>
        )}

        {!sheet ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-gray-500 mb-4">No goal sheet for this cycle yet.</p>
            <button
              onClick={createSheet}
              disabled={!windowOpen}
              title={!windowOpen ? 'Goal creation is only available during the Goal Setting window (May–Jun)' : ''}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Create Goal Sheet
            </button>
            {!windowOpen && <p className="text-xs text-gray-400 mt-2">Goal creation opens in May.</p>}
          </div>
        ) : (
          <>
            {sheet.status === 'rework' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-sm text-orange-800">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">Your sheet was returned for rework. Please update your goals and resubmit.</p>
                    {reworkComment && (
                      <p className="mt-1 text-orange-700 bg-orange-100 rounded px-2 py-1 text-xs">
                        Manager's comment: "{reworkComment}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Weightage donut */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm mb-4">
              <WeightageDonut total={totalWeightage} />
              <div>
                <p className="text-sm font-medium text-gray-700">Total Weightage</p>
                <p className={`text-xs mt-0.5 ${Math.round(totalWeightage) === 100 ? 'text-green-600' : totalWeightage > 100 ? 'text-red-500' : 'text-yellow-600'}`}>
                  {Math.round(totalWeightage) === 100
                    ? '✓ Ready to submit'
                    : totalWeightage > 100
                    ? `Over by ${(totalWeightage - 100).toFixed(0)}% — reduce a goal's weightage`
                    : goals.length > 0 ? `${(100 - totalWeightage).toFixed(0)}% remaining to allocate` : 'Add goals to get started'}
                </p>
              </div>
              <div className="ml-auto text-right">
                <span className={`text-2xl font-bold ${Math.round(totalWeightage) === 100 ? 'text-green-600' : totalWeightage > 100 ? 'text-red-500' : 'text-yellow-600'}`}>
                  {totalWeightage.toFixed(0)}%
                </span>
                <p className="text-xs text-gray-400">/ 100%</p>
              </div>
            </div>

            {/* Goals list */}
            <div className="space-y-3 mb-4">
              {goals.length === 0 && (
                <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">No goals added yet.</div>
              )}
              {goals.map(goal => {
                const locked = goal.is_locked === true || goal.is_locked === 'true';
                return (
                  <div key={goal.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800 text-sm">{goal.title}</span>
                        {goal.is_shared && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>
                        )}
                        {locked && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 Locked</span>
                        )}
                      </div>
                      {goal.description && <p className="text-xs text-gray-500 mb-1">{goal.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>UoM: {goal.uom_type}</span>
                        {goal.target_value && <span>Target: {goal.target_value}</span>}
                        {goal.target_date && <span>By: {goal.target_date?.slice(0, 10)}</span>}
                        <span className="font-medium text-gray-600">Weight: {goal.weightage}%</span>
                      </div>
                    </div>
                    {isEditable && !locked && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditGoal(goal); setShowForm(true); }}
                          className="text-xs text-blue-600 hover:underline"
                        >Edit</button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-xs text-red-500 hover:underline"
                        >Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              {isEditable && goals.length < 8 && (
                <button
                  onClick={() => { setEditGoal(null); setShowForm(true); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  + Add Goal
                </button>
              )}
              {isEditable && (
                <button
                  onClick={submitSheet}
                  disabled={!canSubmit}
                  title={!canSubmit ? 'Total weightage must be 100% and at least 1 goal required' : ''}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Submit for Approval
                </button>
              )}
            </div>
            {isEditable && !canSubmit && goals.length > 0 && (
              <p className="text-xs text-red-500 mt-2">Total weightage must equal 100% before submitting.</p>
            )}
          </>
        )}
      </div>

      {showForm && (
        <GoalForm
          goal={editGoal}
          sheetId={sheet?.id}
          onSave={() => { setShowForm(false); setEditGoal(null); load(); }}
          onClose={() => { setShowForm(false); setEditGoal(null); }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
