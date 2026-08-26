import React from 'react';
import { X, Download, Share2, CheckCircle2, Film, Trash2 } from 'lucide-react';
import { TaskItem } from '../api/client';

interface VideoModalProps {
  task: TaskItem;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ task, onClose, onDelete }) => {
  const videoUrl = task.videos && task.videos[0]
    ? (task.videos[0].startsWith('http') || task.videos[0].startsWith('/')
        ? task.videos[0]
        : `/${task.videos[0]}`)
    : null;

  const title = task.title || task.params?.video_subject || (task.task_id.startsWith('prj-') ? `Project ${task.task_id.slice(4, 12)}` : `Project ${task.task_id.slice(0, 8)}`);
  const aspect = task.params?.video_aspect || '9:16';
  const voice = task.params?.voice_name || 'Aria Neural';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(18, 20, 31, 0.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-dropdown)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Film size={18} color="var(--text-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                {title}
              </h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ID: {task.task_id}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '8px', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Video + Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '24px',
          padding: '24px',
          overflowY: 'auto',
        }}>
          {/* Left: Device Mockup Video Player */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: aspect === '9:16' ? '230px' : aspect === '1:1' ? '280px' : '100%',
              maxHeight: '420px',
              borderRadius: '18px',
              border: '3px solid #1F2430',
              boxShadow: 'var(--shadow-lg)',
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
                  <Film size={32} />
                  <span style={{ fontSize: '0.84rem' }}>No video stream available</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Project Info & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span className="eyebrow-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Ad Topic & Script
                </span>
                <p style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {title}
                </p>
              </div>

              {/* Specs Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="sub-card" style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Aspect Ratio</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aspect}</span>
                </div>
                <div className="sub-card" style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Voiceover</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{voice}</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
              }}>
                <CheckCircle2 size={18} color="#065F46" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#065F46' }}>
                  Ready for Review & Publishing
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {onDelete && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '10px 14px',
                    color: '#DC2626',
                    borderColor: '#FCA5A5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => {
                    onDelete(task.task_id);
                    onClose();
                  }}
                  title="Delete project & remove local files"
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              )}

              {videoUrl && (
                <a
                  href={videoUrl}
                  download
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} />
                  <span>Download</span>
                </a>
              )}
              <button
                className="btn-primary"
                style={{ flex: 1.2, justifyContent: 'center' }}
                onClick={() => {
                  alert('Publishing integration: use the New Project wizard review step to publish directly.');
                }}
              >
                <Share2 size={16} />
                <span>Publish</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
