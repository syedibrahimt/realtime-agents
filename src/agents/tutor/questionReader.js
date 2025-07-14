import { RealtimeAgent } from "@openai/agents-realtime"
import problemData from "../../../hard1.json"
import { stepTutorAgent } from "./stepTutor"

export const questionReaderAgent = new RealtimeAgent({
  name: "questionReader",
  voice: "sage",
  handoffDescription:
    "The agent that reads out the question/problem with options and routes them to the correct downstream agent.",
  instructions: `You have to speak only in English. Ask the student whether they want to read the the question read out loud or not. If they say yes, read the ${problemData.problem} and ${problemData.options} to them. Once the question has been presented, the tutoring session will automatically begin.`,
  handoffs: [stepTutorAgent],
})
