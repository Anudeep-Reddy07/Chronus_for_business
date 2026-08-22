import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Mic, Settings, Sparkles, Video } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new', label: 'New Project', icon: PlusCircle, highlight: true },
    { to: '/voice', label: 'Voice & Audio', icon: Mic },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside style={{
      width: '260px',
      minHeight: '100vh',
      padding: '28px 20px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 12px 32px 12px',
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: 'var(--grad-sunset)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 25px rgba(255, 0, 122, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.4)'
        }}>
          <Sparkles size={22} color="#FFFFFF" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Chronus
          </h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Studio v2.0
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                background: isActive
                  ? (item.highlight ? 'var(--grad-sunset)' : 'rgba(255, 255, 255, 0.18)')
                  : 'transparent',
                backdropFilter: isActive ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: isActive ? 'blur(12px)' : 'none',
                border: isActive ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.92rem',
                transition: 'all 0.2s ease',
                boxShadow: isActive && item.highlight ? '0 10px 30px rgba(255, 0, 122, 0.35)' : 'none',
              })}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Quick Status */}
      <div className="glass-panel" style={{ padding: '16px', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00DFD8',
            boxShadow: '0 0 10px #00DFD8'
          }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Engine Active
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          FastAPI Engine · MoviePy Pro
        </p>
      </div>
    </aside>
  );
};
