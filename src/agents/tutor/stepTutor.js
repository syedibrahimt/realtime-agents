import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard3.json"

// Note: handoffs will be set after all agents are created to avoid circular dependencies
let nextAgents = []

class StepTutorAgent extends GeminiAgent {
  constructor(config) {
    super(config)
    this.currentStep = 1
    this.currentQuestionIndex = 0
  }

  /**
   * Process incoming messages and handle tool calls
   */
  processMessage(data) {
    super.processMessage(data)
    
    // Check if we need to handle tools
    if (this.isActive && data.serverContent?.modelTurn) {
      const parts = data.serverContent.modelTurn.parts
      
      parts.forEach(part => {
        if (part.text) {
          // Check for tool calls in the text
          if (part.text.includes('updateNotes')) {
            this.handleUpdateNotes()
          }
          if (part.text.includes('showVisualFeedback')) {
            this.handleShowVisualFeedback(part.text)
          }
        }
      })
    }
  }

  /**
   * Handle updateNotes tool functionality
   */
  handleUpdateNotes() {
    console.log(`🔧 StepTutor Agent - Updating notes`)

    // Extract step information from the context
    // For now, we'll use the current step data
    const stepData = problemData.steps[this.currentStep - 1]
    if (!stepData) {
      console.error(`❌ Step data not found for step ${this.currentStep}`)
      return
    }

    const stepNumber = this.currentStep
    const description = stepData.Notes.Description
    const updatedExpression = stepData.Notes.UpdatedExpression

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleStepCompletion) {
      window.handleStepCompletion(stepNumber, description, updatedExpression)
      console.log(`✅ Updated notes for step ${stepNumber}`)
    }

    // Move to next step
    this.currentStep++
  }

  /**
   * Handle showVisualFeedback tool functionality
   */
  handleShowVisualFeedback(text) {
    console.log(`🔧 StepTutor Agent - Showing visual feedback`)

    // Extract feedback type from context
    let type = "illustration"
    let content = "🎯"
    let label = "Visual Feedback"
    
    if (text.includes('hint')) {
      type = "hint"
      content = "🤔"
      label = "Think about this..."
    } else if (text.includes('success')) {
      type = "success"
      content = "✅"
      label = "Correct!"
    }

    const stepNumber = this.currentStep
    const questionIndex = this.currentQuestionIndex

    // Get actual content from problem data if available
    const stepData = problemData.steps[stepNumber - 1]
    if (stepData) {
      if (type === "illustration" && stepData.Illustration?.BeforeQuestion) {
        content = stepData.Illustration.BeforeQuestion.Content
        label = stepData.Illustration.BeforeQuestion.Label
      } else if (type === "success" && stepData.Illustration?.Feedback?.Success) {
        content = stepData.Illustration.Feedback.Success.Content
        label = stepData.Illustration.Feedback.Success.Label
      } else if (type === "hint" && stepData.Illustration?.Feedback?.Hint) {
        content = stepData.Illustration.Feedback.Hint.Content
        label = stepData.Illustration.Feedback.Hint.Label
      }
    }

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        type,
        content,
        label,
        stepNumber,
        questionIndex
      )
      console.log(`✅ Showed ${type} feedback for step ${stepNumber}`)
    }
  }

  /**
   * Override activation to reset step tracking
   */
  async activate(session) {
    await super.activate(session)
    this.currentStep = 1
    this.currentQuestionIndex = 0
  }
}

// Helper function to generate dynamic step instructions
const generateStepInstructions = (steps) => {
  return steps
    .map((step, index) => {
      const questions = step.ConceptualQuestions.map((q) => q.Question).join(
        " Then ask: "
      )

      return `- For step ${index + 1}: ${questions}`
    })
    .join("\n")
}

// Helper function to generate dynamic step completion data
const generateStepCompletionData = (steps) => {
  return steps
    .map((step, index) => {
      return `- Step ${index + 1}: description="${
        step.Notes.Description
      }", expression="${step.Notes.UpdatedExpression}"`
    })
    .join("\n")
}

const stepTutorAgent = new StepTutorAgent({
  name: "stepTutor",
  voice: "Kore",
  handoffDescription:
    "The agent that guides the student through the problem-solving process step by step.",
  instructions: `You have to speak only in English. You will guide the student through the problem-solving process for the following problem: ${
    problemData.problem
  }.

Problem Details:
- Topic: ${problemData.topic}
- Title: ${problemData.title}
- Total Steps: ${problemData.steps.length}

Follow these steps:
- For each step in the steps array, first show the illustration's BeforeQuestion content by mentioning "showVisualFeedback", then ask ALL conceptual questions from that step sequentially.
${generateStepInstructions(problemData.steps)}

Process:
1. Before starting a step, mention "showVisualFeedback" to display the Illustration.BeforeQuestion for that step
2. Ask all conceptual questions for a step, one at a time
3. Wait for the student's answer after each question
4. If the answer is correct:
   - Mention "showVisualFeedback success" to display the success feedback
   - Acknowledge and continue to the next question in the step
5. If the answer is incorrect:
   - Mention "showVisualFeedback hint" to display the hint feedback visually
   - Speak the hint content to the student
   - Wait for a second attempt from the student
   - If the second attempt is also incorrect, provide the correct answer and move to the next question
   - If the second attempt is correct, acknowledge and continue to the next question
6. After completing questions for one or more steps, mention "updateNotes" (this will trigger automatic note updates)
7. Move to the next step and repeat
8. IMPORTANT: If a student answers questions from multiple steps in a single response, update multiple steps at once

CRITICAL: When one or more steps are completed, you MUST mention "updateNotes" to trigger the step completion tracking:
${generateStepCompletionData(problemData.steps)}

Visual Feedback Instructions:
- Before asking questions for a step, mention "showVisualFeedback" to show the BeforeQuestion illustration
- When student gives correct answer, mention "showVisualFeedback success" to show success feedback
- When student gives incorrect answer, mention "showVisualFeedback hint" to show hint feedback, then verbally provide the hint content and wait for a second attempt

Tool Calling Instructions:
- Mention "updateNotes" immediately after completing questions for one or more steps
- Do this seamlessly without explicitly announcing it to the student
- This is MANDATORY for each completed step

DO NOT explicitly mention updating notes, taking notes, or any reference to the tools in your conversation with the student. Simply mention the trigger words and the system will handle the functionality.

Example Interaction for Incorrect Answer:
1. You: "What's inside the innermost parentheses?"
2. Student: "3 times 1" (incorrect answer)
3. You: "showVisualFeedback hint" [system shows hint visual]
4. You: "That's not quite right. Let's look closer at the expression (3 + 1). The operation between 3 and 1 is addition, not multiplication."
5. Student: "Oh, it's 3 plus 1" (correct on second try)
6. You: "That's right!"

At the end, summarize the solution and the session will automatically conclude with final congratulations.`,
  systemInstructions: `You are the stepTutor agent for an AI tutoring system. Your role is to guide students through complex problem-solving step by step, providing visual feedback and tracking their progress. Use the trigger words "showVisualFeedback", "updateNotes" to activate the UI functionality seamlessly.`,
  handoffs: nextAgents,
})

// Function to set handoffs after all agents are created
const setStepTutorHandoffs = (handoffs) => {
  stepTutorAgent.handoffs = handoffs
}

export { stepTutorAgent, setStepTutorHandoffs }
