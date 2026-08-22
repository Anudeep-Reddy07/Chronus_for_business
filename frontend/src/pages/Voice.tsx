import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Play,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Radio,
  Headphones,
  Sliders,
  Music,
} from 'lucide-react';

export const Voice: React.FC = () => {
  const [cloneName, setCloneName] = useState('');
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [clonedSuccess, setClonedSuccess] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // Test sandbox
  const [sandboxText, setSandboxText] = useState('Welcome to Chronus! Experience the future of automated video ads.');
  const [isPlayingPreview, setIsPlayingPreview] = useState<string | null>(null);

  const curatedVoices = [
    {
      id: 'en-US-AriaNeural-Female',
      name: 'Aria',
      accent: 'American · Warm & Engaging',
      gender: 'Female',
      badge: 'Popular',
      sampleUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/sample/en-US-AriaNeural.mp3',
    },
    {
      id: 'en-US-GuyNeural-Male',
      name: 'Guy',
      accent: 'American · Confident & Energetic',
      gender: 'Male',
      badge: 'High Energy',
      sampleUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/sample/en-US-GuyNeural.mp3',
    },
    {
      id: 'en-US-JennyNeural-Female',
      name: 'Jenny',
      accent: 'American · Friendly & Clear',
      gender: 'Female',
      badge: 'Commercial',
      sampleUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/sample/en-US-JennyNeural.mp3',
    },
    {
      id: 'en-GB-SoniaNeural-Female',
      name: 'Sonia',
      accent: 'British · Elegant & Sophisticated',
      gender: 'Female',
      badge: 'Luxury',
      sampleUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/sample/en-GB-SoniaNeural.mp3',
    },
    {
      id: 'en-US-DavisNeural-Male',
      name: 'Davis',
      accent: 'American · Deep & Authoritative',
      gender: 'Male',
      badge: 'Storytelling',
      sampleUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/sample/en-US-DavisNeural.mp3',
    },
  ];

  const handleVoiceFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setVoiceFiles(Array.from(e.target.files));
    }
  };

  const handleCreateClonedVoice = async () => {
    if (!cloneName.trim() || voiceFiles.length === 0) return;
    try {
      setIsCloning(true);
      setCloneError(null);
      setClonedSuccess(null);

      const formData = new FormData();
      voiceFiles.forEach((f) => formData.append('files', f));

      const res = await fetch(`/api/v1/studio/voices?name=${encodeURIComponent(cloneName.trim())}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'ElevenLabs cloning service error. Please verify API key.');
      }

      const data = await res.json();
      setClonedSuccess(`Voice "${cloneName}" successfully cloned! (ID: ${data.data?.voice_name || 'cloned:ready'})`);
      setCloneName('');
      setVoiceFiles([]);
    } catch (err: any) {
      setCloneError(err.message || 'Voice cloning failed. Make sure ElevenLabs key is configured in settings.');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#FF007A',
            letterSpacing: '0.08em',
          }}>
            Audio & Neural Speech Engine
          </span>
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Voiceover & <span className="gradient-text">Audio Studio</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
          Explore high-fidelity neural voices, synthesize custom brand narration, and clone custom speaker voices.
        </p>
      </div>

      {/* Curated Voice Library */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Featured Neural Voices</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Azure Edge & ElevenLabs Powered
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '18px',
        }}>
          {curatedVoices.map((v) => (
            <div
              key={v.id}
              className="glass-panel glass-panel-hover"
              style={{
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: v.gender === 'Female' ? 'var(--grad-sunset)' : 'var(--grad-cyan-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
                  }}>
                    <Headphones size={20} color="#FFFFFF" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{v.name}</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{v.gender} · {v.accent}</span>
                  </div>
                </div>

                <span className="badge badge-ready" style={{ fontSize: '0.7rem' }}>
                  {v.badge}
                </span>
              </div>

              {/* Sample audio player bar */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: {v.id.split('-')[1]}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlayingPreview(isPlayingPreview === v.id ? null : v.id);
                  }}
                  className="btn-glass"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: 'var(--radius-pill)' }}
                >
                  <Play size={13} fill="#FFFFFF" />
                  <span>Preview</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voice Cloning Studio Section */}
      <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--grad-sunset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(255, 0, 122, 0.4)',
          }}>
            <Mic size={22} color="#FFFFFF" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Custom Voice Cloning Engine</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Upload 1-3 clear audio recordings (MP3, WAV) of a speaker to train a custom cloned voice model.
            </p>
          </div>
        </div>

        {clonedSuccess && (
          <div style={{
            background: 'rgba(0, 223, 216, 0.15)',
            border: '1px solid rgba(0, 223, 216, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            color: '#00DFD8',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <CheckCircle2 size={18} />
            <span>{clonedSuccess}</span>
          </div>
        )}

        {cloneError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            color: '#FCA5A5',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <AlertCircle size={18} />
            <span>{cloneError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Cloned Voice Name
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Founder Voice, Alex Brand Narrator"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Calibration Script to Read (Optional guidance)
              </label>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}>
                "Chronus transforms simple product ideas into engaging, high-conversion short video ads in seconds. Try it today and scale your brand."
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Audio Samples (MP3, WAV, M4A)
            </label>
            <div style={{
              border: '2px dashed rgba(255, 255, 255, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '28px 20px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }} onClick={() => document.getElementById('voice-file-input')?.click()}>
              <FileAudio size={28} color="#FF007A" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Click to select audio recordings</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {voiceFiles.length > 0
                  ? `${voiceFiles.length} file(s) selected: ${voiceFiles.map(f => f.name).join(', ')}`
                  : '1 to 3 audio files (recommended duration 30s-2m)'}
              </span>
              <input
                id="voice-file-input"
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a"
                style={{ display: 'none' }}
                onChange={handleVoiceFileDrop}
              />
            </div>

            <button
              type="button"
              onClick={handleCreateClonedVoice}
              disabled={isCloning || !cloneName.trim() || voiceFiles.length === 0}
              className="btn-primary"
              style={{
                marginTop: '6px',
                justifyContent: 'center',
                opacity: !cloneName.trim() || voiceFiles.length === 0 ? 0.45 : 1,
              }}
            >
              <Sparkles size={18} />
              <span>{isCloning ? 'Synthesizing Cloned Model...' : 'Create Cloned Voice Model'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
