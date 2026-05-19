import { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

const QUARTER_LABELS = { Q1: 'Q1 (Jul–Sep)', Q2: 'Q2 (Oct–Dec)', Q3: 'Q3 (Jan–Feb)', Q4: 'Q4 (Mar–Apr)' };

function scoreColor(rate) {
  if (rate >= 75) return '#10b981';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function AnalyticsTab() {
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear());
  const [qoq, setQoq] = useState({ data: [], departments: [] });
  const [completion, setCompletion] = useState([]);
  const [distribution, setDistribution] = useState({ by_thrust_area: [], by_uom: [], by_status: [] });
  const [effectiveness, setEffectiveness] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadAll(year) {
    setLoading(true);
    try {
      const [q, c, d, e] = await Promise.all([
        api.get(`/admin/analytics/qoq-trends?cycle_year=${year}`),
        api.get(`/admin/analytics/completion-rates?cycle_year=${year}`),
        api.get(`/admin/analytics/goal-distribution?cycle_year=${year}`),
        api.get(`/admin/analytics/manager-effectiveness?cycle_year=${year}`),
      ]);
      setQoq(q.data);
      setCompletion(c.data.map(r => ({ ...r, quarter: QUARTER_LABELS[r.quarter] || r.quarter })));
      setDistribution(d.data);
      setEffectiveness(e.data);
    } finally {
      setLoading(false);
    }
  }

  const [yearInput, setYearInput] = useState(new Date().getFullYear());

  useEffect(() => { loadAll(cycleYear); }, [cycleYear]);

  function handleYearRefresh() {
    if (yearInput >= 2020 && yearInput <= 2099) setCycleYear(yearInput);
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 font-medium">Cycle Year</label>
        <input
          type="number"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
          value={yearInput}
          onChange={e => setYearInput(parseInt(e.target.value))}
        />
        <button onClick={handleYearRefresh}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Refresh
        </button>
        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      {/* Panel 1 — QoQ Achievement Trend */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Quarter-on-Quarter Achievement Trend</h2>
        <p className="text-xs text-gray-400 mb-4">Average progress score per quarter by department</p>
        {qoq.data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No achievement data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={qoq.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => v != null ? `${v}%` : '—'} />
              <Legend />
              {qoq.departments.map((dept, i) => (
                <Line key={dept} type="monotone" dataKey={dept}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                  dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Panel 2 — Check-in Completion Rates */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Check-in Completion Rates</h2>
        <p className="text-xs text-gray-400 mb-4">% of employees and managers who completed each quarter's check-in</p>
        {completion.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No check-in data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={completion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `${v}%`} />
              <Legend />
              <Bar dataKey="employee_pct" name="Employee" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="manager_pct"  name="Manager"  fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Panel 3 — Goal Distribution */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Goal Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* By Thrust Area */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">By Thrust Area</p>
            {distribution.by_thrust_area.length === 0
              ? <p className="text-center text-gray-300 text-xs py-4">No data</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart layout="vertical" data={distribution.by_thrust_area}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Goals" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* By UoM Type */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">By UoM Type</p>
            {distribution.by_uom.length === 0
              ? <p className="text-center text-gray-300 text-xs py-4">No data</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={distribution.by_uom} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) =>
                        `${name} ${Math.round(percent * 100)}%`}>
                      {distribution.by_uom.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* By Status */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">By Achievement Status</p>
            {distribution.by_status.length === 0
              ? <p className="text-center text-gray-300 text-xs py-4">No data</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={distribution.by_status} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) =>
                        `${name.replace('_',' ')} ${Math.round(percent * 100)}%`}>
                      {distribution.by_status.map((entry, i) => {
                        const c = entry.name === 'completed' ? '#10b981'
                          : entry.name === 'on_track' ? '#3b82f6' : '#d1d5db';
                        return <Cell key={i} fill={c} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* Panel 4 — Manager Effectiveness */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Manager Effectiveness</h2>
        <p className="text-xs text-gray-400 mb-4">Check-in completion rate per manager (submitted ÷ possible)</p>
        {effectiveness.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No manager data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, effectiveness.length * 50)}>
            <BarChart layout="vertical" data={effectiveness}
              margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="manager_name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, _, props) =>
                [`${v}% (${props.payload.done}/${props.payload.possible} check-ins)`, 'Completion']} />
              <Bar dataKey="rate" name="Completion %" radius={[0,4,4,0]}>
                {effectiveness.map((entry, i) => (
                  <Cell key={i} fill={scoreColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> ≥75%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span> 50–74%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span> &lt;50%</span>
        </div>
      </div>
    </div>
  );
}
