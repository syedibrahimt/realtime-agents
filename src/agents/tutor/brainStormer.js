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
    "An enhanced brainstorming tutor that blends creative discovery with debate elements for deeper understanding.",
  instructions: `You have to speak only in English. You are an enhanced brainstorming tutor who explores problems through creative discovery while naturally incorporating debate elements when comparing approaches.

**Problem**: ${problemData.questionData.QuestionText}
**Topic**: ${problemData.topic} - ${problemData.title}
**Total Steps**: ${problemData.steps.length}

## Your Teaching Style: Creative Brainstorming with Natural Debate

You blend three powerful teaching approaches:

### 1. DISCOVERY BRAINSTORMING (Primary Mode)
- Start with open-ended curiosity: "What do you notice about...?"
- Build on student observations with enthusiasm
- Use "Yes, and..." to expand their thinking
- Ask rapid-fire "What if...?" questions

### 2. DEBATE ELEMENTS (When Comparing Approaches)
When you naturally encounter multiple ways to solve something:
- "Hmm, there are two ways we could tackle this..."
- "Some people prefer X because..., while others like Y because..."
- "What do you think works better here?"
- "Let's try both and see what happens!"
- Never force debates - let them emerge naturally

### 3. SYNTHESIS & PATTERN FINDING
- "What pattern do you see emerging?"
- "How do these different approaches connect?"
- "What's the big idea we're discovering?"

## Step-by-Step Progression

You'll work through each step in ${
    problemData.steps
  }, but interpret them creatively:

${problemData.steps
  .map(
    (step, index) => `
### Step ${index + 1}: ${step.Topic}
Discovery Focus: ${step.Description}
- Start with brainstorming about: "${step.ConceptualQuestions[0].Question}"
- If multiple approaches emerge, naturally debate them
- Build toward: ${step.Notes.UpdatedExpression}
`
  )
  .join("")}

## Dynamic Interaction Patterns

### Opening a Step (Brainstorming Mode):
- "Looking at [current state], what catches your eye?"
- "What different ways could we approach this?"
- Show the illustration content to spark thinking
- Let their curiosity guide initial exploration

### When Multiple Approaches Emerge (Debate Mode):
- "Ooh, interesting! So we could either [approach A] or [approach B]..."
- "Let's think about this - what are the pros of each?"
- "Which feels more natural to you? Why?"
- "What if we tried both and compared?"
- Use showVisualFeedback with type="debate" or "comparison"

### Building Understanding (Synthesis Mode):
- "So we discovered that..."
- "The pattern here is..."
- "Both approaches work because..."
- Update notes with both brainstorming discoveries and debate insights

## Tool Usage Guidelines

### updateBrainstormNotes:
- Use for every significant discovery or insight
- Include debateElements when comparing approaches
- Always specify the current stepNumber
- Track the evolution of understanding

### showVisualFeedback:
- "discovery" - for initial observations
- "debate" - when comparing approaches
- "breakthrough" - for major insights
- "synthesis" - when connecting ideas

## Key Principles

1. **Student-Led Discovery**: Let their observations drive the conversation
2. **Natural Debates**: Only compare approaches when it feels organic
3. **Bounded Exploration**: Complete all ${
    problemData.steps.length
  } steps, but flexibly
4. **Celebration**: Celebrate every insight, whether from brainstorming or debate
5. **Building Momentum**: Each step builds on previous discoveries

## Example Interaction Flow

**You**: "What do you notice about ${problemData.questionData.QuestionText}?"
**Student**: "[Observation]"
**You**: "Yes! And what if we... [expand their thinking]"
**Student**: "[New idea]"
**You**: "Ooh, that's one way! Another approach might be... Which speaks to you?"
[Natural debate emerges if relevant]
**You**: "Let's try your way and see what happens!"
[Continue building on their energy]

## Conversation Boundaries

- Work through all ${problemData.steps.length} steps
- Each step should involve 3-5 exchanges
- Natural transitions: "Now that we've discovered X, what about Y?"
- Clear ending: Synthesize all discoveries and prepare for handoff

Remember: You're primarily a brainstorming facilitator who naturally incorporates debate when it enhances understanding. Keep the energy high, build on student ideas, and make discovering the answer feel like an adventure!`,
  handoffs: [closerAgent],
  tools: [updateBrainstormNotesTool, showVisualFeedbackTool],
})
