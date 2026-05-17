import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import api from '../api/client';

const ACTION_STYLES = {
  approved: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700', label: 'Approved' },
  returned: { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700',     label: 'Returned' },
  unlocked: { dot: 'bg-orange-500',badge: 'bg-orange-100 text-orange-700',label: 'Unlocked' },
  edited:   { dot: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700',   label: 'Edited'   },
};

const LAST_SEEN_KEY = 'notif_last_seen';

const NotificationBell = forwardRef(function NotificationBell(_, ref) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef(null);

  useImperativeHandle(ref, () => ({ fetchNotifications }));

  useEffect(() => {
    fetchNotifications();
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchNotifications() {
    const { data } = await api.get('/admin/audit-log');
    setNotifications(data);
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    const count = lastSeen
      ? data.filter(n => new Date(n.timestamp) > new Date(lastSeen)).length
      : data.length;
    setUnread(count);
  }

  function handleOpen() {
    setOpen(o => !o);
    if (!open) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setUnread(0);
    }
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Activity notifications"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Activity Feed</span>
            <span className="text-xs text-gray-400">{notifications.length} total</span>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No activity yet</p>
            )}
            {notifications.map(n => {
              const style = ACTION_STYLES[n.action] || ACTION_STYLES.edited;
              return (
                <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-gray-400 truncate">by {n.actor_name}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Sheet #{n.goal_sheet_id}
                        {n.comment && <span className="text-gray-400"> — {n.comment}</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.timestamp)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-[11px] text-gray-400 text-center">Showing latest 500 actions</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default NotificationBell;
