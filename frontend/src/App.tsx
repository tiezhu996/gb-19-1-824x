import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import Login from '@/pages/Login'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Leads from '@/pages/Leads'
import Students from '@/pages/Students'
import Courses from '@/pages/Courses'
import Schedules from '@/pages/Schedules'
import Attendance from '@/pages/Attendance'
import Finance from '@/pages/Finance'
import Teachers from '@/pages/Teachers'

function App() {
  const { token } = useUserStore()
  const location = useLocation()

  if (!token && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  if (token && location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="students" element={<Students />} />
        <Route path="courses" element={<Courses />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="finance" element={<Finance />} />
        <Route path="teachers" element={<Teachers />} />
      </Route>
    </Routes>
  )
}

export default App
