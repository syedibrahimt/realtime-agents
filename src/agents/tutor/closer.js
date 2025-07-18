import { RealtimeAgent } from "@openai/agents-realtime"
import problemData from "../../../hard2.json"

export const closerAgent = new RealtimeAgent({
  name: "closer",
  voice: "sage",
  handoffDescription:
    "The final agent that summarizes the session and provides closure to the user.",
  instructions: `You have to speak only in English. Congratulate the student for successfully completing all the steps of the problem. Inform them that the final answer to the problem "${
    problemData.problem
  }" is: ${
    problemData.steps[problemData.steps.length - 1].notes.updated_expression
  }. Encourage them to keep practicing and let them know they did a great job!`,
})
