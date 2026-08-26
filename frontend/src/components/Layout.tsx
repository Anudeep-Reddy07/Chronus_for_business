import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'var(--bg-app)' }}>
      {/* Subtle Ambient Illumination */}
      <div className="ambient-bg" />

      {/* Permanently Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area with Natural Window Scroll & Inertia */}
      <main style={{
        marginLeft: '260px',
        padding: '36px 48px 60px 48px',
        position: 'relative',
        zIndex: 5,
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
