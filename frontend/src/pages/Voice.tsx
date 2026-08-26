import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Play,
  Pause,
  AlertCircle,
  FileAudio,
  Headphones,
  Loader2,
  Download,
  Trash2,
  Square,
  User,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { apiClient, CustomVoice } from '../api/client';

export const Voice: React.FC = () => {
  const [cloneName, setCloneName] = useState('');
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [cloneProvider, setCloneProvider] = useState<'fish_audio' | 'elevenlabs'>('fish_audio');
  const [isCloning, setIsCloning] = useState(false);
  const [clonedSuccess, setClonedSuccess] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);

  // Live microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Audio preview playback state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Test sandbox state
  const [selectedSandboxVoice, setSelectedSandboxVoice] = useState('en-US-AriaNeural-Female');
  const [sandboxText, setSandboxText] = useState('Welcome to Chronus! Experience the future of automated video ads with high-fidelity neural narration.');
  const [sandboxAudioUrl, setSandboxAudioUrl] = useState<string | null>(null);

  const loadCustomVoices = async () => {
    try {
      const data = await apiClient.getCustomVoices();
      setCustomVoices(data || []);
    } catch (e) {
      console.debug('Could not load custom voices:', e);
    }
  };

  useEffect(() => {
    loadCustomVoices();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const curatedVoices = [
    {
      id: 'en-US-AriaNeural-Female',
      name: 'Aria',
      accent: 'American · Warm & Engaging',
      gender: 'Female',
      badge: 'Recommended',
      sampleText: "Hi there! I'm Aria. Ready to bring your brand story to life with warm, engaging neural narration.",
    },
    {
      id: 'en-US-GuyNeural-Male',
      name: 'Guy',
      accent: 'American · Confident & Energetic',
      gender: 'Male',
      badge: 'High Energy',
      sampleText: "Hey! Guy here. Let's make your product promotions stand out with dynamic, high-energy voiceovers.",
    },
    {
      id: 'en-US-JennyNeural-Female',
      name: 'Jenny',
      accent: 'American · Friendly & Clear',
      gender: 'Female',
      badge: 'Commercial',
      sampleText: "Hello! I'm Jenny. Perfect for crisp, clear commercial ads and social media product explainers.",
    },
    {
      id: 'en-GB-SoniaNeural-Female',
      name: 'Sonia',
      accent: 'British · Elegant & Sophisticated',
      gender: 'Female',
      badge: 'Luxury & Fashion',
      sampleText: "Greetings. I am Sonia. Adding an elegant, polished British touch to your premium brand campaigns.",
    },
    {
      id: 'en-US-ChristopherNeural-Male',
      name: 'Christopher',
      accent: 'American · Deep & Authoritative',
      gender: 'Male',
      badge: 'Storytelling',
      sampleText: "Welcome. Christopher here. Deep, resonant narration that commands attention and builds trust.",
    },
  ];

  const startLiveRecording = async () => {
    try {
      setCloneError(null);
      setRecordedAudioUrl(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('wav') ? 'wav' : 'webm';
        const recordedFile = new File([audioBlob], `calibration_recording.${ext}`, { type: mimeType });
        setVoiceFiles([recordedFile]);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setCloneError('Microphone permission denied or not available. Please allow mic access or upload an audio file.');
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePlayPreview = async (voiceId: string, customText?: string) => {
    setPreviewError(null);

    // If already playing this voice, toggle pause
    if (playingVoiceId === voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    // Stop any previously playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const voiceObj = curatedVoices.find((v) => v.id === voiceId);
    const customVoiceObj = customVoices.find((v) => v.voice_id === voiceId);
    const textToSpeak = customText || voiceObj?.sampleText || (customVoiceObj ? `Hello! This is my cloned voice "${customVoiceObj.name}", synthesized live with Fish Audio.` : "Welcome to Chronus! Transforming your product videos into viral ad campaigns.");

    try {
      setLoadingVoiceId(voiceId);
      const url = `/api/v1/studio/voice/preview?voice_name=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(textToSpeak)}`;
      
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onloadeddata = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(voiceId);
      };

      audio.onended = () => {
        setPlayingVoiceId(null);
      };

      audio.onerror = (e) => {
        console.error('Voice preview audio error:', e);
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
        setPreviewError(`Failed to stream preview for ${voiceId}. Check your Fish Audio API key in Settings if using a cloned model.`);
      };

      await audio.play();
      setPlayingVoiceId(voiceId);
      setLoadingVoiceId(null);
    } catch (err: any) {
      console.error('Audio play failure:', err);
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
      setPreviewError(err.message || 'Could not play voice audio stream.');
    }
  };

  const handleSynthesizeSandbox = () => {
    if (!sandboxText.trim()) return;
    const url = `/api/v1/studio/voice/preview?voice_name=${encodeURIComponent(selectedSandboxVoice)}&text=${encodeURIComponent(sandboxText.trim())}`;
    setSandboxAudioUrl(url);
    handlePlayPreview(selectedSandboxVoice, sandboxText.trim());
  };

  const handleVoiceFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setVoiceFiles(Array.from(e.target.files));
      setRecordedAudioUrl(null);
    }
  };

  const handleCreateClonedVoice = async () => {
    if (!cloneName.trim() || voiceFiles.length === 0) return;
    try {
      setIsCloning(true);
      setCloneError(null);
      setClonedSuccess(null);

      const result = await apiClient.createClonedVoice(cloneName.trim(), voiceFiles, cloneProvider);
      setClonedSuccess(`Voice "${cloneName}" successfully cloned and saved! (ID: ${result.voice_name})`);
      setCloneName('');
      setVoiceFiles([]);
      setRecordedAudioUrl(null);
      loadCustomVoices();
    } catch (err: any) {
      setCloneError(err.message || 'Voice cloning failed. Please check your Fish Audio API Key in Settings.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleDeleteCustomVoice = async (id: string, name: string) => {
    if (!window.confirm(`Delete cloned voice "${name}"?`)) return;
    try {
      await apiClient.deleteCustomVoice(id);
      setCustomVoices((prev) => prev.filter((v) => v.id !== id && v.voice_id !== id));
      if (playingVoiceId === id) {
        if (audioRef.current) audioRef.current.pause();
        setPlayingVoiceId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete voice');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '34px', maxWidth: '1120px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow-label" style={{ display: 'block', marginBottom: '6px' }}>
            Neural Speech & Audio Engine
          </span>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Voiceover & Audio Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', maxWidth: '640px' }}>
            High-fidelity neural voices, custom script synthesis, and instant voice cloning for video narration.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-ready" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
            <Radio size={13} />
            <span>Neural Engine Active</span>
          </span>
        </div>
      </div>

      {previewError && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          color: '#991B1B',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <AlertCircle size={18} />
          <span>{previewError}</span>
        </div>
      )}

      {/* Featured Neural Voice Library */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Featured Neural Speakers</h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Click preview to test synthesized speech in real-time.
            </p>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {curatedVoices.length} Presets Available
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '20px',
        }}>
          {curatedVoices.map((v) => {
            const isPlaying = playingVoiceId === v.id;
            const isLoading = loadingVoiceId === v.id;

            return (
              <div
                key={v.id}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  border: isPlaying ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: isPlaying ? 'var(--shadow-glow-brand)' : 'var(--shadow-card)',
                  transform: isPlaying ? 'translateY(-2px)' : undefined,
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Speaker Header with Unified Brand Avatar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar-brand">
                      <Headphones size={20} color="#FFFFFF" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        {v.name}
                      </h3>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {v.gender} · {v.accent}
                      </span>
                    </div>
                  </div>

                  <span className="badge badge-brand">
                    {v.badge}
                  </span>
                </div>

                {/* Sample Quotation Box with Inset Surface */}
                <p style={{
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  minHeight: '52px',
                  fontStyle: 'italic',
                }}>
                  "{v.sampleText}"
                </p>

                {/* Interactive Player Strip */}
                <div style={{
                  background: isPlaying ? 'var(--brand-light)' : 'var(--bg-surface-subtle)',
                  border: isPlaying ? '1px solid var(--brand-border)' : '1px solid var(--border-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Equalizer Waveform */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`equalizer-bar ${isPlaying ? 'playing' : 'idle'}`}>
                      <span /><span /><span /><span /><span />
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      color: isPlaying ? 'var(--brand-primary)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}>
                      {isPlaying ? 'Streaming Audio' : v.id.split('-')[1]}
                    </span>
                  </div>

                  {/* Play/Pause Button */}
                  <button
                    type="button"
                    onClick={() => handlePlayPreview(v.id)}
                    disabled={isLoading}
                    className={`btn-play-preview ${isPlaying ? 'is-playing' : ''}`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={13} className="spin-icon" />
                        <span>Loading</span>
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause size={13} fill="#FFFFFF" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} fill="currentColor" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Speech Sandbox */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div className="avatar-brand" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
            <Volume2 size={20} color="#FFFFFF" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Custom Script Narration Sandbox</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
              Type any script and test how it sounds synthesized live with different neural speakers.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Test Script / Narration Prompt
            </label>
            <textarea
              className="glass-textarea"
              rows={4}
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Enter text to synthesize live..."
              style={{ resize: 'vertical', lineHeight: 1.55 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Select Neural Speaker
              </label>
              <select
                className="glass-select"
                value={selectedSandboxVoice}
                onChange={(e) => setSelectedSandboxVoice(e.target.value)}
                style={{ padding: '12px 14px' }}
              >
                {curatedVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.accent} - {v.gender})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSynthesizeSandbox}
                className="btn-vibrant"
                style={{ flex: 1, padding: '12px 18px', justifyContent: 'center' }}
              >
                <Sparkles size={16} />
                <span>Synthesize Live</span>
              </button>

              {sandboxAudioUrl && (
                <a
                  href={sandboxAudioUrl}
                  download="chronus_narration.mp3"
                  className="btn-secondary"
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Download MP3"
                >
                  <Download size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My Cloned Voices Section (if any exists) */}
      {customVoices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>My Cloned Voices</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Custom voice models cloned with Fish Audio & ElevenLabs.
              </p>
            </div>
            <span className="badge badge-ready">
              {customVoices.length} Active Model{customVoices.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: '20px',
          }}>
            {customVoices.map((v) => {
              const isPlaying = playingVoiceId === v.voice_id;
              const isLoading = loadingVoiceId === v.voice_id;

              return (
                <div
                  key={v.id}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    border: isPlaying ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    boxShadow: isPlaying ? 'var(--shadow-glow-brand)' : 'var(--shadow-card)',
                    transition: 'all 0.22s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar-brand">
                        <User size={20} color="#FFFFFF" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</h3>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Provider: {v.provider === 'fish_audio' ? 'Fish Audio' : 'ElevenLabs'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomVoice(v.id, v.name)}
                      className="btn-secondary"
                      style={{
                        padding: '6px',
                        color: '#DC2626',
                        borderColor: '#FECACA',
                      }}
                      title="Delete cloned voice"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{
                    background: isPlaying ? 'var(--brand-light)' : 'var(--bg-surface-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={`equalizer-bar ${isPlaying ? 'playing' : 'idle'}`}>
                        <span /><span /><span /><span /><span />
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {v.voice_id.length > 20 ? `${v.voice_id.slice(0, 20)}...` : v.voice_id}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlayPreview(v.voice_id)}
                      disabled={isLoading}
                      className={`btn-play-preview ${isPlaying ? 'is-playing' : ''}`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={13} className="spin-icon" />
                          <span>Loading</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause size={13} fill="#FFFFFF" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voice Cloning Studio Section */}
      <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="avatar-brand" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
              <Mic size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Custom Voice Cloning Studio</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                Record your voice live via microphone or upload an audio sample to clone a speaker model.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Provider:</span>
            <select
              className="glass-select"
              value={cloneProvider}
              onChange={(e: any) => setCloneProvider(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              <option value="fish_audio">Fish Audio (Fast / Recommended)</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>
        </div>

        {clonedSuccess && (
          <div style={{
            background: '#F4F4F5',
            border: '1px solid #E4E4E7',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            color: '#18181B',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-card)',
          }}>
            <CheckCircle2 size={18} color="#18181B" />
            <span>{clonedSuccess}</span>
          </div>
        )}

        {cloneError && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            color: '#991B1B',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-card)',
          }}>
            <AlertCircle size={18} color="#DC2626" />
            <span>{cloneError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Left Column: Script & Live Microphone Recording */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cloned Voice Name
              </label>
              <input
                type="text"
                className="app-input"
                placeholder="e.g. My Voice, Founder Voice, Alex Narrator"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Step 1: Read Calibration Script with Microphone
              </label>
              <div style={{
                background: isRecording ? '#FEF2F2' : 'var(--bg-surface-subtle)',
                border: isRecording ? '1.5px solid #EF4444' : '1px solid var(--border-subtle)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                color: isRecording ? '#991B1B' : 'var(--text-secondary)',
                lineHeight: 1.6,
                transition: 'all 0.25s ease',
              }}>
                "Chronus transforms simple product ideas into engaging, high-conversion short video ads in seconds. Try it today and scale your brand."
              </div>

              {/* Record / Stop Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startLiveRecording}
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Mic size={16} />
                    <span>Start Voice Recording</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopLiveRecording}
                    className="btn-primary"
                    style={{
                      background: '#DC2626',
                      borderColor: '#DC2626',
                      padding: '10px 20px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Square size={16} fill="#FFFFFF" />
                    <span>Stop Recording ({Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')})</span>
                  </button>
                )}

                {isRecording && (
                  <div className="equalizer-bar playing" style={{ height: '22px' }}>
                    <span style={{ background: '#DC2626' }} />
                    <span style={{ background: '#DC2626' }} />
                    <span style={{ background: '#DC2626' }} />
                    <span style={{ background: '#DC2626' }} />
                    <span style={{ background: '#DC2626' }} />
                  </div>
                )}
              </div>

              {recordedAudioUrl && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#F4F4F5',
                  border: '1px solid #E4E4E7',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  marginTop: '6px',
                }}>
                  <CheckCircle2 size={18} color="#18181B" />
                  <span style={{ fontSize: '0.84rem', color: '#18181B', fontWeight: 600 }}>
                    Recording ready:
                  </span>
                  <audio src={recordedAudioUrl} controls style={{ height: '32px', flex: 1 }} />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: File Upload Alternative & Submit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Or Upload Audio File
              </label>
              <div
                style={{
                  border: '1.5px dashed var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'var(--bg-surface-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => document.getElementById('voice-file-input')?.click()}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.background = 'var(--brand-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.background = 'var(--bg-surface-subtle)';
                }}
              >
                <div className="avatar-brand" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                  <FileAudio size={20} color="#FFFFFF" />
                </div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>Click to select audio file</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {voiceFiles.length > 0
                    ? `${voiceFiles.length} file ready: ${voiceFiles[0].name}`
                    : 'MP3, WAV, M4A, WEBM'}
                </span>
                <input
                  id="voice-file-input"
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm"
                  style={{ display: 'none' }}
                  onChange={handleVoiceFileDrop}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateClonedVoice}
              disabled={isCloning || !cloneName.trim() || voiceFiles.length === 0}
              className="btn-vibrant"
              style={{
                padding: '13px 20px',
                justifyContent: 'center',
                opacity: !cloneName.trim() || voiceFiles.length === 0 ? 0.45 : 1,
              }}
            >
              <Sparkles size={16} />
              <span>{isCloning ? 'Synthesizing Model...' : 'Create Cloned Voice Model'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
