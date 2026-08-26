import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Mic, Settings } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new', label: 'New Project', icon: PlusCircle, highlight: true },
    { to: '/voice', label: 'Voice & Audio', icon: Mic },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '260px',
      height: '100vh',
      padding: '28px 18px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      background: '#FFFFFF',
      borderRight: '1px solid var(--border-subtle)',
      boxSizing: 'border-box',
    }}>
      {/* Brand Header with Calligraphic 'C' Monogram Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 8px 32px 8px',
      }}>
        {/* Calligraphic 'C' Logo */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'var(--grad-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(24, 24, 27, 0.22)',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M72 31C67.5 25 59 21.5 48 21.5C31.5 21.5 20 33 20 50C20 67 31.5 78.5 48 78.5C60 78.5 68.5 74 73 66.5C74.2 64.5 72.8 62 70.4 62C68.6 62 67.2 63.2 65.8 64.8C61.5 69.5 55 72 47.5 72C35 72 26.5 62.5 26.5 50C26.5 37.5 35 28 47.5 28C54.8 28 61 30.5 65.2 35C66.6 36.5 68 37.5 69.8 37.5C72.2 37.5 73.5 35 72 31Z"
              fill="#FFFFFF"
            />
            <circle cx="71" cy="27" r="4.5" fill="#FFFFFF" />
          </svg>
        </div>

        <div>
          <span className="eyebrow-label" style={{ display: 'block', fontSize: '0.66rem', letterSpacing: '0.14em' }}>
            STUDIO
          </span>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            Chronus
          </h1>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
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
                padding: '11px 16px',
                borderRadius: 'var(--radius-pill)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                background: isActive ? 'var(--grad-brand)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 4px 12px rgba(24, 24, 27, 0.18)' : 'none',
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Quick Status */}
      <div style={{
        padding: '14px 16px',
        marginTop: 'auto',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface-subtle)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
          }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Engine Active
          </span>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          FastAPI · MoviePy Studio
        </p>
      </div>
    </aside>
  );
};
