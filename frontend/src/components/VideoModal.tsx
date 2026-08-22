import React from 'react';
import { X, Download, Share2, Sparkles, CheckCircle2, Film, Volume2 } from 'lucide-react';
import { TaskItem } from '../api/client';

interface VideoModalProps {
  task: TaskItem;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ task, onClose }) => {
  const videoUrl = task.videos && task.videos[0]
    ? (task.videos[0].startsWith('http') || task.videos[0].startsWith('/')
        ? task.videos[0]
        : `/${task.videos[0]}`)
    : null;

  const title = task.params?.video_subject || `Project ${task.task_id.slice(0, 8)}`;
  const aspect = task.params?.video_aspect || '9:16';
  const voice = task.params?.voice_name || 'Aria Neural';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          background: 'rgba(20, 18, 35, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 30px 100px rgba(0, 0, 0, 0.6), 0 0 50px rgba(255, 0, 122, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--grad-sunset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Film size={18} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
                {title}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ID: {task.task_id}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-glass"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Video + Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '24px',
          padding: '28px',
          overflowY: 'auto',
        }}>
          {/* Left: Device Mockup Video Player */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div style={{
              width: aspect === '9:16' ? '240px' : aspect === '1:1' ? '300px' : '100%',
              maxHeight: '440px',
              borderRadius: '28px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 223, 216, 0.2)',
              overflow: 'hidden',
              background: '#000000',
              position: 'relative',
              aspectRatio: aspect === '9:16' ? '9/16' : aspect === '1:1' ? '1/1' : '16/9',
            }}>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: 'var(--text-muted)',
                  padding: '20px',
                  textAlign: 'center',
                }}>
                  <Film size={36} />
                  <span style={{ fontSize: '0.85rem' }}>No video stream available</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Project Info & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Ad Topic & Script
                </h4>
                <p style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  {title}
                </p>
              </div>

              {/* Specs Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="glass-card" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Aspect Ratio</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{aspect}</span>
                </div>
                <div className="glass-card" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Voiceover</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{voice}</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 223, 216, 0.1)',
                border: '1px solid rgba(0, 223, 216, 0.3)',
              }}>
                <CheckCircle2 size={20} color="#00DFD8" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#00DFD8' }}>
                  Ready for Review & Publishing
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {videoUrl && (
                <a
                  href={videoUrl}
                  download
                  className="btn-glass"
                  style={{ flex: 1, justifyContent: 'center' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={18} />
                  <span>Download MP4</span>
                </a>
              )}
              <button
                className="btn-primary"
                style={{ flex: 1.2, justifyContent: 'center' }}
                onClick={() => {
                  alert('Publishing integration: use the New Project wizard review step to publish directly to TikTok/Instagram.');
                }}
              >
                <Share2 size={18} />
                <span>Publish Video</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
