from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel

class MessageType(str, Enum):
    """Message types for WebSocket communication"""
    CONNECTION_STATUS = "connection_status"
    INIT_SESSION = "init_session"
    SESSION_CREATED = "session_created"
    SESSION_ENDED = "session_ended"
    AUDIO_DATA = "audio_data"
    TEXT_MESSAGE = "text_message"
    AGENT_RESPONSE = "agent_response"
    AGENT_HANDOFF = "agent_handoff"
    VISUAL_FEEDBACK = "visual_feedback"
    STEP_COMPLETION = "step_completion"
    ERROR = "error"
    END_SESSION = "end_session"

class ConnectionStatus(str, Enum):
    """Connection status values"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"

class WebSocketMessage(BaseModel):
    """Base WebSocket message structure"""
    type: MessageType
    data: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    timestamp: Optional[str] = None

class AudioData(BaseModel):
    """Audio data structure"""
    audio_base64: str
    format: str = "pcm16"
    sample_rate: int = 24000

class TextMessage(BaseModel):
    """Text message structure"""
    text: str

class AgentResponse(BaseModel):
    """Agent response structure"""
    agent_name: str
    response_type: str  # "text", "audio", "visual"
    content: str
    audio_base64: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class VisualFeedback(BaseModel):
    """Visual feedback structure"""
    type: str  # "illustration", "hint", "success", "intro"
    content: str
    label: str
    explanation: Optional[str] = None
    step_number: Optional[int] = None
    question_index: Optional[int] = None

class StepCompletion(BaseModel):
    """Step completion structure"""
    step_number: int
    description: str
    updated_expression: str
    completed_at: str