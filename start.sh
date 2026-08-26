#!/bin/bash
# Chronus Video Studio — All-in-One Startup Script

# Navigate to project root
cd "$(dirname "$0")"

echo "🚀 Starting Chronus AI Video Studio..."

# 1. Start FastAPI Backend in background
echo "📦 Starting FastAPI Backend on http://127.0.0.1:8080..."
.venv/bin/python main.py &
BACKEND_PID=$!

# Trap exit signals to gracefully terminate backend when script is closed
trap "kill $BACKEND_PID 2>/dev/null; exit" SIGINT SIGTERM EXIT

# 2. Start Vite Frontend
echo "🎨 Starting Frontend Studio on http://localhost:3000..."
cd frontend
npm run dev

# Wait for processes
wait $BACKEND_PID
