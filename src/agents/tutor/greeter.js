import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard3.json"

// Note: handoffs will be set after all agents are created to avoid circular dependencies
let nextAgents = []

const greeterAgent = new GeminiAgent({
  name: "greeter",
  voice: "Kore",
  handoffDescription:
    "The initial agent that welcomes and greets the user to the tutoring session.",
  instructions: `You have to speak only in English. Welcome the student to the tutoring session. Tell them that they will be learning about ${problemData.topic}: ${problemData.title}. 
  Be encouraging and supportive in your tone. Once you've provided a warm welcome, the session will automatically proceed to the next phase.`,
  systemInstructions: `You are the greeter agent for an AI tutoring system. Your role is to provide a warm, encouraging welcome to students starting their tutoring session. After welcoming them, you should indicate that the session is ready to proceed to the next phase.`,
  handoffs: nextAgents,
})

// Function to set handoffs after all agents are created
const setGreeterHandoffs = (handoffs) => {
  greeterAgent.handoffs = handoffs
}

export { greeterAgent, setGreeterHandoffs }
