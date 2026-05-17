import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar({ bellRef }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const roleColors = {
    employee: 'bg-green-100 text-green-700',
    manager:  'bg-blue-100 text-blue-700',
    admin:    'bg-purple-100 text-purple-700',
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="font-bold text-gray-800 text-lg">Goal Tracker</span>
      <div className="flex items-center gap-3">
        {user?.role === 'admin' && <NotificationBell ref={bellRef} />}
        <span className="text-sm text-gray-600">{user?.name}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${roleColors[user?.role]}`}>
          {user?.role}
        </span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500">Logout</button>
      </div>
    </nav>
  );
}
