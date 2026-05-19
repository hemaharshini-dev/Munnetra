import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Navbar from '../../components/Navbar';

export default function ReviewSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null);
  const [edits, setEdits] = useState({});
  const [returnComment, setReturnComment] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/manager/team-sheets/${id}`);
    setSheet(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setEdit(goalId, field, value) {
    setEdits(e => ({ ...e, [goalId]: { ...e[goalId], [field]: value } }));
  }

  async function saveEdit(goalId) {
    if (!edits[goalId]) return;
    try {
      await api.put(`/manager/goals/${goalId}`, edits[goalId]);
      setMessage('Goal updated.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    }
  }

  async function approve() {
    setError(''); setMessage('');
    setApproving(true);
    try {
      await api.post(`/manager/team-sheets/${id}/approve`);
      setMessage('Sheet approved and goals locked.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  async function returnSheet() {
    if (!returnComment.trim()) { setError('Please enter a comment before returning.'); return; }
    setError('');
    try {
      await api.post(`/manager/team-sheets/${id}/return`, { comment: returnComment });
      setMessage('Sheet returned for rework.');
      setShowReturn(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Return failed');
    }
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const goals = sheet.goals || [];
  const totalWeightage = goals.reduce((s, g) => {
    const edited = edits[g.id]?.weightage;
    return s + parseFloat(edited !== undefined ? edited : g.weightage || 0);
  }, 0);

  const statusColors = {
    submitted: 'bg-yellow-100 text-yellow-700',
    approved:  'bg-green-100 text-green-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/manager')} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Dashboard
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Reviewing: {sheet.employee_name}</h1>
            <p className="text-gray-500 text-sm">{sheet.employee_email} · Cycle {sheet.cycle_year}</p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full font-medium capitalize ${statusColors[sheet.status] || 'bg-gray-100 text-gray-600'}`}>
            {sheet.status}
          </span>
        </div>

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

        {/* Weightage counter */}
        <div className={`flex items-center justify-between p-4 rounded-lg mb-4 ${Math.round(totalWeightage) === 100 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <span className="text-sm font-medium text-gray-700">Total Weightage</span>
          <span className={`text-lg font-bold ${Math.round(totalWeightage) === 100 ? 'text-green-600' : 'text-red-500'}`}>
            {totalWeightage.toFixed(0)}% / 100%
          </span>
        </div>

        <div className="space-y-3 mb-6">
          {goals.map(goal => {
            const isSubmitted = sheet.status === 'submitted';
            return (
              <div key={goal.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{goal.title}</span>
                      {goal.is_shared && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>}
                      {goal.is_locked && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 Locked</span>}
                    </div>
                    {goal.description && <p className="text-xs text-gray-500 mb-2">{goal.description}</p>}
                    <div className="flex gap-3 text-xs text-gray-400 mb-2">
                      <span>UoM: {goal.uom_type}</span>
                      {goal.thrust_area_name && <span>Area: {goal.thrust_area_name}</span>}
                    </div>
                    {isSubmitted && (
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {goal.uom_type !== 'timeline' && goal.uom_type !== 'zero' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Target Value</label>
                            <input type="number" className="border border-gray-300 rounded px-2 py-1 text-xs w-24"
                              defaultValue={goal.target_value}
                              onChange={ev => setEdit(goal.id, 'target_value', ev.target.value)} />
                          </div>
                        )}
                        {goal.uom_type === 'timeline' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Target Date</label>
                            <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs"
                              defaultValue={goal.target_date?.slice(0, 10)}
                              onChange={ev => setEdit(goal.id, 'target_date', ev.target.value)} />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Weightage (%)</label>
                          <input type="number" min="10" max="100" className="border border-gray-300 rounded px-2 py-1 text-xs w-20"
                            defaultValue={goal.weightage}
                            onChange={ev => setEdit(goal.id, 'weightage', ev.target.value)} />
                        </div>
                        {edits[goal.id] && (
                          <button onClick={() => saveEdit(goal.id)}
                            className="self-end text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">
                            Save
                          </button>
                        )}
                      </div>
                    )}
                    {!isSubmitted && (
                      <span className="text-xs text-gray-400">
                        Weight: {goal.weightage}%{goal.target_value ? ` · Target: ${goal.target_value}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sheet.status === 'submitted' && (
          <div className="flex gap-3">
            <button
              onClick={approve}
              disabled={approving}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition flex items-center gap-2"
            >
              {approving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Approving…
                </>
              ) : '✓ Approve & Lock'}
            </button>
            <button
              onClick={() => setShowReturn(true)}
              className="border border-red-300 text-red-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition"
            >
              Return for Rework
            </button>
          </div>
        )}

        {showReturn && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Return for Rework</h2>
              <p className="text-xs text-gray-400 mb-3">This comment will be shown to the employee on their goal sheet.</p>
              <textarea
                rows={3} placeholder="Explain what needs to be changed…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
                value={returnComment} onChange={e => setReturnComment(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={returnSheet} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition">
                  Send Back
                </button>
                <button onClick={() => setShowReturn(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
