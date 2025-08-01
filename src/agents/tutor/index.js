import { brainStormerAgent, setBrainStormerHandoffs } from "./brainStormer"
import { closerAgent } from "./closer"
import { greeterAgent, setGreeterHandoffs } from "./greeter"
import { introGiverAgent, setIntroGiverHandoffs } from "./introGiver"
import { questionReaderAgent, setQuestionReaderHandoffs } from "./questionReader"
import { stepTutorAgent, setStepTutorHandoffs } from "./stepTutor"
import problemData from "../../../hard3.json"

// Set up agent handoffs to avoid circular dependencies
// Determine the flow based on whether concept introduction is enabled
const nextAgentsForGreeter = problemData.isConceptIntroductionEnabled
  ? [introGiverAgent] // If enabled, go to intro agent first
  : [questionReaderAgent] // If disabled, go directly to question reader

setGreeterHandoffs(nextAgentsForGreeter)
setIntroGiverHandoffs([questionReaderAgent])
setQuestionReaderHandoffs([brainStormerAgent])
setStepTutorHandoffs([closerAgent])
setBrainStormerHandoffs([closerAgent])

export const aiTutoring = {
  greeterAgent,
  introGiverAgent,
  questionReaderAgent,
  stepTutorAgent,
  brainStormerAgent,
  closerAgent,
}
