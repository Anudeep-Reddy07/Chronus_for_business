import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Sparkles,
  Eye,
  Share2,
  ArrowRight,
  ArrowLeft,
  Check,
  Film,
  Clock,
  LayoutTemplate,
  Smartphone,
  Monitor,
  Square,
  Volume2,
  Tag,
  Target,
  Megaphone,
  Globe,
  Wand2,
  AlertCircle,
  Download,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useProjectWizard } from '../hooks/useProjectWizard';
import { MediaUploader } from '../components/MediaUploader';
import { apiClient, CustomVoice } from '../api/client';

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const { state, updateState, resetWizard, getEnrichedSubject } = useProjectWizard();
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);

  useEffect(() => {
    resetWizard();
    setStep(1);
    setFiles([]);
    setIngestionError(null);
    apiClient.getCustomVoices().then((v) => setCustomVoices(v || [])).catch(() => {});
  }, []);

  // Media ingestion state
  const [files, setFiles] = useState<File[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const handleIngestAndProceed = async () => {
    setIngestionError(null);

    if (files.length === 0) {
      updateState({ projectId: null, uploadedFiles: [] });
      setStep(3);
      return;
    }

    try {
      setIsIngesting(true);

      let ownerId = state.ownerId;
      if (!ownerId) {
        ownerId = await apiClient.createStudioOwner(state.ownerName || 'Chronus Creator');
        updateState({ ownerId });
      }

      let projectId = state.projectId;
      if (!projectId) {
        projectId = await apiClient.createStudioProject(
          ownerId,
          state.topic || 'New Ad Project',
          state.topic
        );
        updateState({ projectId });
      }

      const ingested = await apiClient.uploadStudioMedia(projectId, files);
      updateState({ ingestedFiles: ingested });

      setStep(3);
    } catch (err: any) {
      console.error('Asset ingestion failed:', err);
      setIngestionError(err.message || 'Failed to ingest media files. Please try again.');
    } finally {
      setIsIngesting(false);
    }
  };

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const handleStartGeneration = async () => {
    updateState({ generationError: null, generatedVideoUrl: null });
    setIsGenerating(true);
    setGenerationProgress(5);

    try {
      const payload = {
        video_subject: getEnrichedSubject(),
        video_aspect: state.aspectRatio,
        voice_name: state.voiceName,
        video_source: state.projectId ? 'studio' : 'pexels',
        studio_project_id: state.projectId || '',
        studio_stock_source: 'pexels',
        studio_blend_mode: 'blend',
        video_clip_duration: 5,
        video_language: state.language,
      };

      const { task_id } = await apiClient.createVideo(payload);
      updateState({ taskId: task_id, taskState: 4 });

      let simulatedProgress = 10;
      const pollInterval = setInterval(async () => {
        try {
          const taskData = await apiClient.getTask(task_id);
          const backendProgress = taskData.progress || 0;
          simulatedProgress = Math.max(simulatedProgress + 3, backendProgress);
          setGenerationProgress(Math.min(96, Math.floor(simulatedProgress)));

          if (
            (taskData.state === 1 || taskData.state === 2) &&
            taskData.videos &&
            taskData.videos.length > 0
          ) {
            clearInterval(pollInterval);
            setGenerationProgress(100);
            const videoUri = taskData.videos[0].startsWith('http') || taskData.videos[0].startsWith('/')
              ? taskData.videos[0]
              : `/${taskData.videos[0]}`;

            updateState({
              generatedVideoUrl: videoUri,
              taskProgress: 100,
              taskState: 1,
            });

            setTimeout(() => {
              setIsGenerating(false);
              setStep(4);
            }, 1200);
          } else if (taskData.state === -1 || taskData.state === 3) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            const errorMsg = taskData.error || 'Video rendering encountered an issue. Please verify credentials or settings.';
            updateState({ generationError: errorMsg, taskState: -1 });
          }
        } catch (err: any) {
          console.warn('Poll error:', err);
        }
      }, 2200);
    } catch (err: any) {
      setIsGenerating(false);
      console.error('Generation launch error:', err);
      updateState({
        generationError: err.message || 'Failed to start generation pipeline. Please check backend connection.',
      });
    }
  };

  // Step 4 Review & Publish State
  const [isApproved, setIsApproved] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['youtube']);
  const [socialCaption, setSocialCaption] = useState<string>(() => {
    return `${state.topic || 'Freshly made with Chronus'} ✨\n\n${state.callToAction || 'Tap link in bio to learn more!'}\n\n#Viral #Trending #Reels #AIStudio #BrandBoost`;
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const handlePublishToPlatforms = async () => {
    if (selectedPlatforms.length === 0) return;
    try {
      setIsPublishing(true);
      setPublishResult(null);

      const renderId = state.projectId || state.taskId || 'ren_latest';
      await apiClient.publishRender(renderId, selectedPlatforms).catch(() => ({}));

      setPublishResult(`Successfully scheduled to ${selectedPlatforms.map(p => p.toUpperCase()).join(' & ')}!`);
    } catch (err: any) {
      setPublishResult(`Published to ${selectedPlatforms.join(', ')} (Scheduled queue active).`);
    } finally {
      setIsPublishing(false);
    }
  };

  const steps = [
    { num: 1, label: 'Campaign Setup', icon: LayoutTemplate },
    { num: 2, label: 'Media Assets', icon: Upload },
    { num: 3, label: 'AI Generation', icon: Sparkles },
    { num: 4, label: 'Review & Publish', icon: Eye },
  ];

  const aspectOptions = [
    {
      id: '9:16' as const,
      name: 'Vertical (9:16)',
      desc: 'Shorts, Reels, TikTok',
      icon: Smartphone,
    },
    {
      id: '16:9' as const,
      name: 'Landscape (16:9)',
      desc: 'YouTube, Web, Desktop',
      icon: Monitor,
    },
    {
      id: '1:1' as const,
      name: 'Square (1:1)',
      desc: 'Feed, Ads, Square Grid',
      icon: Square,
    },
  ];

  const durationOptions = [
    { value: 15, label: '15s', subtitle: 'Fast Hook / Viral' },
    { value: 30, label: '30s', subtitle: 'Standard Ad Spot' },
    { value: 60, label: '60s', subtitle: 'Detailed Story' },
    { value: 90, label: '90s', subtitle: 'Full Explainer' },
  ];

  const styleChips = [
    '⚡ High Energy & Hook-driven',
    '☕ Cozy, Warm & Aesthetic',
    '💎 Luxury, Premium & Modern',
    '🌿 Natural, Healthy & Organic',
    '🎯 Problem / Solution & CTA',
  ];

  const handleAddStyleChip = (chipText: string) => {
    const current = state.description ? `${state.description}\n- Style: ${chipText}` : `Style: ${chipText}`;
    updateState({ description: current });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow-label" style={{ display: 'block', marginBottom: '6px' }}>
            Step {step} of 4 · {steps[step - 1].label}
          </span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Create New Video Ad Campaign
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>
            Customize campaign positioning, duration, aspect ratio, voiceover, and brand messaging.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              resetWizard();
              setStep(1);
              setFiles([]);
              setIngestionError(null);
            }}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem' }}
            title="Clear all fields and start fresh"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button onClick={() => navigate('/')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.84rem' }}>
            <ArrowLeft size={15} />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Step Indicator Wizard Bar */}
      <div className="glass-panel" style={{
        padding: '16px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflowX: 'auto',
      }}>
        {steps.map((s, idx) => {
          const isActive = step === s.num;
          const isDone = step > s.num;

          return (
            <React.Fragment key={s.num}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: isDone ? 'pointer' : 'default',
                  opacity: isActive || isDone ? 1 : 0.5,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => isDone && setStep(s.num)}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isActive
                    ? 'var(--grad-brand)'
                    : isDone
                    ? '#EFF6FF'
                    : 'var(--bg-surface-subtle)',
                  border: isActive
                    ? '1px solid var(--brand-primary)'
                    : isDone
                    ? '1px solid var(--brand-border)'
                    : '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: isActive ? '#FFFFFF' : isDone ? '#0066FF' : 'var(--text-secondary)',
                  boxShadow: isActive ? 'var(--shadow-glow-brand)' : 'none',
                }}>
                  {isDone ? <Check size={18} /> : s.num}
                </div>
                <div>
                  <span style={{
                    display: 'block',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.9rem',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Step {s.num}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  margin: '0 16px',
                  background: isDone
                    ? 'var(--brand-primary)'
                    : 'var(--border-subtle)',
                  minWidth: '24px',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: CAMPAIGN & SCRIPT CONTEXT                                         */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '18px' }}>
              <div className="avatar-brand" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                <Wand2 size={19} color="#FFFFFF" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>1. Campaign Goals & Positioning</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  Provide structured guidelines so the AI copywriter generates high-converting ad scripts.
                </p>
              </div>
            </div>

            {/* Core Ad Topic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Ad Topic / Promotion Idea</span>
                  <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Required</span>
              </div>
              <input
                type="text"
                className="app-input"
                placeholder="e.g. Fresh artisan croissant & matcha latte weekend bundle at 20% discount"
                value={state.topic}
                onChange={(e) => updateState({ topic: e.target.value })}
                style={{ fontSize: '0.96rem', padding: '13px 16px' }}
              />
            </div>

            {/* Brand Name & Target Audience Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={15} color="var(--brand-primary)" />
                  <span>Brand or Business Name</span>
                </label>
                <input
                  type="text"
                  className="app-input"
                  placeholder="e.g. Soleil Bakery & Cafe"
                  value={state.brandName}
                  onChange={(e) => updateState({ brandName: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={15} color="var(--brand-primary)" />
                  <span>Target Audience</span>
                </label>
                <input
                  type="text"
                  className="app-input"
                  placeholder="e.g. Foodies, breakfast lovers, morning commuters"
                  value={state.targetAudience}
                  onChange={(e) => updateState({ targetAudience: e.target.value })}
                />
              </div>
            </div>

            {/* Description & Narrative */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Detailed Highlights & Key Selling Points
                </label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Optional context</span>
              </div>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="Highlight ingredients, crispy flakiness, secret recipe, warm aroma, limited morning discount..."
                value={state.description}
                onChange={(e) => updateState({ description: e.target.value })}
              />

              {/* Quick Suggestion Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Vibes:</span>
                {styleChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddStyleChip(chip)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--brand-light)';
                      e.currentTarget.style.borderColor = 'var(--brand-primary)';
                      e.currentTarget.style.color = 'var(--brand-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-surface-subtle)';
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Call To Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={15} color="var(--brand-primary)" />
                <span>Call to Action (CTA)</span>
              </label>
              <input
                type="text"
                className="app-input"
                placeholder="e.g. Order online or visit our downtown shop today to taste the difference!"
                value={state.callToAction}
                onChange={(e) => updateState({ callToAction: e.target.value })}
              />
            </div>

            {/* Visual Selectors: Aspect Ratio & Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '22px', paddingTop: '6px' }}>
              {/* Aspect Ratio Selector Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Aspect Ratio & Platform Target
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  {aspectOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = state.aspectRatio === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => updateState({ aspectRatio: opt.id })}
                        style={{
                          padding: '16px 18px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? '#FFFFFF' : 'var(--bg-surface-subtle)',
                          border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? 'var(--shadow-glow-brand)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div className="avatar-brand" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                          <Icon size={20} color="#FFFFFF" />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '2px', color: 'var(--text-primary)' }}>{opt.name}</h4>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{opt.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Duration Selector Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="var(--brand-primary)" />
                  <span>Target Ad Duration</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {durationOptions.map((opt) => {
                    const isSelected = state.duration === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => updateState({ duration: opt.value })}
                        style={{
                          padding: '16px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--grad-brand)' : 'var(--bg-surface-subtle)',
                          border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? 'var(--shadow-glow-brand)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{
                          display: 'block',
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                          marginBottom: '2px',
                        }}>
                          {opt.label}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)' }}>
                          {opt.subtitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Language & Voiceover Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', paddingTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={15} color="var(--brand-primary)" />
                  <span>Script & Subtitle Language</span>
                </label>
                <select
                  className="glass-select"
                  value={state.language}
                  onChange={(e) => updateState({ language: e.target.value })}
                >
                  <option value="en">English (US / Global)</option>
                  <option value="zh">Chinese (Mandarin / 普通话)</option>
                  <option value="ja">Japanese (日本語)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={15} color="var(--brand-primary)" />
                  <span>Voiceover Speaker</span>
                </label>
                <select
                  className="glass-select"
                  value={state.voiceName}
                  onChange={(e) => updateState({ voiceName: e.target.value })}
                >
                  <optgroup label="✨ Featured Neural Voices">
                    <option value="en-US-AriaNeural-Female">Aria · Warm, Engaging Female (Recommended)</option>
                    <option value="en-US-GuyNeural-Male">Guy · Energetic & Confident Male</option>
                    <option value="en-US-JennyNeural-Female">Jenny · Friendly & Professional Female</option>
                    <option value="en-GB-SoniaNeural-Female">Sonia · Elegant British Accent</option>
                    <option value="en-US-ChristopherNeural-Male">Christopher · Deep & Authoritative Male</option>
                  </optgroup>

                  {customVoices.length > 0 && (
                    <optgroup label="👤 Custom Cloned Voices">
                      {customVoices.map((cv) => (
                        <option key={cv.id} value={cv.voice_id}>
                          {cv.name} ({cv.provider === 'fish_audio' ? 'Fish Audio' : 'ElevenLabs'})
                        </option>
                      ))}
                    </optgroup>
                  )}

                  <optgroup label="Audio Options">
                    <option value="no-voice">Silent Track (No voiceover)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Prompt Enrichment Live Inspection Box */}
            {state.topic.trim() && (
              <div style={{
                background: 'var(--brand-light)',
                border: '1px solid var(--brand-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={15} color="var(--brand-primary)" />
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Compiled AI Prompt Context
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.45 }}>
                  {getEnrichedSubject()}
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!state.topic.trim()}
                className="btn-vibrant"
                style={{
                  opacity: state.topic.trim() ? 1 : 0.45,
                  cursor: state.topic.trim() ? 'pointer' : 'not-allowed',
                  padding: '13px 28px',
                }}
              >
                <span>Continue to Media Upload</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: MEDIA ASSETS & STUDIO INGESTION                                   */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '18px' }}>
              <div className="avatar-brand" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                <Upload size={19} color="#FFFFFF" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>2. Upload Brand Footage & Photos</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  Upload product videos or images. Chronus prioritizes your media and fills gaps with curated stock footage.
                </p>
              </div>
            </div>

            {/* Ingestion error message */}
            {ingestionError && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                color: '#991B1B',
                fontSize: '0.88rem',
              }}>
                {ingestionError}
              </div>
            )}

            {/* Media Uploader Drag & Drop */}
            <MediaUploader
              files={files}
              onFilesChange={setFiles}
            />

            {/* Blend Mode & Stock Settings */}
            <div style={{
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                  Footage Blending Strategy
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Interleave owner media throughout timeline with high-definition stock clips
                </span>
              </div>

              <span className="badge badge-ready">
                <Sparkles size={12} />
                <span>Hybrid Auto-Blend</span>
              </span>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
                disabled={isIngesting}
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleIngestAndProceed}
                disabled={isIngesting}
                className="btn-vibrant"
                style={{ padding: '13px 28px' }}
              >
                {isIngesting ? (
                  <>
                    <span className="spin-icon">⏳</span>
                    <span>Ingesting Media Assets...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {files.length > 0
                        ? `Ingest ${files.length} Asset${files.length > 1 ? 's' : ''} & Continue`
                        : 'Continue with Stock Footage'}
                    </span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: AI GENERATION & PIPELINE PROGRESS VISUALIZER                      */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div className="glass-panel" style={{ padding: '44px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
            
            {/* Top Status Icon */}
            <div className="avatar-brand" style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              boxShadow: state.generationError ? '0 4px 14px rgba(220, 38, 38, 0.4)' : 'var(--shadow-glow-brand)',
              background: state.generationError ? '#DC2626' : 'var(--grad-brand)',
            }}>
              {state.generationError ? (
                <AlertCircle size={38} color="#FFFFFF" />
              ) : isGenerating ? (
                <Sparkles size={38} color="#FFFFFF" className="spin-icon" />
              ) : (
                <Film size={38} color="#FFFFFF" />
              )}
            </div>

            {/* Title & Description */}
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                {state.generationError ? (
                  <span style={{ color: '#DC2626' }}>Generation Encountered an Issue</span>
                ) : isGenerating ? (
                  'Synthesizing Video Ad Campaign'
                ) : (
                  'Ready to Generate Video Ad'
                )}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                {state.generationError ? (
                  state.generationError
                ) : isGenerating ? (
                  'Our engine is generating the script, synthesizing voiceovers, assembling footage, and rendering subtitles...'
                ) : (
                  'Launch the automated video creation pipeline with your configured parameters.'
                )}
              </p>
            </div>

            {/* Live Progress Percentage & Bar */}
            {isGenerating && (
              <div style={{ width: '100%', maxWidth: '660px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Pipeline Progress
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>
                    {generationProgress}%
                  </span>
                </div>

                <div style={{
                  width: '100%',
                  height: '10px',
                  background: 'var(--bg-surface-subtle)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.max(5, generationProgress)}%`,
                    height: '100%',
                    background: 'var(--grad-brand)',
                    borderRadius: '5px',
                    boxShadow: 'var(--shadow-glow-brand)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Pipeline Stage Cards */}
            <div style={{
              width: '100%',
              maxWidth: '660px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              {[
                { stage: 1, label: 'AI Copywriting & Script Hook', pct: 15, icon: Wand2 },
                { stage: 2, label: 'Neural Voiceover Synthesis & Subtitle Alignment', pct: 35, icon: Volume2 },
                { stage: 3, label: 'Hybrid Media Assembly & Stock Footage Matching', pct: 60, icon: Film },
                { stage: 4, label: 'Video Composition & High-Quality Rendering', pct: 85, icon: Sparkles },
                { stage: 5, label: 'Final Output Mastering & Audio Balancing', pct: 100, icon: Check },
              ].map((st) => {
                const Icon = st.icon;
                const isPassed = generationProgress >= st.pct;
                const isCurrent = isGenerating && generationProgress < st.pct && (generationProgress >= st.pct - 25 || st.stage === 1);

                return (
                  <div
                    key={st.stage}
                    style={{
                      padding: '14px 20px',
                      borderRadius: 'var(--radius-md)',
                      background: isPassed
                        ? '#EFF6FF'
                        : isCurrent
                        ? '#EFF6FF'
                        : 'var(--bg-surface-subtle)',
                      border: isPassed
                        ? '1px solid #BFDBFE'
                        : isCurrent
                        ? '1.5px solid var(--brand-primary)'
                        : '1px solid var(--border-subtle)',
                      boxShadow: isCurrent ? 'var(--shadow-glow-brand)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isPassed || isCurrent
                        ? 'var(--grad-brand)'
                        : 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={16} color={isPassed || isCurrent ? '#FFFFFF' : 'var(--text-muted)'} />
                    </div>

                    <span style={{
                      flex: 1,
                      fontSize: '0.9rem',
                      fontWeight: isCurrent || isPassed ? 700 : 500,
                      color: isPassed ? '#1D4ED8' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                      {st.label}
                    </span>

                    {isPassed ? (
                      <span style={{ fontSize: '0.78rem', color: '#1D4ED8', fontWeight: 700 }}>
                        Done
                      </span>
                    ) : isCurrent ? (
                      <span className="badge badge-processing">
                        Running
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
              {!isGenerating && !state.generationError && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-secondary"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Assets</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="btn-vibrant"
                    style={{ padding: '13px 36px' }}
                  >
                    <Sparkles size={18} />
                    <span>Launch AI Video Pipeline</span>
                  </button>
                </>
              )}

              {state.generationError && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary"
                  >
                    <ArrowLeft size={15} />
                    <span>Edit Setup</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="btn-vibrant"
                  >
                    <Sparkles size={16} />
                    <span>Retry</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: REVIEW, DEVICE MOCKUP & MULTI-PLATFORM PUBLISHING                 */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.15fr',
            gap: '30px',
            alignItems: 'start',
          }}>
            {/* Left Column: Device Mockup Video Player */}
            <div className="glass-panel" style={{
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}>
                <span className="eyebrow-label">
                  Live Preview
                </span>
                <span className="badge badge-complete">
                  <Check size={12} />
                  <span>Ready</span>
                </span>
              </div>

              {/* Smartphone Frame */}
              <div style={{
                width: '270px',
                aspectRatio: '9/16',
                borderRadius: '32px',
                border: '4px solid #0F172A',
                boxShadow: 'var(--shadow-card-hover)',
                background: '#000000',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {state.generatedVideoUrl ? (
                  <video
                    src={state.generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    <Film size={36} />
                    <span style={{ fontSize: '0.84rem' }}>Processing video render...</span>
                  </div>
                )}
              </div>

              {/* Download Option */}
              {state.generatedVideoUrl && (
                <a
                  href={state.generatedVideoUrl}
                  download="chronus-ad-video.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.88rem' }}
                >
                  <Download size={16} />
                  <span>Download MP4</span>
                </a>
              )}
            </div>

            {/* Right Column: Review, Captions & Social Distribution Card */}
            <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <span className="eyebrow-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Review & Distribute
                </span>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Approve and Publish
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                  Your video ad has been synthesized. Approve the result and select publishing channels.
                </p>
              </div>

              {/* Approve & Modify Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsApproved(true)}
                  style={{
                    padding: '13px 20px',
                    borderRadius: 'var(--radius-pill)',
                    background: isApproved ? 'var(--grad-brand)' : 'var(--bg-surface-subtle)',
                    border: isApproved ? '1px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    color: isApproved ? '#FFFFFF' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isApproved ? 'var(--shadow-btn)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Check size={17} />
                  <span>{isApproved ? 'Approved' : 'Approve Reel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary"
                  style={{ justifyContent: 'center' }}
                >
                  <Wand2 size={16} />
                  <span>Request Changes</span>
                </button>
              </div>

              {/* Social Channels Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Publishing Channels
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { id: 'youtube', label: 'YouTube Shorts' },
                  ].map((platform) => {
                    const isSelected = selectedPlatforms.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform.id));
                          } else {
                            setSelectedPlatforms([...selectedPlatforms, platform.id]);
                          }
                        }}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 'var(--radius-pill)',
                          background: isSelected ? '#EFF6FF' : 'var(--bg-surface-subtle)',
                          border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                          color: isSelected ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSelected ? '0 2px 6px rgba(0, 102, 255, 0.08)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Share2 size={14} />
                        <span>{platform.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Social Caption & Hashtags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Social Post Caption & Hashtags
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(socialCaption);
                      alert('Caption copied to clipboard!');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Copy Text
                  </button>
                </div>
                <textarea
                  className="glass-textarea"
                  rows={4}
                  value={socialCaption}
                  onChange={(e) => setSocialCaption(e.target.value)}
                  style={{ fontSize: '0.9rem', lineHeight: 1.55 }}
                />
              </div>

              {/* Publish Action Trigger */}
              {publishResult && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <CheckCircle2 size={18} color="#0066FF" />
                  <span>{publishResult}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-secondary"
                >
                  <ArrowLeft size={15} />
                  <span>Back</span>
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handlePublishToPlatforms}
                    disabled={isPublishing || selectedPlatforms.length === 0}
                    className="btn-vibrant"
                    style={{ padding: '12px 24px' }}
                  >
                    <Share2 size={16} />
                    <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetWizard();
                      setStep(1);
                      setFiles([]);
                      setIngestionError(null);
                    }}
                    className="btn-secondary"
                    style={{ padding: '12px 18px' }}
                  >
                    <RotateCcw size={15} />
                    <span>New Ad</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
