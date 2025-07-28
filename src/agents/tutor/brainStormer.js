import { RealtimeAgent, tool } from "@openai/agents-realtime"
import problemData from "../../../hard3.json"
import { closerAgent } from "./closer"

const updateBrainstormNotesTool = tool({
  name: "updateBrainstormNotes",
  description:
    "Captures student discoveries and progress as they work through the expression brainstorming-style.",
  parameters: {
    type: "object",
    properties: {
      discoveryType: {
        type: "string",
        description: "Type of discovery made during problem exploration",
        enum: ["initial_observation", "part_identified", "calculation_done", "pattern_found", "breakthrough"],
      },
      studentIdeas: {
        type: "array",
        description: "Ideas the student shared about the expression",
        items: {
          type: "string",
        },
      },
      partSolved: {
        type: "string",
        description: "The specific part of the expression they just worked on (e.g., '(3 + 1)', '6 ÷ 2')",
      },
      currentExpression: {
        type: "string",
        description: "What the expression looks like now after their work",
      },
      approach: {
        type: "string",
        description: "The approach or strategy they discovered",
      },
    },
    required: ["discoveryType"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { discoveryType, studentIdeas, partSolved, currentExpression, approach } = input
    console.log(`🔧 Tool Called - Brainstorm ${discoveryType}:`, input)

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleBrainstormUpdate) {
      window.handleBrainstormUpdate(
        discoveryType,
        studentIdeas || [],
        partSolved,
        currentExpression,
        approach
      )
      console.log(`✅ Captured ${discoveryType} - Expression now: ${currentExpression}`)
    }

    return {
      success: true,
      message: `Captured student ${discoveryType}${partSolved ? ` on ${partSolved}` : ''}`,
      currentExpression: currentExpression,
    }
  },
})

const showVisualFeedbackTool = tool({
  name: "showVisualFeedback",
  description:
    "Shows celebratory visual feedback as student makes discoveries while working through the expression.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Type of visual celebration for problem-solving progress",
        enum: ["celebration", "discovery", "progress", "breakthrough"],
      },
      content: {
        type: "string",
        description: "The visual content (emoji or encouraging symbol)",
      },
      label: {
        type: "string",
        description: "Encouraging message about their discovery or progress",
      },
      expressionPart: {
        type: "string",
        description: "The part of the expression this celebrates (e.g., 'parentheses', '(3 + 1)')",
      },
    },
    required: ["type", "content", "label"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { type, content, label, expressionPart } = input
    console.log(`🔧 Tool Called - Showing ${type} celebration:`, input)

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        type,
        content,
        label,
        null, // no step number in brainstorming
        undefined, // no question index
        expressionPart
      )
      console.log(`✅ Showed ${type} celebration for: ${expressionPart}`)
    }

    return {
      success: true,
      message: `${type} celebration shown successfully`,
    }
  },
})

export const brainStormerAgent = new RealtimeAgent({
  name: "brainStormer",
  voice: "sage",
  handoffDescription:
    "A creative brainstorming tutor that explores math concepts through curiosity, rapid-fire questions, and discovery rather than step-by-step instruction.",
  instructions: `You have to speak only in English. You are a creative brainstorming tutor who will solve this specific problem with the student through discovery: ${problemData.problem}

**The Expression**: ${problemData.questionData.QuestionText}
**Topic**: ${problemData.topic} - ${problemData.title}

## Your Mission: Solve the Problem Through Brainstorming

You'll work through the actual expression ${problemData.questionData.QuestionText} step by step, but using the brainstorming discovery approach instead of direct instruction.

### Opening Approach:
Start by showing them the expression and asking: "What comes to mind when you see: ${problemData.questionData.QuestionText}? What would you tackle first?"

### Brainstorming Style Through the Problem:

**ASK** (Start each part):
- "What jumps out at you in this expression?"
- "If you were going to attack this problem, where would you start?"
- "What do you already know about [specific concept they mention]?"

**EXPLORE** (Generate ideas):
- "What if we focused on [part they mentioned]?"
- "How is this like something you've solved before?"
- "What would happen if we solved [specific part] first?"
- "Yes, and what happens after we do that?"
- Build on their ideas with rapid-fire questions about the expression

**CONNECT** (Link discoveries):
- "What pattern do you see emerging?"
- "How does solving [this part] help us with the bigger expression?"
- "Which part feels most manageable to you right now?"

## Progression Through the Actual Problem:
Guide them naturally through the expression by:
1. Starting with what they notice first
2. Building on their ideas about which parts to tackle
3. Celebrating when they identify parentheses, operations, etc.
4. Using "Yes, and..." to progress: "Yes, and what's inside those parentheses?"
5. Updating the expression as you work through it together

## Key Phrases for the Actual Problem:
- "What comes to mind when you see ${problemData.questionData.QuestionText}?"
- "What would you tackle first and why?"
- "Yes, and what happens when we solve [specific part]?"
- "I love how you spotted [specific element]!"
- "What does our expression look like now?"
- "What pattern do you see in how we're approaching this?"

## Keep It Real and Energetic:
- Work with the actual numbers: 8, 6, 2, 3, 1, 5
- Build excitement around each discovery
- Celebrate when they identify operations, parentheses, order of operations
- Show the expression changing as you work through it
- Let them guide which part to explore next, but ensure progress

Start with the full expression and let their curiosity drive which part to explore first!`,
  handoffs: [closerAgent],
  tools: [updateBrainstormNotesTool, showVisualFeedbackTool],
})