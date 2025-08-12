"""
Final Session Manager for ADK-based tutoring sessions
Simplified approach focusing on WebSocket communication
"""

import asyncio
import logging
import json
from typing import Dict, Optional, AsyncGenerator
from dataclasses import dataclass

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
    """Manages a single tutoring session with simplified agent handling"""
    
    def __init__(self, session_id: str, agents: Dict):
        self.session_id = session_id
        self.agents = agents
        self.current_agent_name = "greeter"
        self.is_active = False
        self.event_queue = asyncio.Queue()
        self._lock = asyncio.Lock()
        
        logger.info(f"Created session {session_id} with agents: {list(agents.keys())}")
        
    async def switch_to_agent(self, agent_name: str) -> bool:
        """Switch to a different agent"""
        try:
            async with self._lock:
                if agent_name not in self.agents:
                    logger.error(f"Agent '{agent_name}' not found in session {self.session_id}")
                    return False
                
                self.current_agent_name = agent_name
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
    
    async def process_user_message(self, message_type: str, content: str):
        """Process a user message with the current agent"""
        try:
            current_agent = self.agents.get(self.current_agent_name)
            if not current_agent:
                raise ValueError(f"Current agent '{self.current_agent_name}' not found")
            
            logger.info(f"Processing {message_type} with agent {self.current_agent_name}: {content[:50]}...")
            
            # For now, create a simple response simulation
            # In a full implementation, this would use the ADK agent's generate() method
            if message_type == "text":
                # Simulate agent processing
                await asyncio.sleep(0.1)
                
                # Create a response based on the current agent
                response = await self._generate_agent_response(content)
                
                # Send response as transcript
                await self.event_queue.put(SessionEvent(
                    type="response.audio_transcript.delta",
                    transcript=response
                ))
                
                # Check if we should switch agents or call tools
                await self._handle_agent_logic(content)
                
                # Mark response as done
                await self.event_queue.put(SessionEvent(type="response.done"))
            
            elif message_type == "audio":
                # For audio, simulate transcription first then process
                await asyncio.sleep(0.2)
                simulated_transcript = "[Audio processed: User spoke to the agent]"
                await self.process_user_message("text", simulated_transcript)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await self.event_queue.put(SessionEvent(
                type="error",
                message=f"Failed to process message: {str(e)}"
            ))
    
    async def _generate_agent_response(self, user_input: str) -> str:
        """Generate a response based on the current agent"""
        agent_responses = {
            "greeter": f"Welcome to our tutoring session! I'm excited to help you learn. You said: {user_input}",
            "introGiver": f"Let me introduce this concept to you. Based on what you said: {user_input}, here's what we'll explore...",
            "questionReader": f"Now let me present the question to you. You mentioned: {user_input}. Here's our problem to solve...",
            "stepTutor": f"Great! Let's work through this step by step. From your input: {user_input}, I can see we should focus on...",
            "brainStormer": f"Excellent thinking! You said: {user_input}. Let's explore this idea further and see what we can discover together...",
            "closer": f"Wonderful work! You've done great today. Reflecting on what you shared: {user_input}, you've learned so much!"
        }
        
        return agent_responses.get(self.current_agent_name, f"I'm the {self.current_agent_name} agent and I heard: {user_input}")
    
    async def _handle_agent_logic(self, user_input: str):
        """Handle agent-specific logic like tool calls and handoffs"""
        try:
            # Simulate tool calls based on agent and input
            if self.current_agent_name == "stepTutor" and ("step" in user_input.lower() or "solve" in user_input.lower()):
                # Simulate step completion
                await self.event_queue.put(SessionEvent(
                    type="tool.call",
                    function_name="update_notes",
                    arguments={
                        "steps": [{
                            "stepNumber": 1,
                            "description": "Student worked on the first step",
                            "updatedExpression": "x = 5"
                        }]
                    }
                ))
            
            elif self.current_agent_name == "introGiver":
                # Simulate visual introduction
                await self.event_queue.put(SessionEvent(
                    type="tool.call",
                    function_name="show_intro_visual",
                    arguments={
                        "content": "🧊 → 💧 → ☁️",
                        "label": "States of matter transition",
                        "explanation": "Matter changes from solid to liquid to gas",
                        "type": "text"
                    }
                ))
            
            # Simulate agent handoffs after certain interactions
            handoff_logic = {
                "greeter": ("introGiver", 1),  # Switch after 1 interaction
                "introGiver": ("questionReader", 1),
                "questionReader": ("brainStormer", 1),
                "brainStormer": ("stepTutor", 3),  # Switch after 3 interactions
                "stepTutor": ("closer", 5),  # Switch after 5 interactions
            }
            
            # For simplicity, we'll switch after the first meaningful interaction
            if self.current_agent_name in handoff_logic:
                next_agent, _ = handoff_logic[self.current_agent_name]
                # Switch to next agent after a delay
                await asyncio.sleep(2)
                await self.switch_to_agent(next_agent)
                
        except Exception as e:
            logger.error(f"Error in agent logic: {e}")
    
    async def handle_control(self, control_type: str, data: dict = None):
        """Handle control messages"""
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
    
    async def stream_events(self) -> AsyncGenerator[SessionEvent, None]:
        """Stream events from the session"""
        # Start the session when streaming begins
        if not self.is_active:
            await self.switch_to_agent(self.current_agent_name)
            
            # Send a welcome message
            await asyncio.sleep(0.5)
            await self.event_queue.put(SessionEvent(
                type="response.audio_transcript.delta",
                transcript=f"Hello! Welcome to the tutoring session. I'm your {self.current_agent_name}. How can I help you today?"
            ))
            await self.event_queue.put(SessionEvent(type="response.done"))
        
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
        """Stop the session"""
        try:
            async with self._lock:
                self.is_active = False
                logger.info(f"Stopped session {self.session_id}")
        except Exception as e:
            logger.error(f"Error stopping session {self.session_id}: {e}")
    
    async def restart_session(self):
        """Restart the session"""
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
    
    async def create_session(self, session_id: str, agents: Dict) -> bool:
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