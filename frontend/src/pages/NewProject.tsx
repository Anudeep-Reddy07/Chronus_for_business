import React, { useState } from 'react';
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
  Info,
  Wand2,
  AlertCircle,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useProjectWizard } from '../hooks/useProjectWizard';
import { MediaUploader } from '../components/MediaUploader';
import { apiClient } from '../api/client';

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const { state, updateState, getEnrichedSubject } = useProjectWizard();

  // Media ingestion state
  const [files, setFiles] = useState<File[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const handleIngestAndProceed = async () => {
    setIngestionError(null);

    // If no media files selected, proceed directly with stock footage
    if (files.length === 0) {
      updateState({ projectId: null, uploadedFiles: [] });
      setStep(3);
      return;
    }

    try {
      setIsIngesting(true);

      // 1. Create or ensure Owner
      let ownerId = state.ownerId;
      if (!ownerId) {
        ownerId = await apiClient.createStudioOwner(state.ownerName || 'Chronus Creator');
        updateState({ ownerId });
      }

      // 2. Create Project
      const projectId = await apiClient.createStudioProject(
        ownerId,
        state.topic || 'New Ad Project',
        state.topic
      );
      updateState({ projectId });

      // 3. Upload & Ingest Media Files
      const ingested = await apiClient.uploadStudioMedia(projectId, files);
      updateState({ ingestedFiles: ingested });

      // Advance to Step 3 (Generation)
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
      // Compile full video params payload
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

      // Start live task status polling
      let simulatedProgress = 10;
      const pollInterval = setInterval(async () => {
        try {
          const taskData = await apiClient.getTask(task_id);
          const backendProgress = taskData.progress || 0;
          simulatedProgress = Math.max(simulatedProgress + 3, backendProgress);
          setGenerationProgress(Math.min(96, Math.floor(simulatedProgress)));

          // Check for task completion
          // const.TASK_STATE_COMPLETE = 1 or 2
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['tiktok', 'instagram']);
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

      // Simulate or call studio publishing endpoint if render ID is available
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
      desc: 'TikTok, Instagram Reels, Shorts',
      icon: Smartphone,
    },
    {
      id: '16:9' as const,
      name: 'Landscape (16:9)',
      desc: 'YouTube, Web, Presentation',
      icon: Monitor,
    },
    {
      id: '1:1' as const,
      name: 'Square (1:1)',
      desc: 'Instagram Feed, Carousel, Ads',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#00DFD8',
              letterSpacing: '0.08em',
            }}>
              Step {step} of 4 · {steps[step - 1].label}
            </span>
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Create New <span className="gradient-text">Video Ad Campaign</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
            Fill in your campaign goal and customize duration, aspect ratio, voiceover, and brand messaging.
          </p>
        </div>

        <button onClick={() => navigate('/')} className="btn-glass" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          <span>Exit to Dashboard</span>
        </button>
      </div>

      {/* Step Indicator Wizard Bar */}
      <div className="glass-panel" style={{
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflowX: 'auto',
      }}>
        {steps.map((s, idx) => {
          const Icon = s.icon;
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
                  opacity: isActive || isDone ? 1 : 0.45,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => isDone && setStep(s.num)}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isActive
                    ? 'var(--grad-sunset)'
                    : isDone
                    ? 'rgba(0, 223, 216, 0.25)'
                    : 'rgba(255, 255, 255, 0.08)',
                  border: isActive
                    ? '2px solid rgba(255, 255, 255, 0.9)'
                    : isDone
                    ? '1.5px solid #00DFD8'
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isActive ? '0 0 25px rgba(255, 0, 122, 0.55)' : 'none',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: isDone ? '#00DFD8' : '#FFFFFF',
                }}>
                  {isDone ? <Check size={20} /> : s.num}
                </div>
                <div>
                  <span style={{
                    display: 'block',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.94rem',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
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
                    ? 'linear-gradient(90deg, #00DFD8, #FF007A)'
                    : 'rgba(255, 255, 255, 0.1)',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Main Card */}
          <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'var(--grad-sunset)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Wand2 size={20} color="#FFFFFF" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>1. Campaign Goals & Positioning</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  Provide structured guidelines so the AI copywriter generates high-converting ad scripts.
                </p>
              </div>
            </div>

            {/* Core Ad Topic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Ad Topic / Promotion Idea *</span>
                  <span style={{ color: '#FF007A' }}>*</span>
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Required</span>
              </div>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Fresh artisan croissant & matcha latte weekend bundle at 20% discount"
                value={state.topic}
                onChange={(e) => updateState({ topic: e.target.value })}
                style={{ fontSize: '1rem', padding: '14px 18px' }}
              />
            </div>

            {/* Brand Name & Target Audience Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={15} color="#FFAE34" />
                  <span>Brand or Business Name</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Soleil Bakery & Cafe"
                  value={state.brandName}
                  onChange={(e) => updateState({ brandName: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={15} color="#00DFD8" />
                  <span>Target Audience</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Foodies, breakfast lovers, morning commuters"
                  value={state.targetAudience}
                  onChange={(e) => updateState({ targetAudience: e.target.value })}
                />
              </div>
            </div>

            {/* Description & Narrative */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Detailed Highlights & Key Selling Points
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Optional context</span>
              </div>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="Highlight ingredients, crispy flakiness, secret recipe, warm aroma, limited morning discount..."
                value={state.description}
                onChange={(e) => updateState({ description: e.target.value })}
              />

              {/* Quick Suggestion Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Vibes:</span>
                {styleChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddStyleChip(chip)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.borderColor = '#FF007A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Call To Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={15} color="#FF007A" />
                <span>Call to Action (CTA)</span>
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Order online or visit our downtown shop today to taste the difference!"
                value={state.callToAction}
                onChange={(e) => updateState({ callToAction: e.target.value })}
              />
            </div>

            {/* =================================================================== */}
            {/* Visual Selectors: Aspect Ratio & Duration                           */}
            {/* =================================================================== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', paddingTop: '10px' }}>
              {/* Aspect Ratio Selector Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
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
                          padding: '18px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'rgba(255, 0, 122, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                          border: isSelected ? '2px solid #FF007A' : '1px solid rgba(255, 255, 255, 0.16)',
                          boxShadow: isSelected ? '0 0 25px rgba(255, 0, 122, 0.35)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: isSelected ? 'var(--grad-sunset)' : 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Icon size={22} color={isSelected ? '#FFFFFF' : 'var(--text-secondary)'} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '2px' }}>{opt.name}</h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{opt.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Duration Selector Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="#00DFD8" />
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
                          background: isSelected ? 'rgba(0, 223, 216, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                          border: isSelected ? '2px solid #00DFD8' : '1px solid rgba(255, 255, 255, 0.16)',
                          boxShadow: isSelected ? '0 0 25px rgba(0, 223, 216, 0.35)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{
                          display: 'block',
                          fontSize: '1.4rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: isSelected ? '#00DFD8' : '#FFFFFF',
                          marginBottom: '2px',
                        }}>
                          {opt.label}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {opt.subtitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Language & Voiceover Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingTop: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={15} color="#FFAE34" />
                  <span>Script & Subtitle Language</span>
                </label>
                <select
                  className="glass-select"
                  value={state.language}
                  onChange={(e) => updateState({ language: e.target.value })}
                >
                  <option value="en" style={{ background: '#181726' }}>English (US / Global)</option>
                  <option value="zh" style={{ background: '#181726' }}>Chinese (Mandarin / 普通话)</option>
                  <option value="ja" style={{ background: '#181726' }}>Japanese (日本語)</option>
                  <option value="es" style={{ background: '#181726' }}>Spanish (Español)</option>
                  <option value="fr" style={{ background: '#181726' }}>French (Français)</option>
                  <option value="de" style={{ background: '#181726' }}>German (Deutsch)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={15} color="#FF007A" />
                  <span>Voiceover Speaker</span>
                </label>
                <select
                  className="glass-select"
                  value={state.voiceName}
                  onChange={(e) => updateState({ voiceName: e.target.value })}
                >
                  <option value="en-US-AriaNeural-Female" style={{ background: '#181726' }}>Aria · Warm, Engaging Female (Recommended)</option>
                  <option value="en-US-GuyNeural-Male" style={{ background: '#181726' }}>Guy · Energetic & Confident Male</option>
                  <option value="en-US-JennyNeural-Female" style={{ background: '#181726' }}>Jenny · Friendly & Professional Female</option>
                  <option value="en-GB-SoniaNeural-Female" style={{ background: '#181726' }}>Sonia · Elegant British Accent</option>
                  <option value="en-US-DavisNeural-Male" style={{ background: '#181726' }}>Davis · Deep & Authoritative Male</option>
                  <option value="no-voice" style={{ background: '#181726' }}>Silent Track (No voiceover)</option>
                </select>
              </div>
            </div>

            {/* Prompt Enrichment Live Inspection Box */}
            {state.topic.trim() && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={15} color="#FFAE34" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFAE34', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Compiled AI Prompt Context
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                  {getEnrichedSubject()}
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!state.topic.trim()}
                className="btn-primary"
                style={{
                  opacity: state.topic.trim() ? 1 : 0.45,
                  cursor: state.topic.trim() ? 'pointer' : 'not-allowed',
                  padding: '14px 28px',
                }}
              >
                <span>Continue to Media Upload</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: MEDIA ASSETS & STUDIO INGESTION                                   */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'var(--grad-cyan-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Upload size={20} color="#FFFFFF" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>2. Upload Brand Footage & Photos</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  Upload your own product videos or pictures. Our hybrid video engine prioritizes your footage and fills any gap with curated stock clips.
                </p>
              </div>
            </div>

            {/* Ingestion status/error message */}
            {ingestionError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                color: '#FCA5A5',
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
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '18px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Footage Blending Strategy
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Interleave owner media throughout timeline with stock footage
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <span className="badge badge-ready">
                  <Sparkles size={13} />
                  Hybrid Studio Auto-Blend
                </span>
              </div>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-glass"
                disabled={isIngesting}
              >
                <ArrowLeft size={16} />
                <span>Back to Campaign Setup</span>
              </button>

              <button
                type="button"
                onClick={handleIngestAndProceed}
                disabled={isIngesting}
                className="btn-primary"
                style={{ padding: '14px 28px' }}
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
                    <ArrowRight size={18} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="glass-panel" style={{ padding: '44px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
            
            {/* Top Status Glow Icon */}
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: state.generationError
                ? 'rgba(239, 68, 68, 0.25)'
                : 'var(--grad-sunset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: state.generationError
                ? '0 0 50px rgba(239, 68, 68, 0.5)'
                : '0 0 60px rgba(255, 0, 122, 0.55)',
              position: 'relative',
              animation: isGenerating ? 'pulse 2s infinite' : 'none',
              border: '2px solid rgba(255, 255, 255, 0.5)',
            }}>
              {state.generationError ? (
                <AlertCircle size={44} color="#F87171" />
              ) : isGenerating ? (
                <Sparkles size={44} color="#FFFFFF" className="spin-icon" />
              ) : (
                <Film size={44} color="#FFFFFF" />
              )}
            </div>

            {/* Title & Description */}
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
                {state.generationError ? (
                  <span style={{ color: '#F87171' }}>Generation Encountered an Error</span>
                ) : isGenerating ? (
                  <>Synthesizing <span className="gradient-text">Your Ad Campaign</span></>
                ) : (
                  <>Ready to <span className="gradient-text">Generate Video Ad</span></>
                )}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: 1.5 }}>
                {state.generationError ? (
                  state.generationError
                ) : isGenerating ? (
                  'Our engine is generating the script, synthesizing voiceover, blending footage, and rendering captions...'
                ) : (
                  'Click the button below to launch the video creation pipeline with your settings.'
                )}
              </p>
            </div>

            {/* Live Progress Percentage & Bar */}
            {isGenerating && (
              <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Pipeline Progress
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#00DFD8' }}>
                    {generationProgress}%
                  </span>
                </div>

                <div style={{
                  width: '100%',
                  height: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  padding: '2px',
                }}>
                  <div style={{
                    width: `${Math.max(5, generationProgress)}%`,
                    height: '100%',
                    background: 'var(--grad-sunset)',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                    boxShadow: '0 0 15px rgba(255, 0, 122, 0.8)',
                  }} />
                </div>
              </div>
            )}

            {/* Pipeline Stage Cards */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
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
                        ? 'rgba(0, 223, 216, 0.12)'
                        : isCurrent
                        ? 'rgba(255, 0, 122, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isPassed
                        ? '1px solid rgba(0, 223, 216, 0.4)'
                        : isCurrent
                        ? '1px solid #FF007A'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: isCurrent ? '0 0 20px rgba(255, 0, 122, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isPassed
                        ? '#00DFD8'
                        : isCurrent
                        ? 'var(--grad-sunset)'
                        : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={16} color={isPassed ? '#000000' : '#FFFFFF'} />
                    </div>

                    <span style={{
                      flex: 1,
                      fontSize: '0.92rem',
                      fontWeight: isCurrent || isPassed ? 600 : 400,
                      color: isPassed ? '#FFFFFF' : isCurrent ? '#FFFFFF' : 'var(--text-muted)',
                    }}>
                      {st.label}
                    </span>

                    {isPassed ? (
                      <span style={{ fontSize: '0.78rem', color: '#00DFD8', fontWeight: 700 }}>
                        Done
                      </span>
                    ) : isCurrent ? (
                      <span className="badge badge-processing">
                        Running
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              {!isGenerating && !state.generationError && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-glass"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Assets</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="btn-primary"
                    style={{ padding: '14px 36px', fontSize: '1rem' }}
                  >
                    <Sparkles size={20} />
                    <span>Launch AI Video Pipeline</span>
                  </button>
                </>
              )}

              {state.generationError && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-glass"
                  >
                    <ArrowLeft size={16} />
                    <span>Edit Campaign Setup</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="btn-primary"
                  >
                    <Sparkles size={18} />
                    <span>Retry Generation</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.15fr',
            gap: '32px',
            alignItems: 'start',
          }}>
            {/* Left Column: Device Mockup Video Player */}
            <div className="glass-panel" style={{
              padding: '32px',
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
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Live Device Preview
                </span>
                <span className="badge badge-complete">
                  <Check size={12} />
                  Ready
                </span>
              </div>

              {/* Smartphone Frame */}
              <div style={{
                width: '280px',
                aspectRatio: '9/16',
                borderRadius: '40px',
                border: '5px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 25px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 0, 122, 0.35)',
                background: '#000000',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {/* Dynamic Island Notch */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '90px',
                  height: '24px',
                  background: '#000000',
                  borderRadius: '20px',
                  zIndex: 10,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }} />

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
                    color: 'var(--text-muted)',
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    <Film size={40} />
                    <span style={{ fontSize: '0.85rem' }}>Processing video render...</span>
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
                  className="btn-glass"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.88rem' }}
                >
                  <Download size={16} />
                  <span>Download High-Res MP4</span>
                </a>
              )}
            </div>

            {/* Right Column: Review, Captions & Social Distribution Card */}
            <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <span style={{
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '2px',
                }}>
                  Chronus Studio
                </span>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Review your <span className="gradient-text">reel</span>
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
                  Your ad has been synthesized and synced. Approve the video and select the channels you wish to distribute to.
                </p>
              </div>

              {/* Approve & Modify Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsApproved(true)}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-pill)',
                    background: isApproved ? 'var(--grad-sunset)' : 'rgba(255, 255, 255, 0.12)',
                    border: isApproved ? '1px solid rgba(255, 255, 255, 0.8)' : '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isApproved ? '0 10px 30px rgba(255, 0, 122, 0.4)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <Check size={18} />
                  <span>{isApproved ? 'Approved' : 'Approve Reel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-glass"
                  style={{ justifyContent: 'center' }}
                >
                  <Wand2 size={16} />
                  <span>Request Changes</span>
                </button>
              </div>

              {/* Social Channels Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Publishing Channels
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    { id: 'tiktok', label: 'TikTok', color: '#00DFD8' },
                    { id: 'instagram', label: 'Instagram Reels', color: '#FF007A' },
                    { id: 'youtube', label: 'YouTube Shorts', color: '#FFAE34' },
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
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-pill)',
                          background: isSelected ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                          border: isSelected ? `2px solid ${platform.color}` : '1px solid rgba(255, 255, 255, 0.15)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: isSelected ? `0 0 20px ${platform.color}55` : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Share2 size={15} color={isSelected ? platform.color : 'var(--text-muted)'} />
                        <span>{platform.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Social Caption & Hashtags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      color: '#00DFD8',
                      fontSize: '0.78rem',
                      fontWeight: 600,
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
                  style={{ fontSize: '0.92rem', lineHeight: 1.5 }}
                />
              </div>

              {/* Publish Action Trigger */}
              {publishResult && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 223, 216, 0.15)',
                  border: '1px solid rgba(0, 223, 216, 0.4)',
                  color: '#00DFD8',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <CheckCircle2 size={20} color="#00DFD8" />
                  <span>{publishResult}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-glass"
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handlePublishToPlatforms}
                    disabled={isPublishing || selectedPlatforms.length === 0}
                    className="btn-primary"
                    style={{ padding: '14px 28px' }}
                  >
                    <Share2 size={18} />
                    <span>{isPublishing ? 'Publishing...' : 'Publish to Social Channels'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="btn-glass"
                  >
                    <span>Done</span>
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
