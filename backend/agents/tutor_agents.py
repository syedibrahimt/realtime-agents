"""
ADK-based tutoring agents converted from OpenAI Realtime agents
Provides multi-agent tutoring experience using Google's Agent Development Kit
"""

import json
import os
import logging
from typing import Dict, Any
from google.adk.agents import Agent

# Load problem data
def load_problem_data():
    """Load the current problem data (hard4.json)"""
    try:
        # Load from the frontend directory
        problem_path = os.path.join(os.path.dirname(__file__), "../../hard4.json")
        with open(problem_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load problem data: {e}")
        # Fallback data
        return {
            "topic": "Science",
            "title": "States of Matter and Phase Changes",
            "problem": "You put an ice cube in a sealed jar and heat it until all the ice becomes steam. The jar stays sealed the whole time. What happens to the total mass?",
            "steps": []
        }

PROBLEM_DATA = load_problem_data()

# Define tools for visual feedback and step completion
def update_notes(steps: list) -> dict:
    """
    Updates the tutoring notes when steps are completed.
    
    Args:
        steps: Array of step information objects that were completed
    """
    logging.info(f"🔧 Tool Called - Updating {len(steps)} steps: {steps}")
    
    results = []
    for step in steps:
        step_number = step.get("stepNumber")
        description = step.get("description")
        updated_expression = step.get("updatedExpression")
        
        if not all([step_number, description, updated_expression]):
            continue
            
        # Validate step number
        if step_number < 1 or step_number > len(PROBLEM_DATA.get("steps", [])):
            logging.error(f"❌ Invalid step number: {step_number}")
            continue
        
        results.append({
            "stepNumber": step_number,
            "description": description,
            "updatedExpression": updated_expression
        })
    
    return {
        "success": True,
        "message": f"Notes updated for {len(results)} steps",
        "steps": results,
        "totalSteps": len(PROBLEM_DATA.get("steps", []))
    }

def show_visual_feedback(type: str, content: str, label: str, step_number: int, question_index: int = None) -> dict:
    """
    Shows visual feedback in the main area based on student responses.
    
    Args:
        type: Type of visual feedback to show (hint, success, illustration)
        content: The content of the visual feedback (text or emoji)
        label: The label for the visual feedback
        step_number: The step number this feedback relates to
        question_index: The index of the conceptual question (optional)
    """
    logging.info(f"🔧 Tool Called - Showing {type} feedback: {content}")
    
    # Validate step number
    if step_number < 1 or step_number > len(PROBLEM_DATA.get("steps", [])):
        return {"success": False, "message": "Invalid step number"}
    
    return {
        "success": True,
        "message": f"{type} feedback shown successfully",
        "type": type,
        "content": content,
        "label": label,
        "stepNumber": step_number,
        "questionIndex": question_index
    }

def show_intro_visual(content: str, label: str, explanation: str, type: str = "text") -> dict:
    """
    Shows introduction visual content and explanation in the main area.
    
    Args:
        content: The content of the visual (could be text, URL, or emoji)
        label: The label/description for the visual
        explanation: The explanation text to be shown with the visual
        type: The type of visual content (text, image, etc.)
    """
    logging.info(f"🔧 Tool Called - Showing introduction visual: {content}")
    
    return {
        "success": True,
        "message": "Introduction visual shown successfully",
        "content": content,
        "label": label,
        "explanation": explanation,
        "type": type
    }

def update_brainstorm_notes(discovery_type: str, step_number: int, student_ideas: list = None, 
                           part_solved: str = None, current_expression: str = None, 
                           approach: str = None, debate_elements: dict = None) -> dict:
    """
    Captures student discoveries, ideas, and progress through brainstorming.
    
    Args:
        discovery_type: Type of discovery or interaction made
        step_number: Which step in the JSON structure this relates to (1-based)
        student_ideas: Ideas and thoughts the student shared
        part_solved: The specific part of the problem they just worked on
        current_expression: Current state of the problem/expression/understanding
        approach: The approach or strategy discovered/used
        debate_elements: Debate elements if comparing approaches
    """
    logging.info(f"🔧 Tool Called - Brainstorm {discovery_type}: step {step_number}")
    
    return {
        "success": True,
        "message": f"Captured student {discovery_type}" + (f" on {part_solved}" if part_solved else ""),
        "discoveryType": discovery_type,
        "stepNumber": step_number,
        "studentIdeas": student_ideas or [],
        "currentExpression": current_expression,
        "approach": approach
    }

def create_greeter_agent() -> Agent:
    """Create the greeter agent"""
    next_agents = "introGiver" if PROBLEM_DATA.get("isConceptIntroductionEnabled") else "questionReader"
    
    instructions = f"""You have to speak only in English. Welcome the student to the tutoring session. 
    Tell them that they will be learning about {PROBLEM_DATA['topic']}: {PROBLEM_DATA['title']}. 
    Be encouraging and supportive in your tone. Once you've provided a warm welcome, the session will 
    automatically proceed to the next phase where we'll work with the {next_agents} agent."""
    
    return Agent(
        model="gemini-2.0-flash-exp",
        name="greeter", 
        description="The initial agent that welcomes and greets the user to the tutoring session.",
        instruction=instructions
    )

def create_intro_giver_agent() -> Agent:
    """Create the introduction giver agent"""
    intro_data = PROBLEM_DATA.get("introData", {})
    
    instructions = f"""You have to speak only in English. Your job is to introduce the mathematical concept to the student.

First, speak the introduction text: "{intro_data.get('Voice', '')}"

Then, use the show_intro_visual tool to display the visual aid and explanation to the student:
show_intro_visual(
    content="{intro_data.get('Visual', {}).get('Content', '')}",
    label="{intro_data.get('Visual', {}).get('Label', '')}",
    explanation="{intro_data.get('TopicExplanation', '')}",
    type="{intro_data.get('Visual', {}).get('Type', 'text')}"
)

After introducing the concept, pause briefly to allow the student to absorb the information, 
then inform them that you'll be moving on to the problem itself. The session will automatically 
continue to the next phase where the problem will be presented.

Note: Always maintain an encouraging and supportive tone. Make the student feel comfortable 
with learning the new concept."""
    
    return Agent(
        model="gemini-2.0-flash-exp",
        name="introGiver",
        description="The agent that introduces the concept with a visual aid and explanation.",
        instruction=instructions,
        tools=[show_intro_visual]
    )

def create_question_reader_agent() -> Agent:
    """Create the question reader agent"""
    question_data = PROBLEM_DATA.get("questionData", {})
    
    instructions = f"""You have to speak only in English. Ask the student whether they want to read 
    the question read out loud or not. If they say yes, read the problem: "{question_data.get('QuestionText', '')}" 
    to them. Once the question has been presented, the tutoring session will automatically begin with 
    the brainstorming phase."""
    
    return Agent(
        model="gemini-2.0-flash-exp", 
        name="questionReader",
        description="The agent that reads out the question/problem and routes to the next agent.",
        instruction=instructions
    )

def create_step_tutor_agent() -> Agent:
    """Create the step tutor agent"""
    steps = PROBLEM_DATA.get("steps", [])
    
    # Generate dynamic instructions based on step data
    step_instructions = []
    step_completion_data = []
    
    for i, step in enumerate(steps):
        step_num = i + 1
        questions = [q.get("Question", "") for q in step.get("ConceptualQuestions", [])]
        question_text = " Then ask: ".join(questions)
        step_instructions.append(f"- For step {step_num}: {question_text}")
        
        notes = step.get("Notes", {})
        step_completion_data.append(
            f'- Step {step_num}: description="{notes.get("Description", "")}", '
            f'expression="{notes.get("UpdatedExpression", "")}"'
        )
    
    instructions = f"""You have to speak only in English. You will guide the student through the 
    problem-solving process for the following problem: {PROBLEM_DATA.get('problem', '')}.

Problem Details:
- Topic: {PROBLEM_DATA.get('topic', '')}
- Title: {PROBLEM_DATA.get('title', '')}
- Total Steps: {len(steps)}

Follow these steps:
- For each step in the steps array, first show the illustration's BeforeQuestion content using 
  show_visual_feedback tool, then ask ALL conceptual questions from that step sequentially.
{chr(10).join(step_instructions)}

Process:
1. Before starting a step, use show_visual_feedback to display the Illustration.BeforeQuestion for that step
2. Ask all conceptual questions for a step, one at a time
3. Wait for the student's answer after each question
4. If the answer is correct:
   - Use show_visual_feedback to display success feedback
   - Acknowledge and continue to the next question in the step
5. If the answer is incorrect:
   - Use show_visual_feedback to display hint feedback visually
   - Speak the hint content to the student
   - Wait for a second attempt from the student
   - If still incorrect, provide the correct answer and move to the next question
6. After completing questions for one or more steps, automatically call the update_notes tool
7. Move to the next step and repeat

CRITICAL: When one or more steps are completed, you MUST call the update_notes tool with data 
for all completed steps:
{chr(10).join(step_completion_data)}

DO NOT mention updating notes or any reference to the tools in your conversation with the student. 
This should happen seamlessly in the background.

At the end, summarize the solution and the session will conclude."""
    
    return Agent(
        model="gemini-2.0-flash-exp",
        name="stepTutor", 
        description="The agent that guides the student through the problem-solving process step by step.",
        instruction=instructions,
        tools=[update_notes, show_visual_feedback]
    )

def create_brainstormer_agent() -> Agent:
    """Create the brainstormer agent"""
    question_data = PROBLEM_DATA.get("questionData", {})
    steps = PROBLEM_DATA.get("steps", [])
    
    # Generate step exploration content
    step_explorations = []
    for step in steps:
        conceptual_q = step.get("ConceptualQuestions", [{}])[0]
        illustration = conceptual_q.get("Illustration", {}).get("BeforeQuestion", {})
        notes = step.get("Notes", {})
        
        step_explorations.append(f"""
**Topic Area: {step.get('Topic', '')}**
- Discovery Focus: {step.get('Description', '')}
- Key Question: "{conceptual_q.get('Question', '')}"
- Show illustration: "{illustration.get('Content', '')}"
- Explore with: "What if we tried...?", "How is this like something you know?", "What would happen if...?"
- Build toward understanding: {notes.get('UpdatedExpression', '')}
""")
    
    instructions = f"""You have to speak only in English. You are a natural brainstorming tutor who 
    guides students through discovery using a proven framework.

**Problem**: {question_data.get('QuestionText', '')}
**Topic**: {PROBLEM_DATA.get('topic', '')} - {PROBLEM_DATA.get('title', '')}

## Your Natural Teaching Flow: ASK → EXPLORE → CONNECT

You follow a natural conversation pattern that feels organic, never mechanical:

### PHASE 1: ASK (Problem Introduction & Setup) 
**Start by reading the problem statement clearly:**
1. Read the full problem: "{question_data.get('QuestionText', '')}"
2. Ask: "What do you already know about this topic?"
3. Listen to 2-3 initial thoughts without judgment
4. Build excitement: "Let's explore this together!"

### PHASE 2: EXPLORE (Guided Discovery Through Ideas)
Work through the learning areas naturally, using rapid-fire discovery questions:

{"".join(step_explorations)}

### PHASE 3: CONNECT (Pattern Recognition & Synthesis)
- "Which ideas feel strongest? Why?"
- "What pattern do you see emerging?"
- "How do all these discoveries connect?"
- "What did we discover together?"

## Natural Conversation Techniques

### Discovery Questions (Use Throughout):
- "What comes to mind when I say...?"
- "Tell me more about that"
- "How does this connect to...?"
- "What pattern do you see?"
- "That's interesting because..."

### Building on Student Ideas:
- "Yes, and..." (expand their thinking)
- "Ooh, that's one way! What about...?" (introduce alternatives)
- "Let's test that idea - what if...?" (explore deeper)
- "You're onto something! How does that work with...?" (connect to other concepts)

## Tool Usage Guidelines

### update_brainstorm_notes:
- Use for every significant discovery
- Track the natural progression of understanding
- Include debate_elements when comparing approaches
- Always specify the current step_number (1-{len(steps)})

### show_visual_feedback:
- "discovery" - for initial observations and aha moments
- "debate" - when naturally comparing different approaches  
- "breakthrough" - for major insights and connections
- "synthesis" - when connecting multiple ideas together

## Your Personality & Style:
- **Curious & Enthusiastic**: Show genuine excitement for their ideas
- **Patient Builder**: Build on every response, no matter how small
- **Question-Driven**: Ask 3 questions for every 1 thing you tell them
- **Celebration-Focused**: Celebrate the thinking process, not just correct answers
- **Natural Conversationalist**: Make it feel like an engaging discussion, not a lesson

Remember: This should feel like an exciting conversation with a curious friend who happens to 
know how to guide discovery. Never mention "steps" or make it feel like a curriculum. 
Let their natural curiosity drive the exploration!"""
    
    return Agent(
        model="gemini-2.0-flash-exp",
        name="brainStormer",
        description="A natural brainstorming tutor that guides students through discovery.",
        instruction=instructions,
        tools=[update_brainstorm_notes, show_visual_feedback]
    )

def create_closer_agent() -> Agent:
    """Create the closer agent"""
    steps = PROBLEM_DATA.get("steps", [])
    final_answer = ""
    if steps:
        final_answer = steps[-1].get("Notes", {}).get("UpdatedExpression", "")
    
    instructions = f"""You have to speak only in English. Congratulate the student for successfully 
    completing all the steps of the problem. Inform them that the final answer to the problem 
    "{PROBLEM_DATA.get('problem', '')}" is: {final_answer}. 
    Encourage them to keep practicing and let them know they did a great job!"""
    
    return Agent(
        model="gemini-2.0-flash-exp",
        name="closer",
        description="The final agent that summarizes the session and provides closure to the user.",
        instruction=instructions
    )

def get_tutoring_agents() -> Dict[str, Agent]:
    """Get all tutoring agents as a dictionary"""
    return {
        "greeter": create_greeter_agent(),
        "introGiver": create_intro_giver_agent(),
        "questionReader": create_question_reader_agent(), 
        "stepTutor": create_step_tutor_agent(),
        "brainStormer": create_brainstormer_agent(),
        "closer": create_closer_agent()
    }