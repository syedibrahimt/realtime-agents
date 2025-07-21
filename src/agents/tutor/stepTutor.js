import { RealtimeAgent, tool } from "@openai/agents-realtime"
import problemData from "../../../hard3.json"
import { closerAgent } from "./closer"

const updateNotesTool = tool({
  name: "updateNotes",
  description:
    "Updates the tutoring notes when steps are completed. Can handle multiple steps at once.",
  parameters: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        description: "Array of step information objects that were completed",
        items: {
          type: "object",
          properties: {
            stepNumber: {
              type: "number",
              description: "The step number that was completed",
            },
            description: {
              type: "string",
              description: "Description of what was accomplished in this step",
            },
            updatedExpression: {
              type: "string",
              description:
                "The updated mathematical expression after this step",
            },
          },
          required: ["stepNumber", "description", "updatedExpression"],
        },
      },
    },
    required: ["steps"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { steps } = input
    console.log(`🔧 Tool Called - Updating ${steps.length} steps:`, steps)

    let lastStepData = null

    // Process each step in sequence
    for (const step of steps) {
      const { stepNumber, description, updatedExpression } = step

      // Validate step number
      if (stepNumber < 1 || stepNumber > problemData.steps.length) {
        console.error(
          `❌ Invalid step number: ${stepNumber}. Valid range: 1-${problemData.steps.length}`
        )
        continue
      }

      // Find the corresponding step data (0-indexed in the array)
      const stepData = problemData.steps[stepNumber - 1]
      if (!stepData) {
        console.error(`❌ Step data not found for step ${stepNumber}`)
        continue
      }

      // Trigger UI update through global callback if available
      if (typeof window !== "undefined" && window.handleStepCompletion) {
        window.handleStepCompletion(stepNumber, description, updatedExpression)
        console.log(`✅ Updated notes for step ${stepNumber}`)
      }

      lastStepData = stepData
    }

    return {
      success: true,
      message: `Notes updated for ${steps.length} steps`,
      stepTitle: lastStepData?.Topic,
      totalSteps: problemData.steps.length,
    }
  },
})

const showVisualFeedbackTool = tool({
  name: "showVisualFeedback",
  description:
    "Shows visual feedback in the main area based on student responses or before asking questions.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Type of visual feedback to show",
        enum: ["hint", "success", "illustration"],
      },
      content: {
        type: "string",
        description: "The content of the visual feedback (text or emoji)",
      },
      label: {
        type: "string",
        description: "The label for the visual feedback",
      },
      stepNumber: {
        type: "number",
        description: "The step number this feedback relates to",
      },
      questionIndex: {
        type: "number",
        description:
          "The index of the conceptual question this feedback relates to",
      },
    },
    required: ["type", "content", "label", "stepNumber"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { type, content, label, stepNumber, questionIndex } = input
    console.log(`🔧 Tool Called - Showing ${type} feedback:`, input)

    // Validate step number
    if (stepNumber < 1 || stepNumber > problemData.steps.length) {
      console.error(
        `❌ Invalid step number: ${stepNumber}. Valid range: 1-${problemData.steps.length}`
      )
      return { success: false, message: "Invalid step number" }
    }

    // Find the corresponding step data (0-indexed in the array)
    const stepData = problemData.steps[stepNumber - 1]
    if (!stepData) {
      console.error(`❌ Step data not found for step ${stepNumber}`)
      return { success: false, message: "Step data not found" }
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

    return {
      success: true,
      message: `${type} feedback shown successfully`,
    }
  },
})

// Helper function to generate dynamic step instructions
const generateStepInstructions = (steps) => {
  return steps
    .map((step, index) => {
      const questions = step.ConceptualQuestions
        .map((q) => q.Question)
        .join(" Then ask: ")

      return `- For step ${index + 1}: ${questions}`
    })
    .join("\n")
}

// Helper function to generate dynamic step completion data
const generateStepCompletionData = (steps) => {
  return steps
    .map((step, index) => {
      return `- Step ${index + 1}: description="${step.Notes.Description}", expression="${step.Notes.UpdatedExpression}"`
    })
    .join("\n")
}

export const stepTutorAgent = new RealtimeAgent({
  name: "stepTutor",
  voice: "sage",
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
- For each step in the steps array, first show the illustration's BeforeQuestion content using showVisualFeedbackTool, then ask ALL conceptual questions from that step sequentially.
${generateStepInstructions(problemData.steps)}

Process:
1. Before starting a step, use showVisualFeedbackTool to display the Illustration.BeforeQuestion for that step
2. Ask all conceptual questions for a step, one at a time
3. Wait for the student's answer after each question
4. If the answer is correct:
   - Use showVisualFeedbackTool to display the Illustration.Feedback.Success feedback
   - Acknowledge and continue to the next question in the step
5. If the answer is incorrect:
   - Use showVisualFeedbackTool to display the Illustration.Feedback.Hint feedback
   - Gently correct the student and continue
6. After completing questions for one or more steps, you MUST automatically and silently call the updateNotes tool (do NOT announce this to the student)
7. Move to the next step and repeat
8. IMPORTANT: If a student answers questions from multiple steps in a single response, update multiple steps at once

CRITICAL: When one or more steps are completed, you MUST call the updateNotes tool with data for all completed steps:
${generateStepCompletionData(problemData.steps)}

Visual Feedback Instructions:
- Before asking questions for a step, show the BeforeQuestion illustration:
  showVisualFeedback({ 
    type: "illustration", 
    content: "[step's Illustration.BeforeQuestion.Content]", 
    label: "[step's Illustration.BeforeQuestion.Label]", 
    stepNumber: [step number] 
  })
- When student gives correct answer, show success feedback:
  showVisualFeedback({ 
    type: "success", 
    content: "[Illustration.Feedback.Success.Content]", 
    label: "[Illustration.Feedback.Success.Label]", 
    stepNumber: [step number], 
    questionIndex: [question index] 
  })
- When student gives incorrect answer, show hint feedback:
  showVisualFeedback({ 
    type: "hint", 
    content: "[Illustration.Feedback.Hint.Content]", 
    label: "[Illustration.Feedback.Hint.Label]", 
    stepNumber: [step number], 
    questionIndex: [question index] 
  })

Tool Calling Instructions:
- Call updateNotes immediately after completing questions for one or more steps
- If multiple steps are completed in one response, include ALL completed steps in a single tool call
- Pass an array of step objects with the correct stepNumber, description, and updatedExpression
- Example for multiple steps:
  updateNotes({ steps: [
    { stepNumber: 1, description: "...", updatedExpression: "..." },
    { stepNumber: 2, description: "...", updatedExpression: "..." }
  ]})
- Example for single step:
  updateNotes({ steps: [
    { stepNumber: 1, description: "...", updatedExpression: "..." }
  ]})
- Do this silently without mentioning it to the student
- This is MANDATORY for each completed step

DO NOT mention updating notes, taking notes, or any reference to the tools in your conversation with the student. This should happen seamlessly in the background without any verbal announcement.

At the end, summarize the solution and the session will automatically conclude with final congratulations.`,
  handoffs: [closerAgent],
  tools: [updateNotesTool, showVisualFeedbackTool],
})
