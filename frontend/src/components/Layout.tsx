import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Ambient Glowing Glassmorphism Gradient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: '32px 40px 60px 20px',
        position: 'relative',
        zIndex: 5,
        maxWidth: '1500px',
        margin: '0 auto',
        width: '100%',
      }}>
        {children}
      </main>
    </div>
  );
};
