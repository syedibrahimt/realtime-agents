import { RealtimeAgent, tool } from "@openai/agents-realtime"
import problemData from "../../../hard4.json"
import { closerAgent } from "./closer"

const updateBrainstormNotesTool = tool({
  name: "updateBrainstormNotes",
  description:
    "Captures student discoveries, ideas, and progress through brainstorming and debate.",
  parameters: {
    type: "object",
    properties: {
      discoveryType: {
        type: "string",
        description: "Type of discovery or interaction made",
        enum: [
          "initial_observation",
          "part_identified",
          "calculation_done",
          "pattern_found",
          "breakthrough",
          "debate_point",
          "approach_comparison",
          "synthesis",
        ],
      },
      studentIdeas: {
        type: "array",
        description: "Ideas and thoughts the student shared",
        items: {
          type: "string",
        },
      },
      debateElements: {
        type: "object",
        description:
          "Debate elements if this discovery involved comparing approaches",
        properties: {
          approach1: {
            type: "string",
            description: "First approach or perspective discussed",
          },
          approach2: {
            type: "string",
            description: "Second approach or perspective discussed",
          },
          studentPreference: {
            type: "string",
            description: "Which approach the student prefers and why",
          },
          synthesis: {
            type: "string",
            description: "How the approaches were combined or resolved",
          },
        },
      },
      partSolved: {
        type: "string",
        description: "The specific part of the problem they just worked on",
      },
      currentExpression: {
        type: "string",
        description: "Current state of the problem/expression/understanding",
      },
      approach: {
        type: "string",
        description: "The approach or strategy discovered/used",
      },
      stepNumber: {
        type: "number",
        description:
          "Which step in the JSON structure this relates to (1-based)",
      },
    },
    required: ["discoveryType", "stepNumber"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const {
      discoveryType,
      studentIdeas,
      debateElements,
      partSolved,
      currentExpression,
      approach,
      stepNumber,
    } = input
    console.log(`🔧 Tool Called - Brainstorm ${discoveryType}:`, input)

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleBrainstormUpdate) {
      window.handleBrainstormUpdate(
        discoveryType,
        studentIdeas || [],
        partSolved,
        currentExpression,
        approach,
        stepNumber,
        debateElements
      )
      console.log(`✅ Captured ${discoveryType} for step ${stepNumber}`)
    }

    return {
      success: true,
      message: `Captured student ${discoveryType}${
        partSolved ? ` on ${partSolved}` : ""
      }`,
      currentExpression: currentExpression,
      stepNumber: stepNumber,
    }
  },
})

const showVisualFeedbackTool = tool({
  name: "showVisualFeedback",
  description:
    "Shows visual feedback for discoveries, debates, and breakthroughs during brainstorming.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Type of visual feedback",
        enum: [
          "celebration",
          "discovery",
          "progress",
          "breakthrough",
          "debate",
          "comparison",
          "synthesis",
        ],
      },
      content: {
        type: "string",
        description: "The visual content (emoji, symbol, or text)",
      },
      label: {
        type: "string",
        description: "Message about the discovery or insight",
      },
      expressionPart: {
        type: "string",
        description: "The part of the problem this relates to",
      },
      stepNumber: {
        type: "number",
        description: "Which step this feedback relates to",
      },
    },
    required: ["type", "content", "label"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { type, content, label, expressionPart, stepNumber } = input
    console.log(`🔧 Tool Called - Showing ${type} feedback:`, input)

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        type,
        content,
        label,
        stepNumber,
        undefined,
        expressionPart
      )
      console.log(`✅ Showed ${type} feedback for step ${stepNumber}`)
    }

    return {
      success: true,
      message: `${type} feedback shown successfully`,
    }
  },
})

export const brainStormerAgent = new RealtimeAgent({
  name: "brainStormer",
  voice: "sage",
  handoffDescription:
    "A natural brainstorming tutor that guides students through discovery using the ASK → EXPLORE → CONNECT framework.",
  instructions: `You have to speak only in English. You are a natural brainstorming tutor who guides students through discovery using a proven framework.

**Problem**: ${problemData.questionData.QuestionText}
**Topic**: ${problemData.topic} - ${problemData.title}

## Your Natural Teaching Flow: ASK → EXPLORE → CONNECT

You follow a natural conversation pattern that feels organic, never mechanical:

### PHASE 1: ASK (Problem Introduction & Setup) 
**Start by reading the problem statement clearly:**
1. Read the full problem: "${problemData.questionData.QuestionText}"
2. Ask: "What do you already know about this topic?"
3. Listen to 2-3 initial thoughts without judgment
4. Build excitement: "Let's explore this together!"

### PHASE 2: EXPLORE (Guided Discovery Through Ideas)
Work through the learning areas naturally, using rapid-fire discovery questions:

${problemData.steps
  .map(
    (step) => `
**Topic Area: ${step.Topic}**
- Discovery Focus: ${step.Description}
- Key Question: "${step.ConceptualQuestions[0].Question}"
- Show illustration: "${step.ConceptualQuestions[0].Illustration.BeforeQuestion.Content}"
- Explore with: "What if we tried...?", "How is this like something you know?", "What would happen if...?"
- Build toward understanding: ${step.Notes.UpdatedExpression}
`
  )
  .join("")}

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

### Natural Transitions (Never say "step"):
- "Now that we've discovered X, what about Y?"
- "That gives me another idea to explore..."
- "Building on that thought..."
- "Let's take this further..."

## When Multiple Approaches Emerge:
- "Hmm, there are different ways we could think about this..."
- "Some people might say X, while others think Y... what do you think?"
- "Let's compare these ideas and see what happens!"
- Use showVisualFeedback with type="debate" or "comparison"

## Tool Usage Guidelines

### updateBrainstormNotes:
- Use for every significant discovery
- Track the natural progression of understanding
- Include debateElements when comparing approaches
- Always specify the current stepNumber (1-${problemData.steps.length})

### showVisualFeedback:
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

## Conversation Boundaries:
- Work through all learning areas naturally
- Allow 3-5 exchanges per topic area
- Keep energy high and momentum building
- End with synthesis and clear sense of discovery
- Prepare for handoff to closer agent

Remember: This should feel like an exciting conversation with a curious friend who happens to know how to guide discovery. Never mention "steps" or make it feel like a curriculum. Let their natural curiosity drive the exploration!`,
  handoffs: [closerAgent],
  tools: [updateBrainstormNotesTool, showVisualFeedbackTool],
})
