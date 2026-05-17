import { useWindow } from '../context/WindowContext';

export default function WindowBanner() {
  const { activeWindow } = useWindow();

  // Still loading
  if (activeWindow === undefined) return null;

  // No active window
  if (!activeWindow) {
    return (
      <div className="bg-gray-100 border-b border-gray-200 px-6 py-2 flex items-center gap-2 text-sm text-gray-500">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>The portal is currently between cycles. No actions are available until the next window opens.</span>
      </div>
    );
  }

  // Check if closing soon (within 7 days)
  const daysLeft = Math.ceil((new Date(activeWindow.closes_at) - Date.now()) / 86400000);
  const closingSoon = daysLeft <= 7;

  const isGoalSetting = activeWindow.action === 'goal_setting';
  const colorClass = closingSoon
    ? 'bg-orange-50 border-orange-200 text-orange-700'
    : isGoalSetting
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className={`border-b px-6 py-2 flex items-center gap-2 text-sm ${colorClass}`}>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>
        <span className="font-semibold">{activeWindow.label}</span>
        {' · '}
        {new Date(activeWindow.opens_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        {' – '}
        {new Date(activeWindow.closes_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        {closingSoon && <span className="ml-2 font-medium">· Closes in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>}
      </span>
    </div>
  );
}
