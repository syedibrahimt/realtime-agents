#!/usr/bin/env python3
"""
Main FastAPI server for ADK-based tutoring agents
Provides WebSocket-based bidirectional communication with Gemini Live
"""

import asyncio
import json
import logging
import os
import uuid
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from session_manager_final import SessionManager
from agents.tutor_agents import get_tutoring_agents

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global session manager
session_manager = SessionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    # Startup
    logger.info("Starting ADK Tutoring Server...")
    yield
    # Shutdown
    logger.info("Shutting down ADK Tutoring Server...")
    await session_manager.cleanup_all_sessions()

# Initialize FastAPI app
app = FastAPI(
    title="ADK Tutoring Server",
    description="Real-time AI tutoring with Google's Agent Development Kit",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "ADK Tutoring Server is running"}

@app.post("/api/session")
async def create_session():
    """Create a new tutoring session"""
    try:
        session_id = str(uuid.uuid4())
        agents = get_tutoring_agents()
        
        success = await session_manager.create_session(session_id, agents)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create session")
        
        return {
            "session_id": session_id,
            "status": "created",
            "available_agents": list(agents.keys())
        }
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a tutoring session"""
    try:
        success = await session_manager.cleanup_session(session_id)
        if success:
            return {"status": "deleted", "session_id": session_id}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """Main WebSocket endpoint for bidirectional communication"""
    await websocket.accept()
    logger.info(f"WebSocket connection established for session: {session_id}")
    
    try:
        # Get or create session
        session = await session_manager.get_session(session_id)
        if not session:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Session not found. Please create a session first."
            }))
            return
        
        # Run bidirectional communication
        await run_bidirectional_communication(websocket, session_id, session)
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
        await websocket.send_text(json.dumps({
            "type": "error", 
            "message": f"Connection error: {str(e)}"
        }))
    finally:
        await session_manager.cleanup_session(session_id)

async def run_bidirectional_communication(websocket: WebSocket, session_id: str, session):
    """Handle bidirectional communication between client and agents"""
    
    async def client_to_agent_task():
        """Forward messages from client to agent"""
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                logger.info(f"Received from client [{session_id}]: {message.get('type', 'unknown')}")
                
                # Process different message types
                if message.get("type") == "audio":
                    # Handle audio input
                    audio_data = message.get("data", "")
                    await session.process_user_message("audio", audio_data)
                    
                elif message.get("type") == "text":
                    # Handle text input
                    text = message.get("content", "")
                    await session.process_user_message("text", text)
                    
                elif message.get("type") == "control":
                    # Handle control messages (start, stop, switch_agent, etc.)
                    control_type = message.get("action")
                    await session.handle_control(control_type, message.get("data"))
                    
                else:
                    logger.warning(f"Unknown message type: {message.get('type')}")
                    
        except WebSocketDisconnect:
            logger.info(f"Client disconnected from session: {session_id}")
        except Exception as e:
            logger.error(f"Error in client_to_agent_task: {e}")

    async def agent_to_client_task():
        """Stream messages from agent to client"""
        try:
            async for event in session.stream_events():
                # Process different event types from the agent
                if event.type == "response.audio_transcript.delta":
                    # Partial text response
                    await websocket.send_text(json.dumps({
                        "type": "text_delta",
                        "content": event.transcript
                    }))
                    
                elif event.type == "response.audio.delta":
                    # Audio response chunk
                    await websocket.send_text(json.dumps({
                        "type": "audio_delta",
                        "data": event.audio_data
                    }))
                    
                elif event.type == "response.done":
                    # Response complete
                    await websocket.send_text(json.dumps({
                        "type": "response_done"
                    }))
                    
                elif event.type == "agent.switched":
                    # Agent handoff occurred
                    await websocket.send_text(json.dumps({
                        "type": "agent_switched",
                        "agent": event.agent_name
                    }))
                    
                elif event.type == "tool.call":
                    # Tool/function call (for visual feedback, step completion, etc.)
                    await websocket.send_text(json.dumps({
                        "type": "tool_call",
                        "function": event.function_name,
                        "arguments": event.arguments
                    }))
                    
                elif event.type == "error":
                    # Error occurred
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": event.message
                    }))
                    
        except WebSocketDisconnect:
            logger.info(f"Agent streaming stopped for session: {session_id}")
        except Exception as e:
            logger.error(f"Error in agent_to_client_task: {e}")

    # Run both tasks concurrently
    client_task = asyncio.create_task(client_to_agent_task())
    agent_task = asyncio.create_task(agent_to_client_task())
    
    try:
        # Wait for either task to complete (or fail)
        done, pending = await asyncio.wait(
            [client_task, agent_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            
    except Exception as e:
        logger.error(f"Error in bidirectional communication: {e}")
    finally:
        # Clean up tasks
        if not client_task.done():
            client_task.cancel()
        if not agent_task.done():
            agent_task.cancel()

if __name__ == "__main__":
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )