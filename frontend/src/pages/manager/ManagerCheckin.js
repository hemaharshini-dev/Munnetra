import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import ProgressBar from '../../components/ProgressBar';

const QUARTERS = [
  { key: 'Q1', label: 'Q1 (Jul–Sep)', period: 'July – September' },
  { key: 'Q2', label: 'Q2 (Oct–Dec)', period: 'October – December' },
  { key: 'Q3', label: 'Q3 (Jan–Feb)', period: 'January – February' },
  { key: 'Q4', label: 'Q4 (Mar–Apr)', period: 'March – April · Final Review' },
];

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-500',
  on_track:    'bg-blue-100 text-blue-600',
  completed:   'bg-green-100 text-green-700',
};

export default function ManagerCheckin() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const [quarter, setQuarter] = useState('Q1');
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data: res } = await api.get(`/manager/checkins/${sheetId}?quarter=${quarter}`);
    setData(res);
    const existing = (res.checkins || []).find(c => c.quarter === quarter);
    setComment(existing?.comment || '');
  }, [sheetId, quarter]);

  useEffect(() => { load(); }, [load]);

  async function submitCheckin() {
    if (!comment.trim()) { setError('Comment is required'); return; }
    setError(''); setSaving(true);
    try {
      await api.post('/manager/checkins', {
        goal_sheet_id: parseInt(sheetId),
        quarter,
        comment: comment.trim(),
      });
      setMessage(`Check-in submitted for ${QUARTERS.find(q => q.key === quarter)?.label}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit check-in');
    } finally {
      setSaving(false);
    }
  }

  const existingCheckin = data ? (data.checkins || []).find(c => c.quarter === quarter) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/manager')} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Dashboard
        </button>

        {data && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{data.employee_name} — Check-in</h1>
              <p className="text-gray-500 text-sm">{data.employee_email} · Cycle {data.cycle_year}</p>
            </div>
          </div>
        )}

        {message && <p className="text-green-600 bg-green-50 p-3 rounded-lg text-sm mb-4">{message}</p>}
        {error   && <p className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4">{error}</p>}

        {/* Quarter tabs */}
        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
          {QUARTERS.map(q => (
            <button key={q.key} onClick={() => setQuarter(q.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${quarter === q.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {q.label}
              {data && (data.checkins || []).find(c => c.quarter === q.key) && (
                <span className="ml-1 text-green-500">✓</span>
              )}
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

        {/* Goals — planned vs actual */}
        {data && (
          <>
            <div className="space-y-3 mb-6">
              {(data.goals || []).length === 0 && (
                <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">No goals found.</div>
              )}
              {(data.goals || []).map(goal => (
                <div key={goal.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium text-gray-800 text-sm">{goal.title}</span>
                    {goal.is_shared && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>}
                    {goal.achievement_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[goal.achievement_status]}`}>
                        {goal.achievement_status.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {/* Planned */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Planned Target</p>
                      <p className="font-semibold text-gray-700">
                        {goal.uom_type === 'timeline'
                          ? (goal.target_date ? goal.target_date.slice(0, 10) : '—')
                          : (goal.target_value ?? '—')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{goal.uom_type}</p>
                    </div>

                    {/* Actual */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Actual Achievement</p>
                      <p className="font-semibold text-blue-700">
                        {goal.uom_type === 'timeline'
                          ? (goal.actual_date ? goal.actual_date.slice(0, 10) : '—')
                          : (goal.actual_value ?? '—')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Weightage: {goal.weightage}%</p>
                    </div>

                    {/* Score */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-2">Progress Score</p>
                      <ProgressBar score={goal.progress_score} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Check-in comment */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-1">
                {existingCheckin ? `${QUARTERS.find(q => q.key === quarter)?.label} Check-in Comment` : `Submit ${QUARTERS.find(q => q.key === quarter)?.label} Check-in`}
              </h2>
              {existingCheckin ? (
                <>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">{existingCheckin.comment}</p>
                  <p className="text-xs text-gray-400">Submitted {new Date(existingCheckin.created_at).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">To update, edit the comment below and resubmit.</p>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-3"
                    placeholder="Update comment…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <button onClick={submitCheckin} disabled={saving}
                    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Update Check-in'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">Document your discussion with the employee for {QUARTERS.find(q => q.key === quarter)?.label} ({QUARTERS.find(q => q.key === quarter)?.period}).</p>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                    placeholder="Enter your check-in comment…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <button onClick={submitCheckin} disabled={saving}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {saving ? 'Submitting…' : `Submit ${QUARTERS.find(q => q.key === quarter)?.label} Check-in`}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
