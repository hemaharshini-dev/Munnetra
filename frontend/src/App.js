import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeGoalSheet from './pages/employee/GoalSheet';
import CheckinPage from './pages/employee/CheckinPage';
import ManagerDashboard from './pages/manager/Dashboard';
import ReviewSheet from './pages/manager/ReviewSheet';
import ManagerCheckin from './pages/manager/ManagerCheckin';
import AdminDashboard from './pages/admin/Dashboard';

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'employee') return <Navigate to="/employee" replace />;
  if (user.role === 'manager') return <Navigate to="/manager" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/employee" element={<ProtectedRoute role="employee"><EmployeeGoalSheet /></ProtectedRoute>} />
          <Route path="/employee/checkin" element={<ProtectedRoute role="employee"><CheckinPage /></ProtectedRoute>} />
          <Route path="/manager" element={<ProtectedRoute role="manager"><ManagerDashboard /></ProtectedRoute>} />
          <Route path="/manager/review/:id" element={<ProtectedRoute role="manager"><ReviewSheet /></ProtectedRoute>} />
          <Route path="/manager/checkin/:sheetId" element={<ProtectedRoute role="manager"><ManagerCheckin /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
