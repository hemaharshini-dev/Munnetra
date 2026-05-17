import { useState, useEffect } from 'react';
import api from '../api/client';

const UOM_OPTIONS = [
  { value: 'numeric_min', label: 'Numeric — Higher is Better (Min)' },
  { value: 'numeric_max', label: 'Numeric — Lower is Better (Max)' },
  { value: 'timeline', label: 'Timeline (Date-based)' },
  { value: 'zero', label: 'Zero-based (0 = Success)' },
];

export default function GoalForm({ goal, sheetId, onSave, onClose }) {
  const [thrustAreas, setThrustAreas] = useState([]);
  const [form, setForm] = useState({
    thrust_area_id: '', title: '', description: '',
    uom_type: 'numeric_min', target_value: '', target_date: '', weightage: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/thrust-areas').then(r => setThrustAreas(r.data));
    if (goal) {
      setForm({
        thrust_area_id: goal.thrust_area_id || '',
        title: goal.title || '',
        description: goal.description || '',
        uom_type: goal.uom_type || 'numeric_min',
        target_value: goal.target_value || '',
        target_date: goal.target_date ? goal.target_date.slice(0, 10) : '',
        weightage: goal.weightage || '',
      });
    }
  }, [goal]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (parseFloat(form.weightage) < 10) { setError('Minimum weightage is 10%'); return; }
    setSaving(true);
    try {
      if (goal) {
        await api.put(`/goal-sheets/goals/${goal.id}`, form);
      } else {
        await api.post(`/goal-sheets/${sheetId}/goals`, form);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{goal ? 'Edit Goal' : 'Add Goal'}</h2>
        {error && <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thrust Area</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.thrust_area_id} onChange={e => set('thrust_area_id', e.target.value)}>
              <option value="">Select thrust area</option>
              {thrustAreas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
            <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measurement *</label>
            <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.uom_type} onChange={e => set('uom_type', e.target.value)}>
              {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {form.uom_type !== 'timeline' && form.uom_type !== 'zero' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.target_value} onChange={e => set('target_value', e.target.value)} />
            </div>
          )}
          {form.uom_type === 'timeline' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weightage (%) * <span className="text-gray-400 font-normal">min 10%</span></label>
            <input required type="number" min="10" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.weightage} onChange={e => set('weightage', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Goal'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
