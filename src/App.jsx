import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Finance from './pages/Finance'
import TimeFlow from './pages/TimeFlow'
import Study from './pages/Study'
import Habits from './pages/Habits'
import Health from './pages/Health'
import Journal from './pages/Journal'
import AIChat from './pages/AIChat'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import AppShell from './components/layout/AppShell'

function ComingSoon({ name }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>{name}</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
        Coming in the next step.
      </p>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, isLoading, isAuthReady } = useAuth()

  if (isLoading || !isAuthReady) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function AppRoutes() {
  const { user, isLoading, isAuthReady } = useAuth()

  if (isLoading || !isAuthReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading Life OS...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Home />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <AppShell>
              <Finance />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/timeflow"
        element={
          <ProtectedRoute>
            <AppShell>
              <TimeFlow />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/study"
        element={
          <ProtectedRoute>
            <AppShell>
              <Study />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/habits"
        element={
          <ProtectedRoute>
            <AppShell>
              <Habits />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/health"
        element={
          <ProtectedRoute>
            <AppShell>
              <Health />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/journal"
        element={
          <ProtectedRoute>
            <AppShell>
              <Journal />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai"
        element={
          <ProtectedRoute>
            <AppShell>
              <AIChat />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppShell>
              <Analytics />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <Settings />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  )
}