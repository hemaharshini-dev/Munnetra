export default function ProgressBar({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-orange-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium w-9 text-right ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  );
}
