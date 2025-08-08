#!/usr/bin/env python3

import asyncio
import json
import os
from typing import Dict, Optional
import logging
import base64

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.agents.tutoring_agents import TutoringAgents
from app.models.session import SessionManager
from app.models.messages import (
    WebSocketMessage,
    MessageType,
    ConnectionStatus,
    AudioData,
    TextMessage
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="ADK Tutoring Backend", version="1.0.0")

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize session manager and agents
session_manager = SessionManager()
tutoring_agents = TutoringAgents()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ADK Tutoring Backend"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication"""
    await websocket.accept()
    session_id = None
    
    try:
        logger.info("WebSocket connection established")
        
        # Send connection confirmation
        await websocket.send_json({
            "type": MessageType.CONNECTION_STATUS,
            "status": ConnectionStatus.CONNECTED,
            "message": "Connected to ADK Tutoring Backend"
        })
        
        async for message in websocket.iter_json():
            try:
                # Parse incoming message
                ws_message = WebSocketMessage(**message)
                
                if ws_message.type == MessageType.INIT_SESSION:
                    # Initialize new session
                    session_id = await session_manager.create_session(websocket)
                    agent = tutoring_agents.get_greeter_agent()
                    
                    # Start the session with the greeter agent
                    await session_manager.start_session(session_id, agent)
                    
                    await websocket.send_json({
                        "type": MessageType.SESSION_CREATED,
                        "session_id": session_id,
                        "message": "Session initialized successfully"
                    })
                    
                elif ws_message.type == MessageType.AUDIO_DATA:
                    # Handle audio input
                    if session_id:
                        audio_data = AudioData(**ws_message.data)
                        await session_manager.process_audio_input(session_id, audio_data.audio_base64)
                    
                elif ws_message.type == MessageType.TEXT_MESSAGE:
                    # Handle text input
                    if session_id:
                        text_data = TextMessage(**ws_message.data)
                        await session_manager.process_text_input(session_id, text_data.text)
                        
                elif ws_message.type == MessageType.END_SESSION:
                    # End the session
                    if session_id:
                        await session_manager.end_session(session_id)
                        session_id = None
                        
                        await websocket.send_json({
                            "type": MessageType.SESSION_ENDED,
                            "message": "Session ended successfully"
                        })
                        
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send_json({
                    "type": MessageType.ERROR,
                    "message": f"Error processing message: {str(e)}"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
        if session_id:
            await session_manager.end_session(session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if session_id:
            await session_manager.end_session(session_id)

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting ADK Tutoring Backend on {host}:{port}")
    uvicorn.run(app, host=host, port=port)