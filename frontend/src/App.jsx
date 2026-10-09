import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

import PassengerDashboard from './pages/passenger/Dashboard.jsx';
import ReportLostItem from './pages/passenger/ReportLostItem.jsx';
import MyReports from './pages/passenger/MyReports.jsx';
import PassengerNotifications from './pages/passenger/Notifications.jsx';

import StaffDashboard from './pages/staff/Dashboard.jsx';
import StaffLostItems from './pages/staff/LostItems.jsx';
import StaffFoundItems from './pages/staff/FoundItems.jsx';
import RegisterFoundItem from './pages/staff/RegisterFoundItem.jsx';
import MatchReview from './pages/staff/MatchReview.jsx';

import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminAuditLogs from './pages/admin/AuditLogs.jsx';

const HOME = { PASSENGER: '/passenger', STAFF: '/staff', ADMIN: '/admin' };

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME[user.role] || '/login'} replace />;
}

function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<RoleHome />} />

        {/* Passenger */}
        <Route path="/passenger" element={<ProtectedRoute roles={['PASSENGER']}><Shell><PassengerDashboard /></Shell></ProtectedRoute>} />
        <Route path="/passenger/report" element={<ProtectedRoute roles={['PASSENGER']}><Shell><ReportLostItem /></Shell></ProtectedRoute>} />
        <Route path="/passenger/reports" element={<ProtectedRoute roles={['PASSENGER']}><Shell><MyReports /></Shell></ProtectedRoute>} />
        <Route path="/passenger/notifications" element={<ProtectedRoute roles={['PASSENGER']}><Shell><PassengerNotifications /></Shell></ProtectedRoute>} />

        {/* Staff (admins can also use staff tools) */}
        <Route path="/staff" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Shell><StaffDashboard /></Shell></ProtectedRoute>} />
        <Route path="/staff/lost-items" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Shell><StaffLostItems /></Shell></ProtectedRoute>} />
        <Route path="/staff/found-items" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Shell><StaffFoundItems /></Shell></ProtectedRoute>} />
        <Route path="/staff/register-found" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Shell><RegisterFoundItem /></Shell></ProtectedRoute>} />
        <Route path="/staff/matches" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Shell><MatchReview /></Shell></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><Shell><AdminDashboard /></Shell></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><Shell><AdminUsers /></Shell></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute roles={['ADMIN']}><Shell><AdminAuditLogs /></Shell></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
