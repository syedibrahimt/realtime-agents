# Backpack Application

### we have 3 applications

- **Editor** - Where teacher/content creator creates & publish the lesson unit. Each lesson unit have several activities. Each activity have many slides/pages/canvases. Some will have text based introduction/ reading material, some will have the input components like text input boxes, Multiple choice questions, Multiple Answer questions, Fill in the blanks etc. Smart tutor is one of the slides which comes inbetween the activity. Smart tutor is AI based realtime tutoring activity. We use AI (gpt 4.1) to generate tutoring content like the problem, options, solution steps etc. We then use this data with OpenAI's Realtime API to tutor the student. Whatever content we created here will be stored in the Database.

- **Admin** - Where the Content Admin/ teacher goes and publishes the Lesson units to the students based on the classes.

- **Backpack** - Where the student goes and attends the activities/lesson units. As i said the lesson unit may contain both learning material or test material. The Smart tutoring feature is going to play a major role here. Whatever the generated content from the editor will be feed into the Open AI's realtime API model and the step by step tutoring is handled by the AI. Programmatically we're using '@openai/agents-realtime' package in reactjs to implement this. Internally we are creating Multi-Agent Architecture to achieve this.
  Step-by-Step Learning: The tutor breaks down math problems into conceptual steps, asking questions to guide understanding rather than just providing answers.

In UI we have The notes area automatically updates to show progress through each step of the problem.

## Agents List

1. Greeter Agent
2. Question Reader Agent
3. Step by step Tutoring Agent
4. Closer Agent

The data structure is going to change. From hard1.json to hard2.json.
i have added hint & success.
Success should be shown when the student gives correct answer for that conceptual question.
Hint should be shown when the student gives incorrect answer to the conceptual question.
Both should be added as visual feedbacks in the main area. (not in notes area)
Before the ai asks the question the illustration.content should be added as visual representation
We have already written tool for updating notes, similarly achieve this functionality by using tool calling approach. Make the UI look good and align closely with the current UI. I have attached the current UI screenshot
