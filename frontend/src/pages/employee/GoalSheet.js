import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import GoalForm from '../../components/GoalForm';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rework: 'bg-red-100 text-red-700',
};

export default function EmployeeGoalSheet() {
  const [sheet, setSheet] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/goal-sheets/mine');
    setSheet(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createSheet() {
    try {
      await api.post('/goal-sheets');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create sheet');
    }
  }

  async function deleteGoal(id) {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goal-sheets/goals/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  async function submitSheet() {
    setError(''); setMessage('');
    try {
      await api.post(`/goal-sheets/${sheet.id}/submit`);
      setMessage('Goal sheet submitted for manager approval.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    }
  }

  const goals = sheet?.goals || [];
  const totalWeightage = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const isEditable = sheet && ['draft', 'rework'].includes(sheet.status);
  const canSubmit = isEditable && goals.length > 0 && Math.round(totalWeightage) === 100;

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

        {message && <p className="text-green-600 bg-green-50 p-3 rounded-lg text-sm mb-4">{message}</p>}
        {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4">{error}</p>}

        {!sheet ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">No goal sheet for this cycle yet.</p>
            <button onClick={createSheet} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Create Goal Sheet
            </button>
          </div>
        ) : (
          <>
            {/* Rework comment */}
            {sheet.status === 'rework' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-sm text-orange-700">
                Your sheet was returned for rework. Please update your goals and resubmit.
              </div>
            )}

            {/* Weightage counter */}
            <div className={`flex items-center justify-between p-4 rounded-lg mb-4 ${Math.round(totalWeightage) === 100 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <span className="text-sm font-medium text-gray-700">Total Weightage</span>
              <span className={`text-lg font-bold ${Math.round(totalWeightage) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                {totalWeightage.toFixed(0)}% / 100%
              </span>
            </div>

            {/* Goals list */}
            <div className="space-y-3 mb-4">
              {goals.length === 0 && (
                <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">No goals added yet.</div>
              )}
              {goals.map(goal => (
                <div key={goal.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{goal.title}</span>
                      {goal.is_shared && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>
                      )}
                      {goal.is_locked && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 Locked</span>
                      )}
                    </div>
                    {goal.description && <p className="text-xs text-gray-500 mb-1">{goal.description}</p>}
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>UoM: {goal.uom_type}</span>
                      {goal.target_value && <span>Target: {goal.target_value}</span>}
                      {goal.target_date && <span>By: {goal.target_date?.slice(0, 10)}</span>}
                      <span className="font-medium text-gray-600">Weight: {goal.weightage}%</span>
                    </div>
                  </div>
                  {isEditable && !goal.is_locked && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setEditGoal(goal); setShowForm(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteGoal(goal.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {isEditable && goals.length < 8 && (
                <button onClick={() => { setEditGoal(null); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  + Add Goal
                </button>
              )}
              {isEditable && (
                <button
                  onClick={submitSheet}
                  disabled={!canSubmit}
                  title={!canSubmit ? 'Total weightage must be 100% and at least 1 goal required' : ''}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
    </div>
  );
}
