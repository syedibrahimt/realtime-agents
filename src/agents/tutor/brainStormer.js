import { RealtimeAgent, tool } from "@openai/agents/realtime"
import problemData from "../../../hard4.json"
import { closerAgent } from "./closer"

const updateStepIndexTool = tool({
  name: "updateStepIndex",
  description:
    "Updates the current step index to display notes one by one as the student progresses through conceptual questions.",
  parameters: {
    type: "object",
    properties: {
      stepIndex: {
        type: "number",
        description:
          "The step index to display (0-based, allows up to 10 steps)",
        minimum: 0,
        maximum: 9,
      },
      action: {
        type: "string",
        description: "The action being performed",
        enum: ["start_step", "complete_step"],
      },
    },
    required: ["stepIndex", "action"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { stepIndex, action } = input
    console.log(`🔧 Tool Called - Update Step Index:`, input)

    if (typeof window !== "undefined" && window.handleUpdateStepIndex) {
      window.handleUpdateStepIndex(stepIndex, action)
      console.log(`✅ Updated step index to ${stepIndex} (${action})`)
    }

    return {
      success: true,
      message: `Step index updated to ${stepIndex}`,
      stepIndex: stepIndex,
    }
  },
})

const showVisualFeedbackTool = tool({
  name: "showVisualFeedback",
  description:
    "Shows visual feedback from hard4.json ConceptualQuestions structure. Use 'before' type when starting a question, 'hint' when student needs guidance, 'success' when student answers correctly.",
  parameters: {
    type: "object",
    properties: {
      stepIndex: {
        type: "number",
        description: "The step index (0-based, allows up to 10 steps)",
        minimum: 0,
        maximum: 9,
      },
      questionIndex: {
        type: "number",
        description:
          "The question index within the step's ConceptualQuestions array (0-based, typically 0-1 as most steps have 2 questions)",
        minimum: 0,
        maximum: 1,
      },
      feedbackType: {
        type: "string",
        description: "Type of feedback to show",
        enum: ["before", "hint", "success"],
      },
    },
    required: ["stepIndex", "questionIndex", "feedbackType"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { stepIndex, questionIndex, feedbackType } = input
    console.log(`🔧 Tool Called - Show Visual Feedback:`, input)

    // Access hard4.json data
    const step = problemData.steps[stepIndex]
    if (!step || !step.ConceptualQuestions[questionIndex]) {
      console.error(`Invalid step or question index`)
      return {
        success: false,
        message: "Invalid step or question index",
      }
    }

    const question = step.ConceptualQuestions[questionIndex]
    let feedbackData

    // Get the appropriate feedback based on type
    if (feedbackType === "before") {
      feedbackData = question.Illustration.BeforeQuestion
    } else if (feedbackType === "hint") {
      feedbackData = question.Illustration.Feedback.Hint
    } else if (feedbackType === "success") {
      feedbackData = question.Illustration.Feedback.Success
    }

    if (!feedbackData) {
      console.error(`No feedback data found for type: ${feedbackType}`)
      return {
        success: false,
        message: "No feedback data found",
      }
    }

    // Call the global handler with the structured data
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        feedbackType, // type: 'before', 'hint', or 'success'
        feedbackData.Content,
        feedbackData.Label,
        stepIndex,
        questionIndex
      )
      console.log(
        `✅ Showed ${feedbackType} feedback for step ${stepIndex}, question ${questionIndex}`
      )
    }

    return {
      success: true,
      message: `${feedbackType} feedback shown successfully`,
      stepIndex,
      questionIndex,
    }
  },
})

const showQuestionWithOptionsTool = tool({
  name: "showQuestionWithOptions",
  description:
    "Displays the main problem question with all multiple choice options at the session start. After calling this tool, YOU MUST read the question and all options aloud to the student. Call this once after greeting, before starting the ASK phase.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: async () => {
    console.log(`🔧 Tool Called - Show Question with Options`)

    const questionText = problemData.questionData.QuestionText
    const options = problemData.questionData.Options.map(
      (opt, i) => `${String.fromCharCode(65 + i)}) ${opt.Option}`
    ).join("\n")

    const displayContent = `${questionText}\n\n${options}`

    // Call the global handler with the structured data
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        "question", // type: 'question'
        displayContent,
        "Main Problem",
        null,
        null
      )
      console.log(`✅ Showed question with all options`)
    }

    // Prepare the text that should be read aloud
    const readAloudText = `${questionText}\n\nThe options are:\n${problemData.questionData.Options.map(
      (opt, i) => `${String.fromCharCode(65 + i)}: ${opt.Option}`
    ).join("\n")}`

    return {
      success: true,
      message: "Question with options displayed successfully",
      readAloud: readAloudText,
      instruction:
        "Now read the question and all options aloud to the student, then ask for their first thought.",
    }
  },
})

export const brainStormerAgent = new RealtimeAgent({
  name: "brainStormer",
  voice: "sage",
  handoffDescription:
    "A natural brainstorming tutor that guides students through discovery using the ASK → EXPLORE → CONNECT framework.",
  instructions: `You are a brainstorming tutor using the ASK → EXPLORE → CONNECT framework. Speak only in English.

**Topic**: ${problemData.topic} - ${problemData.title}

## SESSION START
1. Greet warmly: "Hi Welcome to this tutoring session. Let's go through this together!"
2. **IMPORTANT**: Read the full question and ALL four options (A, B, C, D) aloud clearly by Calling showQuestionWithOptions tool
3. Ask: "What's your first thought about this?"

## LEARNING JOURNEY: Work Through All Steps

${problemData.steps
  .map(
    (step, idx) => `
**Step ${idx}: ${step.Topic}**
${step.Description}
${step.ConceptualQuestions.map(
  (cq, qIdx) => `
  Q${qIdx + 1}: "${cq.Question}" (Goal: ${cq.Goal})
  → Show: showVisualFeedback(${idx}, ${qIdx}, "before") - "${cq.Illustration.BeforeQuestion.Content}"
  → If struggling: feedbackType="hint" - "${cq.Illustration.Feedback.Hint.Content}"
  → When correct: feedbackType="success" - "${cq.Illustration.Feedback.Success.Content}"`
).join("")}

Build toward: ${step.Notes.UpdatedExpression}
After both questions: updateStepIndex(${idx}, "complete_step")
`
  )
  .join("")}

## CONVERSATION STYLE
- Discovery questions: "What if...?", "How does this connect...?", "What pattern do you see?"
- Build on responses: "Yes, and...", "Ooh, that's one way!", "You're onto something!"
- Natural transitions: "Building on that...", "Let's explore further..."
- Never say "step" - keep it conversational

## KEY REMINDERS
- For EACH question: Show "before" visual → Ask question → Give "hint" or "success" feedback
- Complete step only after BOTH questions answered
- Celebrate thinking process, not just correct answers
- Make it feel like discovery, not a lesson`,
  // handoffs: [closerAgent],
  tools: [
    updateStepIndexTool,
    showVisualFeedbackTool,
    showQuestionWithOptionsTool,
  ],
})
