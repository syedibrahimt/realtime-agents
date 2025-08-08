# Migration to Google ADK

This document outlines the migration from OpenAI Realtime Agents SDK to Google Agent Development Kit (ADK).

## Overview

The application has been migrated from:
- **Frontend**: OpenAI Realtime Agents SDK → Custom WebSocket client
- **Backend**: Direct OpenAI API calls → Google ADK with FastAPI backend
- **Models**: OpenAI GPT-4o → Google Gemini 2.0 Flash

## Architecture Changes

### Before (OpenAI)
```
Frontend (React) → OpenAI Realtime SDK → OpenAI API
```

### After (Google ADK)
```
Frontend (React) → WebSocket Client → Python ADK Backend → Google Gemini API
```

## Setup Instructions

### 1. Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create Python virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Edit `backend/.env` and add your Google AI API key:
   ```
   GOOGLE_API_KEY=your_google_ai_api_key_here
   ```

5. **Start the backend server:**
   ```bash
   python main.py
   ```
   The backend will start on `http://localhost:8000`

### 2. Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The frontend will start on `http://localhost:5173`

## Key Changes

### Frontend Changes
- **Removed**: `@openai/agents-realtime` dependency
- **Added**: `AdkWebSocketClient` for WebSocket communication
- **Updated**: Connection logic to use ADK backend
- **Maintained**: All existing UI components and functionality

### Backend Changes
- **Added**: Python FastAPI server with WebSocket support
- **Added**: Google ADK agent implementations
- **Added**: Session management system
- **Added**: Audio processing pipeline

### Agent Migration
All 6 original OpenAI agents have been converted to Google ADK format:
1. **greeterAgent** → Welcomes students
2. **introGiverAgent** → Shows concept introductions
3. **questionReaderAgent** → Reads questions aloud
4. **stepTutorAgent** → Guides through problem steps
5. **brainStormerAgent** → Interactive brainstorming
6. **closerAgent** → Concludes sessions

## Features Preserved
✅ Push-to-talk functionality  
✅ Visual feedback system  
✅ Step completion tracking  
✅ Agent handoffs  
✅ Audio streaming  
✅ Session management  
✅ Star background animation  

## Development Commands

### Backend
```bash
# Start development server
python main.py

# Install new packages
pip install package_name
pip freeze > requirements.txt
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check that Python virtual environment is activated
   - Verify Google API key is set in `.env`
   - Ensure port 8000 is not already in use

2. **WebSocket connection fails**
   - Verify backend is running on port 8000
   - Check browser developer tools for WebSocket errors
   - Ensure CORS settings allow localhost connections

3. **Audio not working**
   - Allow microphone permissions in browser
   - Check that `audio-processor.js` is accessible at `/audio-processor.js`
   - Verify Web Audio API support in browser

4. **Agent responses not working**
   - Check backend logs for Google API errors
   - Verify problem data (`hard4.json`) is loading correctly
   - Check agent handoff configuration

## API Endpoints

### WebSocket
- `ws://localhost:8000/ws` - Main WebSocket endpoint

### HTTP
- `GET http://localhost:8000/` - Health check

## Next Steps

1. Test all agent interactions
2. Verify audio quality
3. Test visual feedback system
4. Validate step completion tracking
5. Deploy to production environment

## Support

For issues specific to:
- **Google ADK**: Check [Google ADK Documentation](https://google.github.io/adk-docs/)
- **FastAPI**: Check [FastAPI Documentation](https://fastapi.tiangolo.com/)
- **WebSockets**: Check browser developer tools and backend logs