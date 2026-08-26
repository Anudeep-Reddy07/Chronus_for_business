import React, { useState, useEffect } from 'react';
import {
  Key,
  Video,
  Music,
  Type,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Save,
  Cpu,
  Volume2,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface EngineSettings {
  // API Keys
  fishAudioApiKey: string;
  fishAudioModel: string;
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
  fishAudioApiKey: '',
  fishAudioModel: 's2.1-pro-free',
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

  useEffect(() => {
    // Load config from backend to populate keys
    apiClient.getEngineConfig().then((cfg) => {
      if (cfg) {
        setSettings((prev) => ({
          ...prev,
          fishAudioApiKey: cfg.fish_audio_api_key || prev.fishAudioApiKey,
          fishAudioModel: cfg.fish_audio_model || prev.fishAudioModel,
          openaiApiKey: cfg.openai_api_key || prev.openaiApiKey,
          openaiBaseUrl: cfg.openai_base_url || prev.openaiBaseUrl,
          pexelsApiKey: cfg.pexels_api_key || prev.pexelsApiKey,
          pixabayApiKey: cfg.pixabay_api_key || prev.pixabayApiKey,
          elevenlabsApiKey: cfg.elevenlabs_api_key || prev.elevenlabsApiKey,
          llmProvider: cfg.llm_provider || prev.llmProvider,
          llmModel: cfg.llm_model || prev.llmModel,
        }));
      }
    }).catch((e) => console.debug('Could not fetch server config:', e));
  }, []);

  const updateSetting = <K extends keyof EngineSettings>(key: K, value: EngineSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      // Save credentials to backend
      await apiClient.updateEngineConfig({
        fish_audio_api_key: settings.fishAudioApiKey,
        fish_audio_model: settings.fishAudioModel,
        openai_api_key: settings.openaiApiKey,
        openai_base_url: settings.openaiBaseUrl,
        pexels_api_key: settings.pexelsApiKey,
        pixabay_api_key: settings.pixabayApiKey,
        elevenlabs_api_key: settings.elevenlabsApiKey,
        llm_provider: settings.llmProvider,
        llm_model: settings.llmModel,
      }).catch((e) => console.warn('Server config save notice:', e));

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow-label" style={{ display: 'block', marginBottom: '6px' }}>
            System & Engine Configuration
          </span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Engine Settings & Parameters
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>
            Configure LLM copywriters, speech synthesis, video compositing, and credentials.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleReset} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.84rem' }}>
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button onClick={handleSave} className="btn-vibrant" style={{ padding: '9px 20px', fontSize: '0.88rem' }}>
            <Save size={15} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Save Confirmation Toast */}
      {savedNotice && (
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
          <span>Engine settings and credentials saved successfully.</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        background: '#FFFFFF',
        padding: '4px',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        width: 'fit-content',
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
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: 'var(--radius-pill)',
                border: isActive ? '1px solid #BFDBFE' : '1px solid transparent',
                background: isActive ? '#EFF6FF' : 'transparent',
                color: isActive ? '#0066FF' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 2px 6px rgba(0, 102, 255, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: API CREDENTIALS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'api' && (
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>API Provider Credentials</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Credentials are kept securely in your local environment and used to access stock footage, LLM scripts, and voice cloning.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                OpenAI / DeepSeek / Moonshot API Key
              </label>
              <input
                type="password"
                className="app-input"
                placeholder="sk-..."
                value={settings.openaiApiKey}
                onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Custom LLM API Base URL
              </label>
              <input
                type="text"
                className="app-input"
                placeholder="https://api.openai.com/v1"
                value={settings.openaiBaseUrl}
                onChange={(e) => updateSetting('openaiBaseUrl', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pexels API Key
                </label>
                <input
                  type="password"
                  className="app-input"
                  placeholder="Pexels authorization key..."
                  value={settings.pexelsApiKey}
                  onChange={(e) => updateSetting('pexelsApiKey', e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pixabay API Key
                </label>
                <input
                  type="password"
                  className="app-input"
                  placeholder="Pixabay API key..."
                  value={settings.pixabayApiKey}
                  onChange={(e) => updateSetting('pixabayApiKey', e.target.value)}
                />
              </div>
            </div>

            {/* Fish Audio Voice Cloning & Neural TTS Section */}
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="var(--brand-primary)" />
                  <span style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                    Fish Audio (Voice Cloning & Neural TTS)
                  </span>
                </div>
                <a
                  href="https://fish.audio/app/developers"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    textDecoration: 'underline',
                  }}
                >
                  Get Free API Key ↗
                </a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Fish Audio API Key
                  </label>
                  <input
                    type="password"
                    className="app-input"
                    placeholder="Enter Fish Audio API key..."
                    value={settings.fishAudioApiKey}
                    onChange={(e) => updateSetting('fishAudioApiKey', e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Fish Audio Model
                  </label>
                  <select
                    className="glass-select"
                    value={settings.fishAudioModel}
                    onChange={(e) => updateSetting('fishAudioModel', e.target.value)}
                  >
                    <option value="s2.1-pro-free">s2.1-pro-free (Free / Default)</option>
                    <option value="s2.1-pro">s2.1-pro (High Quality)</option>
                    <option value="s2-pro">s2-pro</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ElevenLabs API Key (Optional Alternative)
              </label>
              <input
                type="password"
                className="app-input"
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
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>LLM & AI Copywriting Model</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Configure which model writes viral hooks, video narration scripts, and keywords.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                LLM Provider
              </label>
              <select
                className="glass-select"
                value={settings.llmProvider}
                onChange={(e) => updateSetting('llmProvider', e.target.value)}
              >
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="deepseek">DeepSeek AI</option>
                <option value="gemini">Google Gemini</option>
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Model Identifier
              </label>
              <input
                type="text"
                className="app-input"
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
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>TTS Engine & Speech Controls</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Adjust speech pacing, volume multiplier, and primary speech synthesis engine.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Speech Synthesis Engine
              </label>
              <select
                className="glass-select"
                value={settings.ttsServer}
                onChange={(e) => updateSetting('ttsServer', e.target.value)}
              >
                <option value="azure-tts-v1">Azure Edge Neural TTS (Free / Default)</option>
                <option value="elevenlabs">ElevenLabs High-Fidelity</option>
                <option value="siliconflow">SiliconFlow CosyVoice</option>
                <option value="gemini-tts">Google Gemini Voice</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Speech Speed Multiplier ({settings.voiceRate}x)
              </label>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={settings.voiceRate}
                onChange={(e) => updateSetting('voiceRate', parseFloat(e.target.value))}
                style={{ accentColor: 'var(--brand-primary)', marginTop: '8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VIDEO COMPOSITING & TRANSITIONS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'video' && (
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Video Compositing Parameters</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Configure individual clip durations, splicing speed, and material sequencing modes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Max Clip Duration (seconds)
              </label>
              <input
                type="number"
                min="2"
                max="15"
                className="app-input"
                value={settings.clipDuration}
                onChange={(e) => updateSetting('clipDuration', parseInt(e.target.value) || 5)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Material Splicing Concat Mode
              </label>
              <select
                className="glass-select"
                value={settings.concatMode}
                onChange={(e) => updateSetting('concatMode', e.target.value)}
              >
                <option value="random">Random Dynamic Blend (Recommended)</option>
                <option value="sequential">Sequential Chronological Order</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SUBTITLES & TYPOGRAPHY                                             */}
      {/* ========================================================================= */}
      {activeTab === 'subtitles' && (
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Subtitles & Typography Styling</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Customize font size, stroke borders, and text foreground colors on rendered videos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Font Size (px)
              </label>
              <input
                type="number"
                min="30"
                max="120"
                className="app-input"
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 60)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Text Color
              </label>
              <input
                type="color"
                className="app-input"
                style={{ height: '42px', padding: '2px', cursor: 'pointer' }}
                value={settings.textColor}
                onChange={(e) => updateSetting('textColor', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Stroke / Border Width (px)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                className="app-input"
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
        <div className="glass-panel" style={{ padding: '34px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Background Music & Mixing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Set background music soundtrack selection behavior and volume balance.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Soundtrack Type
              </label>
              <select
                className="glass-select"
                value={settings.bgmType}
                onChange={(e) => updateSetting('bgmType', e.target.value)}
              >
                <option value="random">Random Curated Royalty-Free Beat</option>
                <option value="none">None (Voiceover only)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                BGM Volume Level ({Math.round(settings.bgmVolume * 100)}%)
              </label>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={settings.bgmVolume}
                onChange={(e) => updateSetting('bgmVolume', parseFloat(e.target.value))}
                style={{ accentColor: 'var(--brand-primary)', marginTop: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
