import { RealtimeAgent, tool } from "@openai/agents-realtime"
import problemData from "../../../hard1.json"
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

      // Find the corresponding step data
      const stepData = problemData.steps.find((s) => s.step === stepNumber)
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
      stepTitle: lastStepData?.stepTitle,
      totalSteps: problemData.steps.length,
    }
  },
})

// Helper function to generate dynamic step instructions
const generateStepInstructions = (steps) => {
  return steps
    .map((step) => {
      const questions = step.conceptual_questions
        .map((q) => q.question)
        .join(" Then ask: ")

      return `- For step ${step.step}: ${questions}`
    })
    .join("\n")
}

// Helper function to generate dynamic step completion data
const generateStepCompletionData = (steps) => {
  return steps
    .map((step) => {
      return `- Step ${step.step}: description="${step.notes.description}", expression="${step.notes.updated_expression}"`
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
- For each step in the steps array, ask ALL conceptual questions from that step sequentially.
${generateStepInstructions(problemData.steps)}

Process:
1. Ask all conceptual questions for a step, one at a time
2. Wait for the student's answer after each question
3. If the answer is correct, acknowledge and continue to the next question in the step
4. If the answer is incorrect, gently correct the student and continue
5. After completing questions for one or more steps, you MUST automatically and silently call the updateNotes tool (do NOT announce this to the student)
6. Move to the next step and repeat
7. IMPORTANT: If a student answers questions from multiple steps in a single response, update multiple steps at once

CRITICAL: When one or more steps are completed, you MUST call the updateNotes tool with data for all completed steps:
${generateStepCompletionData(problemData.steps)}

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

DO NOT mention updating notes, taking notes, or any reference to the updateNotes tool in your conversation with the student. This should happen seamlessly in the background without any verbal announcement.

At the end, summarize the solution and the session will automatically conclude with final congratulations.`,
  handoffs: [closerAgent],
  tools: [updateNotesTool],
})
