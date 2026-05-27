import { NavLink } from 'react-router-dom'
import { Home, BarChart2, Clock, Bot, CheckSquare } from 'lucide-react'

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/finance', icon: BarChart2, label: 'Finance' },
  { to: '/timeflow', icon: Clock, label: 'Time' },
  { to: '/ai', icon: Bot, label: 'AI' },
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
]

export default function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '8px 12px',
            minWidth: '56px',
            height: '100%',
            color: isActive ? 'var(--accent-indigo)' : 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: '600',
            transform: isActive ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.15s ease',
          })}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}