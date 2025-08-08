#!/usr/bin/env python3

import asyncio
import json
import os
import uuid
import base64
import logging
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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

# In-memory storage for active sessions
active_sessions: Dict[str, Dict[str, Any]] = {}

# Load problem data
def load_problem_data():
    """Load problem data from hard4.json"""
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        problem_path = os.path.join(current_dir, "..", "hard4.json")
        
        with open(problem_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load problem data: {e}")
        return {"topic": "Error", "title": "Problem loading failed", "steps": []}

problem_data = load_problem_data()

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
            "type": "connection_status",
            "status": "connected",
            "message": "Connected to ADK Tutoring Backend"
        })
        
        async for message in websocket.iter_json():
            try:
                message_type = message.get("type")
                data = message.get("data", {})
                
                if message_type == "init_session":
                    # Initialize new session
                    session_id = str(uuid.uuid4())
                    active_sessions[session_id] = {
                        "websocket": websocket,
                        "current_agent": "greeter",
                        "completed_steps": [],
                        "is_active": True
                    }
                    
                    await websocket.send_json({
                        "type": "session_created",
                        "session_id": session_id,
                        "message": "Session initialized successfully"
                    })
                    
                    # Send initial greeting
                    await send_agent_response(
                        websocket,
                        agent_name="greeter",
                        content=f"Welcome to the tutoring session! Today we'll be learning about {problem_data['topic']}: {problem_data['title']}. I'm here to help guide you through this step by step. Are you ready to begin?"
                    )
                    
                elif message_type == "audio_data":
                    # Handle audio input (for now, just acknowledge)
                    if session_id and session_id in active_sessions:
                        logger.info("Received audio data")
                        await send_agent_response(
                            websocket,
                            agent_name=active_sessions[session_id]["current_agent"],
                            content="I heard you! Let me process that..."
                        )
                        
                elif message_type == "text_message":
                    # Handle text input
                    if session_id and session_id in active_sessions:
                        text = data.get("text", "")
                        logger.info(f"Received text: {text}")
                        
                        # Simple response logic
                        current_agent = active_sessions[session_id]["current_agent"]
                        response = await generate_agent_response(current_agent, text, session_id)
                        
                        await send_agent_response(
                            websocket,
                            agent_name=current_agent,
                            content=response
                        )
                        
                elif message_type == "end_session":
                    # End the session
                    if session_id and session_id in active_sessions:
                        del active_sessions[session_id]
                        
                        await websocket.send_json({
                            "type": "session_ended",
                            "message": "Session ended successfully"
                        })
                        
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"Error processing message: {str(e)}"}
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
        if session_id and session_id in active_sessions:
            del active_sessions[session_id]
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if session_id and session_id in active_sessions:
            del active_sessions[session_id]

async def send_agent_response(websocket: WebSocket, agent_name: str, content: str):
    """Send agent response to client"""
    await websocket.send_json({
        "type": "agent_response",
        "data": {
            "agent_name": agent_name,
            "response_type": "text",
            "content": content,
            "audio_base64": None,
            "metadata": None
        }
    })

async def generate_agent_response(agent_name: str, user_input: str, session_id: str) -> str:
    """Generate agent response based on current agent and user input"""
    
    # Simple rule-based responses for demonstration
    # In a real implementation, this would call Google Gemini API
    
    user_input_lower = user_input.lower()
    
    if agent_name == "greeter":
        if "yes" in user_input_lower or "ready" in user_input_lower:
            # Move to next agent
            active_sessions[session_id]["current_agent"] = "questionReader"
            return "Great! Let me read you the question we'll be working on today."
        else:
            return "That's okay! Take your time. When you're ready to begin learning, just let me know!"
    
    elif agent_name == "questionReader":
        question_text = problem_data.get("questionData", {}).get("QuestionText", "")
        options = problem_data.get("questionData", {}).get("Options", [])
        
        options_text = ""
        if options:
            options_text = " The options are: " + "; ".join([
                f"{chr(65 + i)}. {opt['Option']}" 
                for i, opt in enumerate(options)
            ])
        
        # Move to brainstorming
        active_sessions[session_id]["current_agent"] = "brainStormer"
        return f"Here's the question: {question_text}{options_text}. Now let's brainstorm together!"
    
    elif agent_name == "brainStormer":
        if len(user_input) > 10:  # If they gave a substantial response
            # Move to step tutor
            active_sessions[session_id]["current_agent"] = "stepTutor"
            return "Excellent thinking! Now let's work through this step by step. I'll guide you through each part of the solution."
        else:
            return "That's a good start! Can you tell me more about how you'd approach this problem?"
    
    elif agent_name == "stepTutor":
        # Simulate step completion
        steps = problem_data.get("steps", [])
        completed_count = len(active_sessions[session_id]["completed_steps"])
        
        if completed_count < len(steps):
            step = steps[completed_count]
            questions = step.get("ConceptualQuestions", [])
            
            if questions:
                question = questions[0].get("Question", "What's the next step?")
                
                # Check if answer seems correct (simple heuristic)
                if any(word in user_input_lower for word in ["yes", "correct", "right", "plus", "add", "multiply", "divide"]):
                    # Mark step as completed
                    active_sessions[session_id]["completed_steps"].append({
                        "step_number": completed_count + 1,
                        "description": step.get("Notes", {}).get("Description", "Step completed"),
                        "updated_expression": step.get("Notes", {}).get("UpdatedExpression", ""),
                        "completed_at": "2025-01-01T00:00:00Z"
                    })
                    
                    # Send step completion to frontend
                    websocket = active_sessions[session_id]["websocket"]
                    await websocket.send_json({
                        "type": "step_completion",
                        "data": {
                            "step_number": completed_count + 1,
                            "description": step.get("Notes", {}).get("Description", "Step completed"),
                            "updated_expression": step.get("Notes", {}).get("UpdatedExpression", ""),
                            "completed_at": "2025-01-01T00:00:00Z"
                        }
                    })
                    
                    # Send visual feedback
                    await websocket.send_json({
                        "type": "visual_feedback",
                        "data": {
                            "type": "success",
                            "content": "🎉",
                            "label": "Great job!",
                            "step_number": completed_count + 1
                        }
                    })
                    
                    if completed_count + 1 >= len(steps):
                        # All steps completed, move to closer
                        active_sessions[session_id]["current_agent"] = "closer"
                        return "Excellent! You've completed all the steps. Let me summarize what we've accomplished."
                    else:
                        return f"Perfect! You got step {completed_count + 1} correct. Now let's move to the next step: {question}"
                else:
                    return f"Not quite right, but good try! Let me give you a hint. {question}"
            else:
                return "Great progress! Let's continue to the next step."
        else:
            # All steps completed
            active_sessions[session_id]["current_agent"] = "closer"
            return "Fantastic! You've successfully completed all the steps. Let me congratulate you on your achievement!"
    
    elif agent_name == "closer":
        final_answer = ""
        steps = problem_data.get("steps", [])
        if steps:
            final_answer = steps[-1].get("Notes", {}).get("UpdatedExpression", "")
        
        problem_text = problem_data.get("questionData", {}).get("QuestionText", "this problem")
        return f"Congratulations! You've successfully solved {problem_text}. The final answer is: {final_answer}. You did an excellent job working through each step methodically. Keep up the great work in your studies!"
    
    return "I'm here to help you learn! What would you like to explore next?"

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting ADK Tutoring Backend on {host}:{port}")
    uvicorn.run(app, host=host, port=port)