# Migration from OpenAI Realtime API to Google Gemini Live + ADK

This document explains the completed migration from OpenAI's Realtime API to Google's Gemini Live using the Agent Development Kit (ADK).

## 🚀 Quick Start

### 1. Backend Setup (Google ADK + FastAPI)

```bash
cd backend
./setup.sh
```

Or manually:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Google API key
```

### 2. Get Google AI API Key

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create an API key
3. Add it to `backend/.env`:

```env
GOOGLE_API_KEY=your_google_ai_api_key_here
```

### 3. Start the Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend will run on `http://localhost:8000`

### 4. Start the Frontend

```bash
# In the main project directory
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

## 📋 What Changed

### Backend (New)
- **FastAPI server** with WebSocket support
- **Google ADK integration** for Gemini Live API
- **Session management** for multiple concurrent users
- **Agent system** converted from OpenAI to ADK format
- **Tool integration** for visual feedback and step tracking

### Frontend (Updated)
- **AdkWebSocketClient** replaces OpenAI RealtimeSession
- **WebSocket communication** instead of direct API calls  
- **Preserved UI/UX** - all existing components maintained
- **Push-to-talk** functionality preserved
- **Visual feedback** system maintained

### Agent System (Converted)
- **6 specialized agents** converted to ADK format:
  - `greeter` - Welcome and session initialization
  - `introGiver` - Concept introduction with visuals  
  - `questionReader` - Question presentation
  - `stepTutor` - Step-by-step tutoring guidance
  - `brainStormer` - Interactive brainstorming sessions
  - `closer` - Session conclusion and summary

## 🏗️ Architecture

```
Frontend (React)           Backend (FastAPI + ADK)
├─ AdkWebSocketClient  ←→  ├─ WebSocket Handler
├─ Push-to-Talk        ←→  ├─ Session Manager  
├─ Visual Feedback     ←→  ├─ Agent System (ADK)
└─ Notes Tracking      ←→  └─ Gemini Live API
```

## 🔧 Key Features Preserved

- ✅ **Multi-agent conversation flows**
- ✅ **Push-to-talk with spacebar**
- ✅ **Visual feedback and illustrations**
- ✅ **Step-by-step progress tracking**
- ✅ **Animated star background**
- ✅ **Session management**
- ✅ **Real-time bidirectional audio**

## 🚀 Enhanced Capabilities

- **Better Performance**: ADK's optimized streaming
- **Enhanced Features**: Access to Google Search and tools
- **Improved Reliability**: Robust error handling and reconnection
- **Scalability**: Multi-user session management
- **Future-proof**: Built on Google's latest AI infrastructure

## 🛠️ Development

### Backend Development
```bash
cd backend
source venv/bin/activate
python main.py  # Development server with auto-reload
```

### Frontend Development
```bash
npm run dev  # Vite development server
```

### Testing the Migration
1. Start both backend and frontend
2. Click "Connect" in the UI
3. Use spacebar for push-to-talk
4. Verify agent handoffs work
5. Check visual feedback displays
6. Test step completion tracking

## 🐛 Troubleshooting

### Backend Issues
- **Port 8000 in use**: Change `PORT` in `.env`
- **Missing Google API key**: Add to `.env` file
- **Import errors**: Run `pip install -r requirements.txt`

### Frontend Issues
- **Connection failed**: Ensure backend is running on port 8000
- **Audio not working**: Check browser microphone permissions
- **CORS errors**: Verify `CORS_ORIGINS` in backend `.env`

### Common Issues
- **WebSocket connection fails**: Check backend logs
- **Agent responses not showing**: Verify tool calls in backend logs
- **Push-to-talk not working**: Check browser focus and permissions

## 📁 File Structure

```
backend/
├── main.py              # FastAPI server
├── session_manager.py   # Session handling
├── agents/
│   └── tutor_agents.py  # ADK agent definitions
├── requirements.txt     # Python dependencies
└── .env                 # Configuration

src/
├── services/
│   └── AdkWebSocketClient.js  # WebSocket client
└── App.jsx              # Updated main app
```

## 🔄 Migration Summary

The migration successfully replaces OpenAI's Realtime API with Google's Gemini Live while preserving all existing functionality. The new architecture provides better performance, enhanced capabilities, and improved scalability for multi-user tutoring sessions.

All visual feedback, step tracking, agent handoffs, and push-to-talk functionality work exactly as before, but now powered by Google's advanced AI infrastructure.