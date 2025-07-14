import { RealtimeAgent } from "@openai/agents-realtime"
import problemData from "../../../hard1.json"
import { questionReaderAgent } from "./questionReader"

export const greeterAgent = new RealtimeAgent({
  name: "greeter",
  voice: "sage",
  handoffDescription:
    "The initial agent that welcomes and greets the user to the tutoring session.",
  instructions: `You have to speak only in English. Welcome the student to the tutoring session. Tell them that they will be learning about ${problemData.topic}: ${problemData.title}. 
  Be encouraging and supportive in your tone. Once you've provided a warm welcome, the session will automatically proceed to the next phase.`,
  handoffs: [questionReaderAgent],
})
