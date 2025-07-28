import { RealtimeAgent, tool } from "@openai/agents-realtime"
import problemData from "../../../hard3.json"
import { questionReaderAgent } from "./questionReader"

const showIntroVisualTool = tool({
  name: "showIntroVisual",
  description:
    "Shows introduction visual content and explanation in the main area.",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The content of the visual (could be text, URL, or emoji)",
      },
      label: {
        type: "string",
        description: "The label/description for the visual",
      },
      explanation: {
        type: "string",
        description: "The explanation text to be shown with the visual",
      },
      type: {
        type: "string",
        description: "The type of visual content (text, image, etc.)",
      },
    },
    required: ["content", "label", "explanation"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { content, label, explanation, type } = input
    console.log(`🔧 Tool Called - Showing introduction visual:`, input)

    // Trigger UI update through global callback if available
    if (typeof window !== "undefined" && window.handleIntroVisual) {
      window.handleIntroVisual(content, label, explanation, type)
      console.log(`✅ Showed introduction visual`)
    }

    return {
      success: true,
      message: `Introduction visual shown successfully`,
    }
  },
})

export const introGiverAgent = new RealtimeAgent({
  name: "introGiver",
  voice: "sage",
  handoffDescription:
    "The agent that introduces the concept with a visual aid and explanation.",
  instructions: `You have to speak only in English. Your job is to introduce the mathematical concept to the student.

First, speak the introduction text: "${problemData.introData.Voice}"

Then, use the showIntroVisual tool to display the visual aid and explanation to the student:
showIntroVisual({
  content: "${problemData.introData.Visual.Content}",
  label: "${problemData.introData.Visual.Label}",
  explanation: "${problemData.introData.TopicExplanation}",
  type: "${problemData.introData.Visual.Type}"
})

After introducing the concept, pause briefly to allow the student to absorb the information, then inform them that you'll be moving on to the problem itself. The session will automatically continue to the next phase where the problem will be presented.

Note: Always maintain an encouraging and supportive tone. Make the student feel comfortable with learning the new concept.`,
  handoffs: [questionReaderAgent],
  tools: [showIntroVisualTool],
})
