# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend
- **Development server**: `npm run dev` - Starts Vite development server
- **Production build**: `npm run build` - Creates optimized build in `dist/`
- **Linting**: `npm run lint` - Runs ESLint with React and React Hooks rules
- **Preview build**: `npm run preview` - Serves production build locally

### Backend (Google ADK)
- **Start backend**: `./start_backend.sh` - Starts Python FastAPI backend with ADK
- **Manual start**: `cd backend && python simple_main.py` - Direct backend startup

## Architecture Overview

This is a React-based AI tutoring application **MIGRATED from OpenAI to Google ADK** with a multi-agent architecture. The app provides interactive math/science tutoring through voice conversations with visual feedback.

### Core Structure

- **Frontend**: React 19 + Vite, using custom `AdkWebSocketClient` for real-time communication
- **Backend**: Python FastAPI server with Google ADK integration
- **Agent System**: Multi-agent architecture migrated to Google ADK with specialized roles:
  - `greeterAgent`: Welcome and session initialization 
  - `introGiverAgent`: Concept introduction with visual elements
  - `questionReaderAgent`: Question presentation and handling
  - `stepTutorAgent`: Step-by-step tutoring guidance  
  - `brainStormerAgent`: Interactive brainstorming sessions
  - `closerAgent`: Session conclusion and summary

### Key Components

- **App.jsx**: Main application with session management, push-to-talk controls, and visual feedback system
- **StarBackground**: Animated star field that responds to connection state
- **VisualFeedback**: Displays illustrations, hints, and success messages from agents
- **NotesArea**: Shows step-by-step progress tracking

### Data Flow

- Problem data loaded from JSON files (hard1.json - hard4.json) containing:
  - Topic information and learning objectives
  - Question data with multiple choice options
  - Step-by-step tutoring content with visual elements
  - Conceptual questions with illustrations and feedback

- Agents communicate through global window functions:
  - `window.handleStepCompletion()`: Updates progress tracking
  - `window.handleVisualFeedback()`: Shows illustrations/hints/success messages
  - `window.handleIntroVisual()`: Displays concept introductions

### Push-to-Talk Implementation

- Always-on push-to-talk mode using spacebar
- Microphone muted by default, activated only while key held
- Visual indicators for talk state and connection status

### Environment Setup

#### Frontend
- Configuration in `env.js` with `ADK_BACKEND_URL` pointing to backend WebSocket
- No API keys needed in frontend (handled by backend)

#### Backend  
- Requires `GOOGLE_API_KEY` in `backend/.env`
- Uses Google Gemini 2.0 Flash model via ADK
- FastAPI server handles WebSocket connections and agent interactions

### Agent Flow Logic

Agents are conditionally chained based on `isConceptIntroductionEnabled` flag in problem data:
- If enabled: greeter → introGiver → questionReader → stepTutor → closer
- If disabled: greeter → questionReader → stepTutor → closer

The brainStormer agent can be used as an alternative initial agent for more exploratory learning sessions.
- to memorize