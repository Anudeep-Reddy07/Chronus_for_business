import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Sparkles,
  Video,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Trash2,
  Loader2,
} from 'lucide-react';
import { apiClient, TaskItem } from '../api/client';
import { VideoModal } from '../components/VideoModal';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing' | 'failed'>('all');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  // Poll active tasks every 3.5s if any task is processing
  useEffect(() => {
    const hasProcessing = tasks.some((t) => t.state === 4 || t.state === 1);
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadTasks(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [tasks]);

  const loadTasks = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await apiClient.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent | null, taskId: string) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this video project and its local files?')) {
      return;
    }
    try {
      setDeletingTaskId(taskId);
      await apiClient.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
      if (selectedTask?.task_id === taskId) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete video project');
    } finally {
      setDeletingTaskId(null);
    }
  };

  const getStatusBadge = (state: number) => {
    if (state === 1 || state === 2) {
      return (
        <span className="badge badge-ready">
          <CheckCircle2 size={11} />
          <span>Ready</span>
        </span>
      );
    }
    if (state === 4) {
      return (
        <span className="badge badge-processing">
          <Clock size={11} />
          <span>Rendering</span>
        </span>
      );
    }
    if (state === -1 || state === 3) {
      return (
        <span className="badge badge-failed">
          <AlertCircle size={11} />
          <span>Failed</span>
        </span>
      );
    }
    return (
      <span className="badge badge-draft">
        <Clock size={11} />
        <span>Draft</span>
      </span>
    );
  };

  const totalProjects = tasks.length;
  const readyCount = tasks.filter((t) => t.state === 1 || t.state === 2).length;
  const processingCount = tasks.filter((t) => t.state === 4).length;
  const failedCount = tasks.filter((t) => t.state === -1 || t.state === 3).length;

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = (t.title || t.params?.video_subject || t.task_id || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ready') return t.state === 1 || t.state === 2;
    if (statusFilter === 'processing') return t.state === 4;
    if (statusFilter === 'failed') return t.state === -1 || t.state === 3;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '34px' }}>
      {/* Top Banner Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div>
          <span className="eyebrow-label" style={{ display: 'block', marginBottom: '6px' }}>
            AI Video Generation Suite
          </span>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Creative Video Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', maxWidth: '640px', lineHeight: 1.5 }}>
            Transform product media, AI copywriting, and voiceovers into high-converting video campaigns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/new')}
            className="btn-vibrant"
          >
            <Plus size={17} />
            <span>New Video Ad</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip with Craft Elevation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '18px',
      }}>
        <div className="glass-panel" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="avatar-brand">
            <Film size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Projects
            </span>
            <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalProjects}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="avatar-brand">
            <CheckCircle2 size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ready to Publish
            </span>
            <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>{readyCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="avatar-brand">
            <Clock size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              In Generation
            </span>
            <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>{processingCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Status Filter Pills */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}>
          {[
            { id: 'all', label: `All (${totalProjects})` },
            { id: 'ready', label: `Ready (${readyCount})` },
            { id: 'processing', label: `Rendering (${processingCount})` },
            { id: 'failed', label: `Failed (${failedCount})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--brand-border)' : '1px solid transparent',
                  background: isActive ? 'var(--brand-light)' : 'transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 2px 6px rgba(234, 88, 12, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }} />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-input"
            style={{ paddingLeft: '38px', borderRadius: 'var(--radius-pill)', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="glass-panel"
              style={{ height: '260px', opacity: 0.6, animation: 'pulse 1.5s infinite' }}
            />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty State */
        <div className="glass-panel" style={{
          padding: '56px 32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div className="avatar-brand" style={{ width: '56px', height: '56px', borderRadius: '16px' }}>
            <Film size={26} color="#FFFFFF" />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>No video projects found</h3>
          {totalProjects === 0 ? (
            <>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', fontSize: '0.92rem', lineHeight: 1.5 }}>
                Ready to generate your first ad? Upload your product footage, pick an ad topic, and let Chronus do the rest.
              </p>
              <button
                onClick={() => navigate('/new')}
                className="btn-vibrant"
                style={{ marginTop: '6px' }}
              >
                <Sparkles size={16} />
                <span>Create First Ad</span>
              </button>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No projects match the selected filter.
            </p>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '22px',
        }}>
          {filteredTasks.map((task) => {
            const title = task.title || task.params?.video_subject || (task.task_id.startsWith('prj-') ? `Project ${task.task_id.slice(4, 12)}` : `Project ${task.task_id.slice(0, 8)}`);
            const aspect = task.params?.video_aspect || '9:16';
            const videoUrl = task.videos && task.videos[0]
              ? (task.videos[0].startsWith('http') || task.videos[0].startsWith('/')
                  ? task.videos[0]
                  : `/${task.videos[0]}`)
              : null;

            const isComplete = task.state === 1 || task.state === 2;

            return (
              <div
                key={task.task_id}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => setSelectedTask(task)}
              >
                {/* Header: Title, Status & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '3px',
                      color: 'var(--text-primary)',
                    }}>
                      {title}
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {aspect} · {task.params?.voice_name?.split('-')[0] || 'Studio'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getStatusBadge(task.state)}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTask(e, task.task_id)}
                      disabled={deletingTaskId === task.task_id}
                      className="btn-secondary"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--text-muted)',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete video project"
                    >
                      {deletingTaskId === task.task_id ? (
                        <Loader2 size={13} className="spin-icon" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Video Preview Box */}
                <div style={{
                  height: '155px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#1C1917',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.4)',
                }}>
                  {videoUrl ? (
                    <>
                      <video
                        src={videoUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        preload="metadata"
                      />
                      {/* Play overlay */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(28, 25, 23, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.95)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        }}>
                          <Play size={18} color="#1C1917" fill="#1C1917" style={{ marginLeft: '2px' }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}>
                      <Video size={28} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {task.state === 4 ? 'Rendering video...' : 'No preview available'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Bar & Footer */}
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}>
                    <span>{isComplete ? 'Ready to share' : task.state === 4 ? 'Rendering clips' : 'Status'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {task.progress || (isComplete ? 100 : 0)}%
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '5px',
                    background: 'var(--bg-surface-subtle)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${task.progress || (isComplete ? 100 : 0)}%`,
                      height: '100%',
                      background: 'var(--grad-brand)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Modal */}
      {selectedTask && (
        <VideoModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={(taskId) => handleDeleteTask(null, taskId)}
        />
      )}
    </div>
  );
};
