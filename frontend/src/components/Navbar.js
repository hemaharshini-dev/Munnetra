import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import WindowBanner from './WindowBanner';

export default function Navbar({ bellRef }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const roleColors = {
    employee: 'bg-green-100 text-green-700',
    manager:  'bg-blue-100 text-blue-700',
    admin:    'bg-purple-100 text-purple-700',
  };

  function navLink(to, label) {
    const active = location.pathname.startsWith(to);
    return (
      <button onClick={() => navigate(to)}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          active ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-800'
        }`}>
        {label}
      </button>
    );
  }

  return (
    <div>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-[9px] text-blue-500 font-semibold tracking-widest uppercase leading-none">Atomberg</p>
              <span className="font-bold text-gray-800 text-base leading-tight">Munnetra</span>
            </div>
          </div>
          {user?.role === 'employee' && (
            <div className="flex gap-1">
              {navLink('/employee', 'My Goals')}
              {navLink('/employee/checkin', 'Check-in')}
            </div>
          )}
          {user?.role === 'manager' && (
            <div className="flex gap-1">
              {navLink('/manager', 'Team Goals')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && <NotificationBell ref={bellRef} />}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              user?.role === 'admin' ? 'bg-purple-500' : user?.role === 'manager' ? 'bg-blue-500' : 'bg-green-500'
            }`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.name}</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${roleColors[user?.role]}`}>
            {user?.role}
          </span>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-red-200 transition">Logout</button>
        </div>
      </nav>
      <WindowBanner />
    </div>
  );
}
