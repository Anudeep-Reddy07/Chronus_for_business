<<<<<<< HEAD

=======
# Chronus for Business — AI Video Studio 🎬⚡

**Chronus** is an automated, AI-powered short video advertisement creation platform. Built for businesses, agencies, and creators to transform product media, marketing prompts, and scripts into high-converting video campaigns with neural voiceovers.

---

## ✨ Features

- **🎨 Next-Gen Creative Studio UI:** Clean, daylight-first interface inspired by Craft and Attio with architectural micro-dot grid aesthetics.
- **🎙️ Neural Speech & Voiceover Engine:**
  - 5 high-fidelity neural voices (Aria, Guy, Jenny, Sonia, Christopher).
  - Custom voice cloning via Fish Audio and ElevenLabs.
  - Live microphone recording & interactive synthesis sandbox.
- **📹 Multi-Format Video Generation:**
  - Vertical 9:16 (TikTok, Instagram Reels, YouTube Shorts).
  - Landscape 16:9 (YouTube Ads, Websites).
  - Square 1:1 (Instagram Feeds, Carousel Ads).
- **🤖 Automated AI Copywriting & Subtitling:**
  - AI-generated commercial scripts and hooks.
  - Dynamic burned-in subtitles with custom font styling.
- **🚀 Fast Local Rendering:**
  - MoviePy & FFmpeg-powered video composition engine.
  - Seamless background music ducking and video transitions.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- FFmpeg (automatically detected via `imageio-ffmpeg` or system PATH)

### 2. Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Anudeep-Reddy07/Chronus_for_business.git
   cd Chronus_for_business
   ```

2. **Set up Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Configure Environment:**
   Copy `config.example.toml` to `config.toml` and configure your API keys (OpenAI / Gemini / Fish Audio):
   ```bash
   cp config.example.toml config.toml
   ```

---

## 🏃 Running Chronus

### One-Click Startup (Recommended):
Launch both the FastAPI backend (`port 8080`) and Vite frontend (`port 3000`) with a single command:

```bash
./start.sh
```

- **Studio UI:** `http://localhost:3000`
- **FastAPI Backend & Swagger Docs:** `http://127.0.0.1:8080/docs`

---

## 📂 Project Structure

```
Chronus_for_business/
├── app/                  # FastAPI Backend & Core Video Engine
│   ├── config/           # App Configuration (config.toml loader)
│   ├── controllers/      # REST API Controllers (/api/v1/video, /studio, /tasks)
│   ├── models/           # Pydantic Schemas & Data Models
│   ├── services/         # Video Rendering, TTS, LLM Scripting, BGM Ducking
│   ├── studio/           # SQLite Local Project Database & Storage
│   └── utils/            # FFmpeg Helpers & File Utilities
├── frontend/             # React 19 + TypeScript + Vite Studio Application
│   ├── src/
│   │   ├── components/   # Sidebar, MediaUploader, VideoModal, Layout
│   │   ├── pages/        # Dashboard, NewProject, Voice, Settings
│   │   └── api/          # Typed API Client
├── resource/             # Fonts, BGM Audio Tracks, and Static Public Assets
├── storage/              # Generated Video Tasks, Media Cache, and Local Storage
├── main.py               # FastAPI Entrypoint
└── start.sh              # Unified All-in-One Startup Script
```

---

## ⚙️ Configuration (`config.toml`)

Edit `config.toml` to set up your preferred AI providers:

```toml
[app]
listen_host = "127.0.0.1"
listen_port = 8080
api_key = ""                  # Optional API authentication key

[llm]
provider = "openai"           # "openai", "gemini", "anthropic", "deepseek", etc.
api_key = "YOUR_API_KEY"
model_name = "gpt-4o-mini"

[fish_audio]
api_key = "YOUR_FISH_KEY"     # Optional for instant voice cloning

[elevenlabs]
api_key = "YOUR_ELEVEN_KEY"   # Optional ElevenLabs integration
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
>>>>>>> c84bb7e (feat(v2.0.0): Chronus Studio v2.0 - Craft/Attio Design System, Pinned Navigation, Dead Code Cleanup)
