import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard4.json"

// Note: handoffs will be set after all agents are created to avoid circular dependencies
let nextAgents = []

class BrainStormerAgent extends GeminiAgent {
  constructor(config) {
    super(config)
    this.currentStep = 1
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
          if (part.text.includes('updateBrainstormNotes')) {
            this.handleUpdateBrainstormNotes(part.text)
          }
          if (part.text.includes('showVisualFeedback')) {
            this.handleShowVisualFeedback(part.text)
          }
        }
      })
    }
  }

  /**
   * Handle brainstorm notes update functionality
   */
  handleUpdateBrainstormNotes(text) {
    console.log(`🔧 BrainStormer Agent - Updating brainstorm notes`)

    // For now, we'll use basic discovery tracking
    const discoveryType = this.extractDiscoveryType(text)
    const stepNumber = this.currentStep

    // Trigger UI update through global callback if available  
    if (typeof window !== "undefined" && window.handleBrainstormUpdate) {
      window.handleBrainstormUpdate(
        discoveryType,
        [],
        "current problem part",
        "current understanding",
        "brainstorming approach",
        stepNumber,
        null
      )
      console.log(`✅ Captured ${discoveryType} for step ${stepNumber}`)
    }
  }

  /**
   * Handle visual feedback for brainstorming
   */
  handleShowVisualFeedback(text) {
    console.log(`🔧 BrainStormer Agent - Showing visual feedback`)

    // Extract feedback type from context
    let type = "discovery"
    let content = "💡"
    let label = "Great thinking!"

    if (text.includes('celebration')) {
      type = "celebration"
      content = "🎉"
      label = "Excellent discovery!"
    } else if (text.includes('breakthrough')) {
      type = "breakthrough"
      content = "⚡"
      label = "Breakthrough moment!"
    } else if (text.includes('debate')) {
      type = "debate"
      content = "⚖️"
      label = "Comparing approaches..."
    } else if (text.includes('synthesis')) {
      type = "synthesis"
      content = "🔗"
      label = "Connecting ideas..."
    }

    const stepNumber = this.currentStep

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      window.handleVisualFeedback(
        type,
        content,
        label,
        stepNumber,
        undefined,
        "current problem part"
      )
      console.log(`✅ Showed ${type} feedback for step ${stepNumber}`)
    }
  }

  /**
   * Extract discovery type from text context
   */
  extractDiscoveryType(text) {
    const types = [
      "initial_observation",
      "part_identified", 
      "calculation_done",
      "pattern_found",
      "breakthrough",
      "debate_point",
      "approach_comparison",
      "synthesis"
    ]

    for (const type of types) {
      if (text.includes(type.replace('_', ' '))) {
        return type
      }
    }

    return "initial_observation"
  }

  /**
   * Override activation to reset step tracking
   */
  async activate(session) {
    await super.activate(session)
    this.currentStep = 1
  }
}

const brainStormerAgent = new BrainStormerAgent({
  name: "brainStormer",
  voice: "Kore",
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

## Tool Usage Guidelines

### updateBrainstormNotes:
- Mention "updateBrainstormNotes" for every significant discovery
- Track the natural progression of understanding
- Always specify the current learning area (1-${problemData.steps.length})

### showVisualFeedback:
- Mention "showVisualFeedback discovery" for initial observations and aha moments
- Mention "showVisualFeedback debate" when naturally comparing different approaches  
- Mention "showVisualFeedback breakthrough" for major insights and connections
- Mention "showVisualFeedback synthesis" when connecting multiple ideas together

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

Remember: This should feel like an exciting conversation with a curious friend who happens to know how to guide discovery. Use the trigger phrases seamlessly to activate the UI functionality without explicitly mentioning tools.`,
  systemInstructions: `You are the brainStormer agent for an AI tutoring system. Your role is to facilitate natural discovery learning through the ASK → EXPLORE → CONNECT framework. Use trigger phrases like "updateBrainstormNotes", "showVisualFeedback" to activate UI functionality seamlessly.`,
  handoffs: nextAgents,
})

// Function to set handoffs after all agents are created
const setBrainStormerHandoffs = (handoffs) => {
  brainStormerAgent.handoffs = handoffs
}

export { brainStormerAgent, setBrainStormerHandoffs }
