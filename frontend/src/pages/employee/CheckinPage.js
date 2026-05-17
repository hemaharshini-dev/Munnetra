import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import ProgressBar from '../../components/ProgressBar';

const QUARTERS = [
  { key: 'Q1', label: 'Q1 (Jul–Sep)', period: 'July – September' },
  { key: 'Q2', label: 'Q2 (Oct–Dec)', period: 'October – December' },
  { key: 'Q3', label: 'Q3 (Jan–Feb)', period: 'January – February' },
  { key: 'Q4', label: 'Q4 (Mar–Apr)', period: 'March – April · Final Review' },
];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'on_track',    label: 'On Track' },
  { value: 'completed',   label: 'Completed' },
];

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-500',
  on_track:    'bg-blue-100 text-blue-600',
  completed:   'bg-green-100 text-green-700',
};

function computeScore(uom_type, target_value, target_date, actual_value, actual_date) {
  if (uom_type === 'numeric_min') {
    if (!target_value || !actual_value) return null;
    return Math.min(parseFloat(actual_value) / parseFloat(target_value), 1.0);
  }
  if (uom_type === 'numeric_max') {
    if (!target_value) return null;
    if (!actual_value || parseFloat(actual_value) === 0) return 1.0;
    return Math.min(parseFloat(target_value) / parseFloat(actual_value), 1.0);
  }
  if (uom_type === 'timeline') {
    if (!target_date || !actual_date) return null;
    return new Date(actual_date) <= new Date(target_date) ? 1.0 : 0.0;
  }
  if (uom_type === 'zero') {
    if (actual_value === '' || actual_value === null || actual_value === undefined) return null;
    return parseFloat(actual_value) === 0 ? 1.0 : 0.0;
  }
  return null;
}

export default function CheckinPage() {
  const [goals, setGoals] = useState([]);
  const [quarter, setQuarter] = useState('Q1');
  const [inputs, setInputs] = useState({});   // { [goalId]: { actual_value, actual_date, status } }
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [noSheet, setNoSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/achievements/mine');
      if (!data.length) { setNoSheet(true); return; }
      setGoals(data);
      // Pre-fill inputs from saved achievements for selected quarter
      const init = {};
      data.forEach(g => {
        const ach = (g.achievements || []).find(a => a.quarter === quarter);
        init[g.id] = {
          actual_value: ach?.actual_value ?? '',
          actual_date:  ach?.actual_date ? ach.actual_date.slice(0, 10) : '',
          status:       ach?.status ?? 'not_started',
        };
      });
      setInputs(init);
    } catch {
      setNoSheet(true);
    }
  }, [quarter]);

  useEffect(() => { load(); }, [load]);

  function setField(goalId, field, value) {
    setInputs(prev => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  }

  async function save(goal) {
    setError(''); setMessage('');
    const inp = inputs[goal.id] || {};
    setSaving(s => ({ ...s, [goal.id]: true }));
    try {
      await api.post('/achievements', {
        goal_id:      goal.id,
        quarter,
        actual_value: inp.actual_value !== '' ? inp.actual_value : null,
        actual_date:  inp.actual_date  || null,
        status:       inp.status || 'not_started',
      });
      setMessage(`Saved — ${goal.title} (${quarter})`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(s => ({ ...s, [goal.id]: false }));
    }
  }

  if (noSheet) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
          No approved goal sheet found for this cycle. Goals must be approved by your manager before you can log achievements.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Quarterly Check-in</h1>
        <p className="text-gray-500 text-sm mb-6">Log your actual achievement against each goal.</p>

        {message && <p className="text-green-600 bg-green-50 p-3 rounded-lg text-sm mb-4">{message}</p>}
        {error   && <p className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4">{error}</p>}

        {/* Quarter tabs */}
        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
          {QUARTERS.map(q => (
            <button key={q.key} onClick={() => setQuarter(q.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${quarter === q.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {q.label}
            </button>
          ))}
        </div>
        {/* Active quarter banner */}
        <div className="flex items-center gap-2 mb-6 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 w-fit">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span><span className="font-semibold">{QUARTERS.find(q => q.key === quarter)?.label}</span> · {QUARTERS.find(q => q.key === quarter)?.period}</span>
        </div>

        <div className="space-y-4">
          {goals.map(goal => {
            const inp = inputs[goal.id] || {};
            const ach = (goal.achievements || []).find(a => a.quarter === quarter);
            const liveScore = computeScore(goal.uom_type, goal.target_value, goal.target_date, inp.actual_value, inp.actual_date);
            const isSharedRecipient = goal.is_shared && goal.shared_from_goal_id;

            return (
              <div key={goal.id} className="bg-white rounded-xl shadow-sm p-5">
                {/* Goal header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{goal.title}</span>
                      {goal.is_shared && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400">
                      {goal.thrust_area_name && <span>{goal.thrust_area_name}</span>}
                      <span>UoM: {goal.uom_type}</span>
                      {goal.target_value && <span>Target: {goal.target_value}</span>}
                      {goal.target_date  && <span>By: {goal.target_date.slice(0, 10)}</span>}
                      <span>Weight: {goal.weightage}%</span>
                    </div>
                  </div>
                  {ach && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize shrink-0 ${STATUS_COLORS[ach.status]}`}>
                      {ach.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {/* Actual value — disabled for shared recipients */}
                  {goal.uom_type !== 'timeline' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Actual Value</label>
                      <input
                        type="number"
                        disabled={isSharedRecipient}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                        value={inp.actual_value ?? ''}
                        onChange={e => setField(goal.id, 'actual_value', e.target.value)}
                      />
                      {isSharedRecipient && <p className="text-[11px] text-blue-500 mt-1">Synced from source owner</p>}
                    </div>
                  )}
                  {goal.uom_type === 'timeline' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Actual Completion Date</label>
                      <input
                        type="date"
                        disabled={isSharedRecipient}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
                        value={inp.actual_date ?? ''}
                        onChange={e => setField(goal.id, 'actual_date', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={inp.status ?? 'not_started'}
                      onChange={e => setField(goal.id, 'status', e.target.value)}
                    >
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Live score */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Progress Score</label>
                    <div className="pt-1">
                      <ProgressBar score={liveScore} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => save(goal)}
                  disabled={saving[goal.id]}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving[goal.id] ? 'Saving…' : `Save for ${QUARTERS.find(q => q.key === quarter)?.label}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
