import asyncio
import uuid
from typing import Dict, Optional
import json
import base64
import logging
from datetime import datetime

from fastapi import WebSocket

from .messages import MessageType, AgentResponse, VisualFeedback, StepCompletion

logger = logging.getLogger(__name__)

class TutoringSession:
    """Individual tutoring session"""
    
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.websocket = websocket
        self.current_agent: Optional[Agent] = None
        self.adk_session: Optional[Session] = None
        self.is_active = False
        self.completed_steps = []
        self.current_visual_feedback = None
        
    async def start(self, initial_agent: Agent):
        """Start the session with an initial agent"""
        try:
            self.current_agent = initial_agent
            self.adk_session = Session(agent=initial_agent)
            self.is_active = True
            
            logger.info(f"Session {self.session_id} started with agent: {initial_agent.name}")
            
            # Start the ADK session
            await self.adk_session.start()
            
            # Set up response handlers
            self._setup_response_handlers()
            
        except Exception as e:
            logger.error(f"Error starting session {self.session_id}: {e}")
            await self.send_error(f"Failed to start session: {str(e)}")
    
    def _setup_response_handlers(self):
        """Set up handlers for ADK session responses"""
        if not self.adk_session:
            return
            
        @self.adk_session.on_response
        async def handle_response(response):
            """Handle agent responses"""
            try:
                # Convert ADK response to our format
                agent_response = AgentResponse(
                    agent_name=self.current_agent.name if self.current_agent else "unknown",
                    response_type="text" if response.text else "audio",
                    content=response.text or "",
                    audio_base64=base64.b64encode(response.audio).decode() if response.audio else None,
                    metadata=response.metadata if hasattr(response, 'metadata') else None
                )
                
                await self.send_agent_response(agent_response)
                
                # Check for visual feedback in response
                if hasattr(response, 'metadata') and response.metadata:
                    await self._handle_response_metadata(response.metadata)
                    
            except Exception as e:
                logger.error(f"Error handling response: {e}")
                await self.send_error(f"Error processing agent response: {str(e)}")
        
        @self.adk_session.on_handoff
        async def handle_handoff(next_agent):
            """Handle agent handoffs"""
            try:
                logger.info(f"Handoff from {self.current_agent.name} to {next_agent.name}")
                self.current_agent = next_agent
                
                await self.websocket.send_json({
                    "type": MessageType.AGENT_HANDOFF,
                    "data": {
                        "from_agent": self.current_agent.name,
                        "to_agent": next_agent.name
                    }
                })
                
            except Exception as e:
                logger.error(f"Error handling handoff: {e}")
                await self.send_error(f"Error in agent handoff: {str(e)}")
    
    async def _handle_response_metadata(self, metadata: dict):
        """Handle metadata from agent responses"""
        try:
            # Check for visual feedback
            if "visual_feedback" in metadata:
                vf_data = metadata["visual_feedback"]
                visual_feedback = VisualFeedback(**vf_data)
                await self.send_visual_feedback(visual_feedback)
            
            # Check for step completion
            if "step_completion" in metadata:
                sc_data = metadata["step_completion"]
                step_completion = StepCompletion(**sc_data)
                await self.send_step_completion(step_completion)
                
        except Exception as e:
            logger.error(f"Error handling response metadata: {e}")
    
    async def process_audio_input(self, audio_base64: str):
        """Process audio input from the client"""
        if not self.is_active or not self.adk_session:
            await self.send_error("Session not active")
            return
            
        try:
            # Decode audio data
            audio_data = base64.b64decode(audio_base64)
            
            # Send to ADK session
            await self.adk_session.send_audio(audio_data)
            
        except Exception as e:
            logger.error(f"Error processing audio input: {e}")
            await self.send_error(f"Error processing audio: {str(e)}")
    
    async def process_text_input(self, text: str):
        """Process text input from the client"""
        if not self.is_active or not self.adk_session:
            await self.send_error("Session not active")
            return
            
        try:
            # Send to ADK session
            await self.adk_session.send_text(text)
            
        except Exception as e:
            logger.error(f"Error processing text input: {e}")
            await self.send_error(f"Error processing text: {str(e)}")
    
    async def send_agent_response(self, response: AgentResponse):
        """Send agent response to client"""
        await self.websocket.send_json({
            "type": MessageType.AGENT_RESPONSE,
            "data": response.dict()
        })
    
    async def send_visual_feedback(self, feedback: VisualFeedback):
        """Send visual feedback to client"""
        self.current_visual_feedback = feedback
        await self.websocket.send_json({
            "type": MessageType.VISUAL_FEEDBACK,
            "data": feedback.dict()
        })
    
    async def send_step_completion(self, completion: StepCompletion):
        """Send step completion to client"""
        self.completed_steps.append(completion)
        await self.websocket.send_json({
            "type": MessageType.STEP_COMPLETION,
            "data": completion.dict()
        })
    
    async def send_error(self, message: str):
        """Send error message to client"""
        await self.websocket.send_json({
            "type": MessageType.ERROR,
            "data": {"message": message}
        })
    
    async def end(self):
        """End the session"""
        try:
            if self.adk_session:
                await self.adk_session.close()
            
            self.is_active = False
            logger.info(f"Session {self.session_id} ended")
            
        except Exception as e:
            logger.error(f"Error ending session {self.session_id}: {e}")

class SessionManager:
    """Manages multiple tutoring sessions"""
    
    def __init__(self):
        self.sessions: Dict[str, TutoringSession] = {}
    
    async def create_session(self, websocket: WebSocket) -> str:
        """Create a new tutoring session"""
        session_id = str(uuid.uuid4())
        session = TutoringSession(session_id, websocket)
        self.sessions[session_id] = session
        
        logger.info(f"Created session: {session_id}")
        return session_id
    
    async def start_session(self, session_id: str, initial_agent: Agent):
        """Start a session with an initial agent"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        await session.start(initial_agent)
    
    async def process_audio_input(self, session_id: str, audio_base64: str):
        """Process audio input for a session"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        await session.process_audio_input(audio_base64)
    
    async def process_text_input(self, session_id: str, text: str):
        """Process text input for a session"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        await session.process_text_input(text)
    
    async def end_session(self, session_id: str):
        """End a session"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            await session.end()
            del self.sessions[session_id]
            logger.info(f"Session {session_id} removed")
    
    def get_session(self, session_id: str) -> Optional[TutoringSession]:
        """Get a session by ID"""
        return self.sessions.get(session_id)