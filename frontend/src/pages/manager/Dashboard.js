import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Navbar from '../../components/Navbar';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rework:    'bg-red-100 text-red-700',
};

const QUARTERS = [
  { key: 'Q1', label: 'Q1 (Jul–Sep)' },
  { key: 'Q2', label: 'Q2 (Oct–Dec)' },
  { key: 'Q3', label: 'Q3 (Jan–Feb)' },
  { key: 'Q4', label: 'Q4 (Mar–Apr)' },
];

export default function ManagerDashboard() {
  const [sheets, setSheets] = useState([]);
  const [checkinMap, setCheckinMap] = useState({}); // { sheetId: [quarter, ...] }
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/manager/team-sheets').then(async r => {
      setSheets(r.data);
      // Load check-in completion for each approved sheet
      const map = {};
      await Promise.all(
        r.data
          .filter(s => s.status === 'approved')
          .map(async s => {
            const res = await api.get(`/manager/checkins/${s.id}?quarter=Q1`);
            map[s.id] = (res.data.checkins || []).map(c => c.quarter);
          })
      );
      setCheckinMap(map);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Team Goal Sheets</h1>
        {sheets.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">No team submissions yet.</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Check-ins</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sheets.map(s => {
                  const done = checkinMap[s.id] || [];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{s.employee_name}</div>
                        <div className="text-xs text-gray-400">{s.employee_email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.department || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[s.status]}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === 'approved' ? (
                          <div className="flex gap-1 flex-wrap">
                            {QUARTERS.map(q => (
                              <span key={q.key}
                                title={q.label}
                                className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${done.includes(q.key) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {q.label}{done.includes(q.key) ? ' ✓' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => navigate(`/manager/review/${s.id}`)}
                            className="text-blue-600 text-xs hover:underline">
                            Review →
                          </button>
                          {s.status === 'approved' && (
                            <button onClick={() => navigate(`/manager/checkin/${s.id}`)}
                              className="text-green-600 text-xs hover:underline">
                              Check-in →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
