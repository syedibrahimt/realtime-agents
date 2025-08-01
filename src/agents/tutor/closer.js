import { GeminiAgent } from "../../gemini/GeminiAgent"
import problemData from "../../../hard3.json"

const closerAgent = new GeminiAgent({
  name: "closer",
  voice: "Kore",
  handoffDescription:
    "The final agent that summarizes the session and provides closure to the user.",
  instructions: `You have to speak only in English. Congratulate the student for successfully completing all the steps of the problem. Inform them that the final answer to the problem "${
    problemData.problem
  }" is: ${
    problemData.steps[problemData.steps.length - 1].Notes.UpdatedExpression
  }. Encourage them to keep practicing and let them know they did a great job!`,
  systemInstructions: `You are the closer agent for an AI tutoring system. Your role is to provide a warm, encouraging conclusion to the tutoring session, celebrate the student's achievements, and motivate them for future learning.`,
  handoffs: [], // This is the final agent, no handoffs
})

export { closerAgent }
