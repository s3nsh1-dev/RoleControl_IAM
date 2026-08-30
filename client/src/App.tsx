import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthPage } from '@/pages/AuthPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
