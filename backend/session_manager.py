"""
Session Manager for ADK-based tutoring sessions
Handles creation, management, and cleanup of user sessions
"""

import asyncio
import logging
import os
from typing import Dict, List, Optional, AsyncGenerator
from dataclasses import dataclass
import json
import base64

logger = logging.getLogger(__name__)

@dataclass
class SessionEvent:
    """Represents an event from the agent session"""
    type: str
    data: dict = None
    transcript: str = ""
    audio_data: str = ""
    agent_name: str = ""
    function_name: str = ""
    arguments: dict = None
    message: str = ""

class TutoringSession:
    """Manages a single tutoring session with ADK agents"""
    
    def __init__(self, session_id: str, agents: Dict):
        self.session_id = session_id
        self.agents = agents
        self.current_agent_name = "greeter"
        self.current_agent = None
        self.agent_session = None
        self.is_active = False
        self.event_queue = asyncio.Queue()
        self._lock = asyncio.Lock()
        
        # Initialize with the greeter agent
        self._initialize_agent()
        
    async def switch_to_agent(self, agent_name: str) -> bool:
        """Switch to a different agent"""
        try:
            async with self._lock:
                if agent_name not in self.agents:
                    logger.error(f"Agent '{agent_name}' not found in session {self.session_id}")
                    return False
                
                # Stop current agent session if active
                if self.agent_session:
                    await self.agent_session.close()
                
                # Start new agent session
                self.current_agent = self.agents[agent_name]
                self.agent_session = self.current_agent.create_session()
                self.is_active = True
                
                # Notify about agent switch
                await self.event_queue.put(SessionEvent(
                    type="agent.switched",
                    agent_name=agent_name
                ))
                
                logger.info(f"Switched to agent '{agent_name}' in session {self.session_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error switching to agent '{agent_name}': {e}")
            return False
    
    async def send_text_message(self, text: str):
        """Send a text message to the current agent"""
        try:
            if not self.agent_session or not self.is_active:
                logger.warning(f"No active agent session for {self.session_id}")
                return
            
            # Send message to agent and process response
            async for event in self.agent_session.send_text(text):
                await self._process_agent_event(event)
                
        except Exception as e:
            logger.error(f"Error sending text message: {e}")
            await self.event_queue.put(SessionEvent(
                type="error",
                message=f"Failed to process text message: {str(e)}"
            ))
    
    async def send_audio_message(self, audio_data: str):
        """Send audio data to the current agent"""
        try:
            if not self.agent_session or not self.is_active:
                logger.warning(f"No active agent session for {self.session_id}")
                return
            
            # Decode base64 audio data
            audio_bytes = base64.b64decode(audio_data)
            
            # Send audio to agent and process response
            async for event in self.agent_session.send_audio(audio_bytes):
                await self._process_agent_event(event)
                
        except Exception as e:
            logger.error(f"Error sending audio message: {e}")
            await self.event_queue.put(SessionEvent(
                type="error",
                message=f"Failed to process audio message: {str(e)}"
            ))
    
    async def handle_control(self, control_type: str, data: dict = None):
        """Handle control messages (start, stop, switch agent, etc.)"""
        try:
            if control_type == "switch_agent":
                agent_name = data.get("agent") if data else None
                if agent_name:
                    await self.switch_to_agent(agent_name)
            
            elif control_type == "stop":
                await self.stop_session()
            
            elif control_type == "restart":
                await self.restart_session()
                
            else:
                logger.warning(f"Unknown control type: {control_type}")
                
        except Exception as e:
            logger.error(f"Error handling control '{control_type}': {e}")
    
    async def _process_agent_event(self, event):
        """Process events from the ADK agent session"""
        try:
            # Map ADK events to our session events
            if hasattr(event, 'type'):
                if event.type == "response.audio_transcript.delta":
                    await self.event_queue.put(SessionEvent(
                        type="response.audio_transcript.delta",
                        transcript=getattr(event, 'transcript', '')
                    ))
                
                elif event.type == "response.audio.delta":
                    # Convert audio bytes to base64
                    audio_b64 = base64.b64encode(getattr(event, 'audio', b'')).decode()
                    await self.event_queue.put(SessionEvent(
                        type="response.audio.delta",
                        audio_data=audio_b64
                    ))
                
                elif event.type == "response.done":
                    await self.event_queue.put(SessionEvent(type="response.done"))
                
                elif event.type == "tool_call":
                    # Handle tool calls for visual feedback, step completion, etc.
                    function_name = getattr(event, 'function_name', '')
                    arguments = getattr(event, 'arguments', {})
                    
                    await self.event_queue.put(SessionEvent(
                        type="tool.call",
                        function_name=function_name,
                        arguments=arguments
                    ))
                
                elif event.type == "agent_handoff":
                    # Handle agent handoffs
                    target_agent = getattr(event, 'target_agent', '')
                    if target_agent:
                        await self.switch_to_agent(target_agent)
                
                else:
                    logger.debug(f"Unhandled event type: {event.type}")
                    
        except Exception as e:
            logger.error(f"Error processing agent event: {e}")
    
    async def stream_events(self) -> AsyncGenerator[SessionEvent, None]:
        """Stream events from the agent session"""
        while self.is_active:
            try:
                # Wait for next event with timeout
                event = await asyncio.wait_for(self.event_queue.get(), timeout=1.0)
                yield event
            except asyncio.TimeoutError:
                # Continue waiting for events
                continue
            except Exception as e:
                logger.error(f"Error streaming events: {e}")
                yield SessionEvent(
                    type="error",
                    message=f"Stream error: {str(e)}"
                )
                break
    
    async def stop_session(self):
        """Stop the current agent session"""
        try:
            async with self._lock:
                self.is_active = False
                if self.agent_session:
                    await self.agent_session.close()
                    self.agent_session = None
                logger.info(f"Stopped session {self.session_id}")
        except Exception as e:
            logger.error(f"Error stopping session {self.session_id}: {e}")
    
    async def restart_session(self):
        """Restart the session with the greeter agent"""
        try:
            await self.stop_session()
            await self.switch_to_agent("greeter")
            logger.info(f"Restarted session {self.session_id}")
        except Exception as e:
            logger.error(f"Error restarting session {self.session_id}: {e}")
    
    async def cleanup(self):
        """Clean up session resources"""
        await self.stop_session()

