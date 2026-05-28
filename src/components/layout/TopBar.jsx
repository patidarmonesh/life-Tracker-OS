import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Cloud, CloudOff, Loader, CheckCircle, LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const { state } = useApp()
  const { user, logout } = useAuth()
  const { syncStatus, lastSynced } = state

  const indicator = useMemo(() => {
    if (syncStatus === 'syncing') {
      return {
        icon: Loader,
        label: 'Syncing...',
        color: '#f59e0b',
        spin: true,
      }
    }

    if (syncStatus === 'offline') {
      return {
        icon: CloudOff,
        label: 'Using local cache',
        color: '#94a3b8',
        spin: false,
      }
    }

    if (syncStatus === 'auth_required') {
      return {
        icon: CloudOff,
        label: 'Drive reconnect needed',
        color: '#f97316',
        spin: false,
      }
    }

    if (syncStatus === 'synced') {
      return {
        icon: CheckCircle,
        label: lastSynced
          ? `Saved ${formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}`
          : 'Saved',
        color: '#10b981',
        spin: false,
      }
    }

    return {
      icon: Cloud,
      label: 'Ready',
      color: '#94a3b8',
      spin: false,
    }
  }, [syncStatus, lastSynced])

  const Icon = indicator.icon
  const displayName = user?.name?.trim() || 'Signed in'
  const displayEmail = user?.email?.trim() || ''
  const avatarUrl = user?.picture?.trim() || ''
  const fallbackInitial = (displayName[0] || 'U').toUpperCase()

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 20 }}>🧠</div>
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 16,
            color: 'var(--accent-indigo)',
          }}
        >
          Life OS
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: indicator.color,
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
          }}
        >
          <Icon size={14} className={indicator.spin ? 'animate-spin' : ''} />
          <span>{indicator.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border-focus)',
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent-indigo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                color: 'white',
              }}
            >
              {fallbackInitial}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {displayName}
            </span>
            {displayEmail ? (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                {displayEmail}
              </span>
            ) : null}
          </div>

          <button
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
