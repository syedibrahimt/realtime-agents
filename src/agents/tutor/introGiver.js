import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard3.json"

// Note: handoffs will be set after all agents are created to avoid circular dependencies
let nextAgents = []

class IntroGiverAgent extends GeminiAgent {
  constructor(config) {
    super(config)
  }

  /**
   * Process incoming messages and handle tool calls
   */
  processMessage(data) {
    super.processMessage(data)
    
    // Check if we need to show visual content
    if (this.isActive && data.serverContent?.modelTurn) {
      const parts = data.serverContent.modelTurn.parts
      
      parts.forEach(part => {
        if (part.text && part.text.includes('showIntroVisual')) {
          // Extract visual content from the response and trigger UI
          this.showIntroVisual()
        }
      })
    }
  }

  /**
   * Show introduction visual to the student
   */
  showIntroVisual() {
    console.log(`🔧 IntroGiver Agent - Showing introduction visual`)

    // Use the problem data to show the visual
    const { Visual, TopicExplanation } = problemData.introData

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleIntroVisual) {
      window.handleIntroVisual(
        Visual.Content,
        Visual.Label,
        TopicExplanation,
        Visual.Type
      )
      console.log(`✅ Showed introduction visual`)
    }
  }

  /**
   * Override activation to include tool setup
   */
  async activate(session) {
    await super.activate(session)
    
    // Send specific instructions including the tool usage
    const extendedInstructions = `${this.instructions}

After you speak the introduction, you should call showIntroVisual to display the visual content. Simply mention "showIntroVisual" in your response and the system will automatically display the visual aid.`

    await this.sendPrompt(extendedInstructions)
  }
}

const introGiverAgent = new IntroGiverAgent({
  name: "introGiver",
  voice: "Kore",
  handoffDescription:
    "The agent that introduces the concept with a visual aid and explanation.",
  instructions: `You have to speak only in English. Your job is to introduce the mathematical concept to the student.

First, speak the introduction text: "${problemData.introData.Voice}"

Then, mention that you will show a visual aid to help explain the concept. Say "showIntroVisual" to trigger the visual display.

After introducing the concept, pause briefly to allow the student to absorb the information, then inform them that you'll be moving on to the problem itself. The session will automatically continue to the next phase where the problem will be presented.

Note: Always maintain an encouraging and supportive tone. Make the student feel comfortable with learning the new concept.`,
  systemInstructions: `You are the introGiver agent for an AI tutoring system. Your role is to introduce mathematical concepts with visual aids and clear explanations. You should use encouraging language and ensure students understand the concept before moving forward.`,
  handoffs: nextAgents,
})

// Function to set handoffs after all agents are created
const setIntroGiverHandoffs = (handoffs) => {
  introGiverAgent.handoffs = handoffs
}

export { introGiverAgent, setIntroGiverHandoffs }
