import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ComingSoon from './pages/ComingSoon';
import StaffList from './pages/StaffList';
import StaffForm from './pages/StaffForm';
import Patients from './pages/Patients';
import Infrastructure from './pages/Infrastructure';
import Appointments from './pages/Appointments';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Priority from './pages/Priority';
import Duty from './pages/Duty';
import Roster from './pages/Roster';
import Labs from './pages/Labs';

const admin = (el) => <ProtectedRoute roles={['admin']}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/doctors" element={admin(<StaffList type="doctors" />)} />
        <Route path="/receptionists" element={admin(<StaffList type="receptionists" />)} />
        <Route path="/infrastructure" element={admin(<Infrastructure />)} />
        <Route path="/billing" element={<ProtectedRoute roles={['admin', 'receptionist']}><Billing /></ProtectedRoute>} />
        <Route path="/reports" element={admin(<Reports />)} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/priority" element={<ProtectedRoute roles={['admin', 'doctor']}><Priority /></ProtectedRoute>} />
        <Route path="/duty" element={<ProtectedRoute roles={['doctor']}><Duty /></ProtectedRoute>} />
        <Route path="/roster" element={admin(<Roster />)} />
        <Route path="/labs" element={<ProtectedRoute roles={['admin', 'doctor']}><Labs /></ProtectedRoute>} />
        {/* pages opened by the dashboard "+ Add" buttons */}
        <Route path="/admin/doctors/new" element={admin(<StaffForm type="doctors" />)} />
        <Route path="/admin/receptionists/new" element={admin(<StaffForm type="receptionists" />)} />
        <Route path="/admin/infrastructure" element={admin(<Infrastructure />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}