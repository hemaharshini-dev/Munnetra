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
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-800 text-lg">Goal Tracker</span>
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
          <span className="text-sm text-gray-600">{user?.name}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${roleColors[user?.role]}`}>
            {user?.role}
          </span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500">Logout</button>
        </div>
      </nav>
      <WindowBanner />
    </div>
  );
}
