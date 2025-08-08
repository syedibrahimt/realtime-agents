import json
import os
from typing import Dict, Any, List, Optional
import logging

from google.adk import Agent, tool, Model
from google.adk.models import GenerativeModel

logger = logging.getLogger(__name__)

# Load problem data (hardcoded to hard4.json for now)
PROBLEM_DATA_PATH = "../hard4.json"

class TutoringAgents:
    """Factory class for creating tutoring agents using Google ADK"""
    
    def __init__(self):
        self.problem_data = self._load_problem_data()
        self.model = GenerativeModel("gemini-2.0-flash-exp")
        
    def _load_problem_data(self) -> Dict[str, Any]:
        """Load problem data from JSON file"""
        try:
            # Get the absolute path to the problem data file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.join(current_dir, "..", "..", "..")
            problem_path = os.path.join(project_root, "hard4.json")
            
            with open(problem_path, 'r') as f:
                data = json.load(f)
            logger.info("Successfully loaded problem data")
            return data
        except Exception as e:
            logger.error(f"Failed to load problem data: {e}")
            # Return a default structure if loading fails
            return {
                "topic": "Science",
                "title": "Problem Loading Failed",
                "problem": "There was an error loading the problem data.",
                "steps": [],
                "isConceptIntroductionEnabled": False
            }
    
    def get_greeter_agent(self) -> Agent:
        """Create and return the greeter agent"""
        
        # Determine next agents based on concept introduction setting
        next_agents = []
        if self.problem_data.get("isConceptIntroductionEnabled", False):
            next_agents = ["introGiver"]
        else:
            next_agents = ["questionReader"]
        
        instructions = f"""You have to speak only in English. Welcome the student to the tutoring session. 
        Tell them that they will be learning about {self.problem_data['topic']}: {self.problem_data['title']}. 
        Be encouraging and supportive in your tone. Once you've provided a warm welcome, the session will 
        automatically proceed to the next phase."""
        
        return Agent(
            name="greeter",
            model=self.model,
            system_instruction=instructions,
            handoffs=next_agents
        )
    
    def get_intro_giver_agent(self) -> Agent:
        """Create and return the intro giver agent"""
        
        intro_data = self.problem_data.get("introData", {})
        topic_explanation = intro_data.get("TopicExplanation", "")
        visual = intro_data.get("Visual", {})
        voice = intro_data.get("Voice", "")
        
        @tool
        async def show_intro_visual(content: str, label: str, explanation: str, content_type: str = "text"):
            """Show introduction visual content to the student"""
            try:
                # This would trigger the frontend to show the intro visual
                return {
                    "visual_feedback": {
                        "type": "intro",
                        "content": content,
                        "label": label,
                        "explanation": explanation,
                        "contentType": content_type
                    }
                }
            except Exception as e:
                logger.error(f"Error showing intro visual: {e}")
                return {"success": False, "error": str(e)}
        
        instructions = f"""You have to speak only in English. You are responsible for introducing the concept 
        before the main question. 
        
        Topic Explanation: {topic_explanation}
        
        First, use the show_intro_visual tool to display the visual content: "{visual.get('Content', '')}" 
        with label: "{visual.get('Label', '')}" and explanation: "{topic_explanation}".
        
        Then speak this introduction: {voice}
        
        After providing the introduction, automatically proceed to the question reader phase."""
        
        return Agent(
            name="introGiver",
            model=self.model,
            system_instruction=instructions,
            tools=[show_intro_visual],
            handoffs=["questionReader"]
        )
    
    def get_question_reader_agent(self) -> Agent:
        """Create and return the question reader agent"""
        
        problem = self.problem_data.get("problem", "")
        question_data = self.problem_data.get("questionData", {})
        options = question_data.get("Options", [])
        
        # Format options for reading
        options_text = ""
        if options:
            options_text = " Options are: " + "; ".join([
                f"{chr(65 + i)}. {opt['Option']}" 
                for i, opt in enumerate(options)
            ])
        
        instructions = f"""You have to speak only in English. Ask the student whether they want to read 
        the question read out loud or not. If they say yes, read the {problem} and {options_text} to them. 
        Once the question has been presented, the tutoring session will automatically begin."""
        
        return Agent(
            name="questionReader",
            model=self.model,
            system_instruction=instructions,
            handoffs=["brainStormer"]
        )
    
    def get_step_tutor_agent(self) -> Agent:
        """Create and return the step tutor agent"""
        
        @tool
        async def update_notes(steps: List[Dict[str, Any]]):
            """Updates the tutoring notes when steps are completed"""
            try:
                step_completions = []
                for step in steps:
                    step_completion = {
                        "step_number": step["stepNumber"],
                        "description": step["description"],
                        "updated_expression": step["updatedExpression"],
                        "completed_at": "2025-01-01T00:00:00Z"  # Would use actual timestamp
                    }
                    step_completions.append(step_completion)
                
                return {
                    "step_completion": step_completions,
                    "success": True,
                    "message": f"Notes updated for {len(steps)} steps"
                }
            except Exception as e:
                logger.error(f"Error updating notes: {e}")
                return {"success": False, "error": str(e)}
        
        @tool
        async def show_visual_feedback(
            feedback_type: str, 
            content: str, 
            label: str, 
            step_number: int, 
            question_index: Optional[int] = None
        ):
            """Show visual feedback in the main area"""
            try:
                return {
                    "visual_feedback": {
                        "type": feedback_type,
                        "content": content,
                        "label": label,
                        "step_number": step_number,
                        "question_index": question_index
                    }
                }
            except Exception as e:
                logger.error(f"Error showing visual feedback: {e}")
                return {"success": False, "error": str(e)}
        
        # Generate dynamic instructions based on problem data
        steps = self.problem_data.get("steps", [])
        problem = self.problem_data.get("problem", "")
        topic = self.problem_data.get("topic", "")
        title = self.problem_data.get("title", "")
        
        step_instructions = []
        step_completion_data = []
        
        for i, step in enumerate(steps):
            step_num = i + 1
            questions = step.get("ConceptualQuestions", [])
            question_text = " Then ask: ".join([q.get("Question", "") for q in questions])
            step_instructions.append(f"- For step {step_num}: {question_text}")
            
            notes = step.get("Notes", {})
            description = notes.get("Description", "")
            expression = notes.get("UpdatedExpression", "")
            step_completion_data.append(
                f'- Step {step_num}: description="{description}", expression="{expression}"'
            )
        
        instructions = f"""You have to speak only in English. You will guide the student through the 
        problem-solving process for the following problem: {problem}.

Problem Details:
- Topic: {topic}
- Title: {title}
- Total Steps: {len(steps)}

Follow these steps:
- For each step in the steps array, first show the illustration's BeforeQuestion content using 
  show_visual_feedback, then ask ALL conceptual questions from that step sequentially.
{chr(10).join(step_instructions)}

Process:
1. Before starting a step, use show_visual_feedback to display the Illustration.BeforeQuestion for that step
2. Ask all conceptual questions for a step, one at a time
3. Wait for the student's answer after each question
4. If the answer is correct:
   - Use show_visual_feedback to display the Success feedback
   - Acknowledge and continue to the next question
5. If the answer is incorrect:
   - Use show_visual_feedback to display the Hint feedback
   - Speak the hint content to the student
   - Wait for a second attempt
6. After completing questions for one or more steps, call update_notes tool automatically
7. Move to the next step and repeat

CRITICAL: When steps are completed, call update_notes with data for all completed steps:
{chr(10).join(step_completion_data)}

Tool calling must be done silently without mentioning it to the student.
At the end, summarize the solution and the session will conclude."""
        
        return Agent(
            name="stepTutor",
            model=self.model,
            system_instruction=instructions,
            tools=[update_notes, show_visual_feedback],
            handoffs=["closer"]
        )
    
    def get_brain_stormer_agent(self) -> Agent:
        """Create and return the brain stormer agent"""
        
        problem = self.problem_data.get("problem", "")
        topic = self.problem_data.get("topic", "")
        
        instructions = f"""You have to speak only in English. You're an interactive brainstorming agent 
        focused on {topic}. Help the student explore the problem: {problem}. 
        
        Guide them to think through the problem step by step by asking thought-provoking questions. 
        Encourage them to explain their reasoning and explore different approaches. Once they've had a good 
        brainstorming session, you'll hand off to the step-by-step tutoring phase."""
        
        return Agent(
            name="brainStormer",
            model=self.model,
            system_instruction=instructions,
            handoffs=["stepTutor"]
        )
    
    def get_closer_agent(self) -> Agent:
        """Create and return the closer agent"""
        
        problem = self.problem_data.get("problem", "")
        steps = self.problem_data.get("steps", [])
        
        # Get the final answer from the last step
        final_answer = ""
        if steps:
            last_step = steps[-1]
            notes = last_step.get("Notes", {})
            final_answer = notes.get("UpdatedExpression", "")
        
        instructions = f"""You have to speak only in English. Congratulate the student for successfully 
        completing all the steps of the problem. Inform them that the final answer to the problem 
        "{problem}" is: {final_answer}. Encourage them to keep practicing and let them know they did a great job!"""
        
        return Agent(
            name="closer",
            model=self.model,
            system_instruction=instructions
        )
    
    def get_agent_by_name(self, name: str) -> Optional[Agent]:
        """Get an agent by name"""
        agent_methods = {
            "greeter": self.get_greeter_agent,
            "introGiver": self.get_intro_giver_agent,
            "questionReader": self.get_question_reader_agent,
            "stepTutor": self.get_step_tutor_agent,
            "brainStormer": self.get_brain_stormer_agent,
            "closer": self.get_closer_agent
        }
        
        if name in agent_methods:
            return agent_methods[name]()
        return None