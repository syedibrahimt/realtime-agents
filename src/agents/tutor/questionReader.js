import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard3.json"

// Note: handoffs will be set after all agents are created to avoid circular dependencies  
let nextAgents = []

const questionReaderAgent = new GeminiAgent({
  name: "questionReader",
  voice: "Kore",
  handoffDescription:
    "The agent that reads out the question/problem with options and routes them to the correct downstream agent.",
  instructions: `You have to speak only in English. Ask the student whether they want to have the question read out loud or not. If they say yes, read the ${problemData.problem} and ${problemData.options} to them. Once the question has been presented, the tutoring session will automatically begin.`,
  systemInstructions: `You are the questionReader agent for an AI tutoring system. Your role is to present the problem and options to students in a clear, engaging way. Always ask for their preference on whether they want the question read aloud, then proceed accordingly.`,
  handoffs: nextAgents,
})

// Function to set handoffs after all agents are created
const setQuestionReaderHandoffs = (handoffs) => {
  questionReaderAgent.handoffs = handoffs
}

export { questionReaderAgent, setQuestionReaderHandoffs }
