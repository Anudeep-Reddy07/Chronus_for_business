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
  RefreshCw,
  Play,
  Share2,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { apiClient, TaskItem } from '../api/client';
import { VideoModal } from '../components/VideoModal';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing' | 'failed'>('all');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

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
      setRefreshing(true);
      const data = await apiClient.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusBadge = (state: number) => {
    // TASK_STATE_COMPLETE = 1 or 2
    if (state === 1 || state === 2) {
      return (
        <span className="badge badge-complete">
          <CheckCircle2 size={12} />
          <span>Ready</span>
        </span>
      );
    }
    // TASK_STATE_PROCESSING = 4
    if (state === 4) {
      return (
        <span className="badge badge-processing">
          <Clock size={12} />
          <span>Processing</span>
        </span>
      );
    }
    // TASK_STATE_FAILED = -1 or 3
    if (state === -1 || state === 3) {
      return (
        <span className="badge badge-failed">
          <AlertCircle size={12} />
          <span>Failed</span>
        </span>
      );
    }
    return (
      <span className="badge badge-draft">
        <Clock size={12} />
        <span>Draft</span>
      </span>
    );
  };

  const totalProjects = tasks.length;
  const readyCount = tasks.filter((t) => t.state === 1 || t.state === 2).length;
  const processingCount = tasks.filter((t) => t.state === 4).length;
  const failedCount = tasks.filter((t) => t.state === -1 || t.state === 3).length;

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = (t.params?.video_subject || t.task_id || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ready') return t.state === 1 || t.state === 2;
    if (statusFilter === 'processing') return t.state === 4;
    if (statusFilter === 'failed') return t.state === -1 || t.state === 3;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 122, 0, 0.15)',
              border: '1px solid rgba(255, 122, 0, 0.35)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#FFAE34',
              textTransform: 'uppercase',
            }}>
              <Flame size={13} color="#FFAE34" />
              Hybrid Studio Active
            </span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Creative <span className="gradient-text">Video Studio</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', maxWidth: '600px' }}>
            Transform your product videos & photos into viral ad campaigns. Blended with stock footage and synthesized voiceovers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => loadTasks(false)}
            className="btn-glass"
            style={{ padding: '12px 16px' }}
            title="Refresh tasks"
          >
            <RefreshCw size={17} className={refreshing ? 'spin-icon' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => navigate('/new')}
            className="btn-primary"
          >
            <Plus size={18} />
            <span>New Video Ad</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '18px',
      }}>
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'var(--grad-sunset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(255, 0, 122, 0.35)',
          }}>
            <Film size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Projects
            </span>
            <h3 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{totalProjects}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'var(--grad-cyan-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(0, 223, 216, 0.35)',
          }}>
            <CheckCircle2 size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Ready to Publish
            </span>
            <h3 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{readyCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'var(--grad-pink-purple)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(121, 40, 202, 0.35)',
          }}>
            <Clock size={22} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              In Generation
            </span>
            <h3 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{processingCount}</h3>
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={17} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }} />
          <input
            type="text"
            placeholder="Search projects or IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input"
            style={{ paddingLeft: '40px', borderRadius: 'var(--radius-pill)', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="glass-panel"
              style={{ height: '260px', opacity: 0.4, animation: 'pulse 1.5s infinite' }}
            />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty State */
        <div className="glass-panel" style={{
          padding: '70px 30px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '24px',
            background: 'var(--grad-sunset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 15px 40px rgba(255, 0, 122, 0.4)',
          }}>
            <Film size={34} color="#FFFFFF" />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 800 }}>No video projects found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Ready to generate your first ad? Upload your product footage, pick an ad topic, and let Chronus do the rest.
          </p>
          <button
            onClick={() => navigate('/new')}
            className="btn-primary"
            style={{ marginTop: '10px' }}
          >
            <Sparkles size={18} />
            <span>Create First Ad</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '24px',
        }}>
          {filteredTasks.map((task) => {
            const title = task.params?.video_subject || `Project ${task.task_id.slice(0, 8)}`;
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
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => setSelectedTask(task)}
              >
                {/* Header: Title & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '1.18rem',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '4px',
                    }}>
                      {title}
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {aspect} · {task.params?.voice_name?.split('-')[0] || 'Studio'}
                    </span>
                  </div>
                  {getStatusBadge(task.state)}
                </div>

                {/* Video Preview Box */}
                <div style={{
                  height: '150px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
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
                        background: 'rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.85,
                        transition: 'opacity 0.2s',
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255, 255, 255, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)',
                        }}>
                          <Play size={20} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: '2px' }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-muted)',
                    }}>
                      <Video size={30} />
                      <span style={{ fontSize: '0.8rem' }}>
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
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {task.progress || (isComplete ? 100 : 0)}%
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${task.progress || (isComplete ? 100 : 0)}%`,
                      height: '100%',
                      background: isComplete ? 'var(--grad-cyan-blue)' : 'var(--grad-sunset)',
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
        />
      )}
    </div>
  );
};