class SessionManager:
    """Manages multiple concurrent tutoring sessions"""
    
    def __init__(self):
        self.sessions: Dict[str, TutoringSession] = {}
        self._lock = asyncio.Lock()
    
    async def create_session(self, session_id: str, agents: Dict[str, Agent]) -> bool:
        """Create a new tutoring session"""
        try:
            async with self._lock:
                if session_id in self.sessions:
                    logger.warning(f"Session {session_id} already exists")
                    return False
                
                session = TutoringSession(session_id, agents)
                self.sessions[session_id] = session
                
                logger.info(f"Created session {session_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error creating session {session_id}: {e}")
            return False
    
    async def get_session(self, session_id: str) -> Optional[TutoringSession]:
        """Get an existing session"""
        return self.sessions.get(session_id)
    
    async def cleanup_session(self, session_id: str) -> bool:
        """Clean up and remove a session"""
        try:
            async with self._lock:
                if session_id not in self.sessions:
                    logger.warning(f"Session {session_id} not found for cleanup")
                    return False
                
                session = self.sessions[session_id]
                await session.cleanup()
                del self.sessions[session_id]
                
                logger.info(f"Cleaned up session {session_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error cleaning up session {session_id}: {e}")
            return False
    
    async def cleanup_all_sessions(self):
        """Clean up all sessions"""
        try:
            session_ids = list(self.sessions.keys())
            for session_id in session_ids:
                await self.cleanup_session(session_id)
            logger.info("All sessions cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up all sessions: {e}")
    
    def get_session_count(self) -> int:
        """Get the number of active sessions"""
        return len(self.sessions)