import React, { useState, useEffect } from 'react';
import {
  Key,
  Video,
  FileText,
  Music,
  Sliders,
  Type,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Save,
  Cpu,
  Volume2,
} from 'lucide-react';

interface EngineSettings {
  // API Keys
  openaiApiKey: string;
  openaiBaseUrl: string;
  pexelsApiKey: string;
  pixabayApiKey: string;
  elevenlabsApiKey: string;

  // LLM Config
  llmProvider: string;
  llmModel: string;

  // TTS Engine
  ttsServer: string;
  voiceRate: number;
  voiceVolume: number;

  // Video Engine
  clipDuration: number;
  concatMode: string;
  clipSpeed: number;
  matchScriptOrder: boolean;

  // Subtitles
  subtitleEnabled: boolean;
  fontSize: number;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;

  // BGM
  bgmType: string;
  bgmVolume: number;
}

const SETTINGS_STORAGE_KEY = 'chronus_engine_settings';

const defaultSettings: EngineSettings = {
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  pexelsApiKey: '',
  pixabayApiKey: '',
  elevenlabsApiKey: '',
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  ttsServer: 'azure-tts-v1',
  voiceRate: 1.0,
  voiceVolume: 1.0,
  clipDuration: 5,
  concatMode: 'random',
  clipSpeed: 1.0,
  matchScriptOrder: true,
  subtitleEnabled: true,
  fontSize: 60,
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  bgmType: 'random',
  bgmVolume: 0.2,
};

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'llm' | 'tts' | 'video' | 'subtitles' | 'bgm'>('api');
  const [settings, setSettings] = useState<EngineSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse settings:', e);
    }
    return defaultSettings;
  });

  const [savedNotice, setSavedNotice] = useState(false);

  const updateSetting = <K extends keyof EngineSettings>(key: K, value: EngineSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all engine parameters to default settings?')) {
      setSettings(defaultSettings);
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
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
              color: '#FFAE34',
              letterSpacing: '0.08em',
            }}>
              Advanced Engine & Power-User Controls
            </span>
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Engine <span className="gradient-text">Settings & Parameters</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
            Customize all underlying parameters for AI copywriting, voice synthesis, video compositing, and credentials.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={handleReset} className="btn-glass" style={{ padding: '10px 16px', fontSize: '0.86rem' }}>
            <RotateCcw size={15} />
            <span>Reset Defaults</span>
          </button>
          <button onClick={handleSave} className="btn-primary" style={{ padding: '10px 22px', fontSize: '0.9rem' }}>
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Save Confirmation Toast */}
      {savedNotice && (
        <div style={{
          padding: '14px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 223, 216, 0.18)',
          border: '1px solid rgba(0, 223, 216, 0.5)',
          color: '#00DFD8',
          fontSize: '0.92rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 0 25px rgba(0, 223, 216, 0.3)',
        }}>
          <CheckCircle2 size={20} color="#00DFD8" />
          <span>Engine settings and credentials saved successfully!</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        paddingBottom: '12px',
      }}>
        {[
          { id: 'api', label: 'API Credentials', icon: Key },
          { id: 'llm', label: 'LLM & Copywriter', icon: Cpu },
          { id: 'tts', label: 'Voice & TTS Engine', icon: Volume2 },
          { id: 'video', label: 'Video Compositing', icon: Video },
          { id: 'subtitles', label: 'Subtitles & Fonts', icon: Type },
          { id: 'bgm', label: 'BGM & Audio', icon: Music },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={isActive ? 'btn-primary' : 'btn-glass'}
              style={{
                fontSize: '0.88rem',
                padding: '10px 18px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: API CREDENTIALS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'api' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>API Provider Credentials</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Credentials are kept securely in your local environment and used to access stock footage, LLM scripts, and voice cloning.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                OpenAI / DeepSeek / Moonshot API Key
              </label>
              <input
                type="password"
                className="glass-input"
                placeholder="sk-..."
                value={settings.openaiApiKey}
                onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Custom LLM API Base URL
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="https://api.openai.com/v1"
                value={settings.openaiBaseUrl}
                onChange={(e) => updateSetting('openaiBaseUrl', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pexels API Key
                </label>
                <input
                  type="password"
                  className="glass-input"
                  placeholder="Pexels authorization key..."
                  value={settings.pexelsApiKey}
                  onChange={(e) => updateSetting('pexelsApiKey', e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pixabay API Key
                </label>
                <input
                  type="password"
                  className="glass-input"
                  placeholder="Pixabay API key..."
                  value={settings.pixabayApiKey}
                  onChange={(e) => updateSetting('pixabayApiKey', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                ElevenLabs API Key (for Voice Cloning)
              </label>
              <input
                type="password"
                className="glass-input"
                placeholder="xi-api-key..."
                value={settings.elevenlabsApiKey}
                onChange={(e) => updateSetting('elevenlabsApiKey', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LLM & AI SCRIPT COPYWRITING                                        */}
      {/* ========================================================================= */}
      {activeTab === 'llm' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>LLM & AI Copywriting Model</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Configure which model writes viral hooks, video narration scripts, and keywords.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                LLM Provider
              </label>
              <select
                className="glass-select"
                value={settings.llmProvider}
                onChange={(e) => updateSetting('llmProvider', e.target.value)}
              >
                <option value="openai" style={{ background: '#1B1A28' }}>OpenAI (ChatGPT)</option>
                <option value="deepseek" style={{ background: '#1B1A28' }}>DeepSeek AI</option>
                <option value="gemini" style={{ background: '#1B1A28' }}>Google Gemini</option>
                <option value="moonshot" style={{ background: '#1B1A28' }}>Moonshot (Kimi)</option>
                <option value="ollama" style={{ background: '#1B1A28' }}>Ollama (Local)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Model Identifier
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. gpt-4o, deepseek-chat, gemini-1.5-pro"
                value={settings.llmModel}
                onChange={(e) => updateSetting('llmModel', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VOICE & TTS ENGINE                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'tts' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>TTS Engine & Speech Controls</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Adjust speech pacing, volume multiplier, and primary speech synthesis engine.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Speech Synthesis Engine
              </label>
              <select
                className="glass-select"
                value={settings.ttsServer}
                onChange={(e) => updateSetting('ttsServer', e.target.value)}
              >
                <option value="azure-tts-v1" style={{ background: '#1B1A28' }}>Azure Edge Neural TTS (Free / Default)</option>
                <option value="elevenlabs" style={{ background: '#1B1A28' }}>ElevenLabs High-Fidelity</option>
                <option value="siliconflow" style={{ background: '#1B1A28' }}>SiliconFlow CosyVoice</option>
                <option value="gemini-tts" style={{ background: '#1B1A28' }}>Google Gemini Voice</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Speech Speed Multiplier ({settings.voiceRate}x)
              </label>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={settings.voiceRate}
                onChange={(e) => updateSetting('voiceRate', parseFloat(e.target.value))}
                style={{ accentColor: '#FF007A', marginTop: '10px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VIDEO COMPOSITING & TRANSITIONS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'video' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Video Compositing Parameters</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Configure individual clip durations, splicing speed, and material sequencing modes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Max Clip Duration (seconds)
              </label>
              <input
                type="number"
                min="2"
                max="15"
                className="glass-input"
                value={settings.clipDuration}
                onChange={(e) => updateSetting('clipDuration', parseInt(e.target.value) || 5)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Material Splicing Concat Mode
              </label>
              <select
                className="glass-select"
                value={settings.concatMode}
                onChange={(e) => updateSetting('concatMode', e.target.value)}
              >
                <option value="random" style={{ background: '#1B1A28' }}>Random Dynamic Blend (Recommended)</option>
                <option value="sequential" style={{ background: '#1B1A28' }}>Sequential Chronological Order</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SUBTITLES & TYPOGRAPHY                                             */}
      {/* ========================================================================= */}
      {activeTab === 'subtitles' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Subtitles & Typography Styling</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Customize font size, stroke borders, and text foreground colors on rendered videos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Font Size (px)
              </label>
              <input
                type="number"
                min="30"
                max="120"
                className="glass-input"
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 60)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Text Color
              </label>
              <input
                type="color"
                className="glass-input"
                style={{ height: '48px', padding: '4px' }}
                value={settings.textColor}
                onChange={(e) => updateSetting('textColor', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Stroke / Border Width (px)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                className="glass-input"
                value={settings.strokeWidth}
                onChange={(e) => updateSetting('strokeWidth', parseInt(e.target.value) || 2)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: BGM & AUDIO MASTERING                                              */}
      {/* ========================================================================= */}
      {activeTab === 'bgm' && (
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Background Music & Mixing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Set background music soundtrack selection behavior and volume balance.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Soundtrack Type
              </label>
              <select
                className="glass-select"
                value={settings.bgmType}
                onChange={(e) => updateSetting('bgmType', e.target.value)}
              >
                <option value="random" style={{ background: '#1B1A28' }}>Random Curated Royalty-Free Beat</option>
                <option value="none" style={{ background: '#1B1A28' }}>None (Voiceover only)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                BGM Volume Level ({Math.round(settings.bgmVolume * 100)}%)
              </label>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={settings.bgmVolume}
                onChange={(e) => updateSetting('bgmVolume', parseFloat(e.target.value))}
                style={{ accentColor: '#00DFD8', marginTop: '10px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
