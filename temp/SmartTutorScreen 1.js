import { useEffect, useRef, useState } from "react"
import { Time, Minimize, PhoneFilled } from "@carbon/icons-react"
import { useRive, useStateMachineInput } from "@rive-app/react-canvas"
import TypingText from "./TypingText"
const STATE_MACHINE_NAME = "State Machine 1"
const INPUT_NAME = "Input"

function SmartTutorScreen(props) {
  const {
    videoRef,
    demo,
    Images,
    smartTutorCompData,
    getTimeSpent,
    SlideName,
  } = props
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [events, setEvents] = useState([])
  const [dataChannel, setDataChannel] = useState(null)
  const [phrase, setPhrase] = useState("")
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [audioOver, setAudioOver] = useState(false)
  const peerConnection = useRef(null)
  const audioElement = useRef(null)

  //UI variables
  const streamRef = useRef(null) // Store the stream
  const [smartTutorValiables, setSmartTutorValiables] = useState({
    isMicroPhone: false,
    isVideoOn: true,
    isHandRaised: false,
    isNoteOpen: true,
    isMeetingStarted: false,
  })
  const [isTutorStarted, setIsTutorStarted] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])

  //Animation variables
  const [value, setValue] = useState(0)
  const { rive, RiveComponent } = useRive({
    src: "https://learnpodseditornodeserver.knomadixapp.com/backpack/knomadix_ai.riv",
    autoplay: true,
    stateMachines: STATE_MACHINE_NAME,
  })
  const input = useStateMachineInput(rive, STATE_MACHINE_NAME, INPUT_NAME)

  useEffect(() => {
    if (input) {
      input.value = value
    }
  }, [input, value])

  async function startSession() {
    // Get a session token for OpenAI Realtime API
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(demo),
    }
    let tokenResponse = ""
    try {
      tokenResponse = await fetch(
        "https://learnpodseditornodeserver.knomadixapp.com/token",
        requestOptions
      )

      // if (!tokenResponse.ok) {
      //   throw new Error('Server responded with status ' + tokenResponse.status);
      // }

      // const data = await tokenResponse.json();
      // console.log('Token Response:', data);
    } catch (error) {
      console.error("Failed to fetch token:", error)
      alert(
        "Network issue or server down. Please check your connection and try again."
      )
    }

    // const tokenResponse = await fetch(
    //   "https://learnpodseditornodeserver.knomadixapp.com/token",
    //   requestOptions
    // );

    //("tokenResponse", tokenResponse);
    //const tokenResponse = await fetch("token");
    const data = await tokenResponse.json()
    const EPHEMERAL_KEY = data.client_secret.value

    // Create a peer connection
    const pc = new RTCPeerConnection()

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio")
    audioElement.current.autoplay = true
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0])

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    })
    pc.addTrack(ms.getTracks()[0])

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events")
    setDataChannel(dc)

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const baseUrl = "https://api.openai.com/v1/realtime"
    const model = "gpt-4o-realtime-preview-2024-12-17"
    // const model = 'gpt-realtime-2025-08-28'
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    })

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    }
    await pc.setRemoteDescription(answer)

    peerConnection.current = pc
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close()
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop()
      }
    })

    if (peerConnection.current) {
      peerConnection.current.close()
    }

    setIsSessionActive(false)
    setDataChannel(null)
    peerConnection.current = null
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString()
      message.event_id = message.event_id || crypto.randomUUID()

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message))

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp
      }
      setEvents((prev) => [message, ...prev])
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message
      )
    }
  }

  useEffect(() => {
    if (conversationHistory.length > 0) {
      console.log("conversationHistory", conversationHistory)
    }
  }, [conversationHistory])

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data)
        if (event.type === "session.created") {
          setIsTutorStarted(true)
        } else if (event.type === "output_audio_buffer.started") {
          setPhrase("")
          setAudioOver(false)
          setValue(-100)
        } else if (event.type === "output_audio_buffer.stopped") {
          //console.log("output_audio_buffer.stopped", event.response.output);
          setAudioOver(true)
          // setValue(0);
          setValue(100)
        } else if (event.type === "input_audio_buffer.speech_started") {
          // setValue(0);
          setValue(100)
        } else if (event.type == "input_audio_buffer.committed") {
          setValue(100)
        } else if (event.type === "response.audio_transcript.delta") {
          setPhrase((prev) => prev + event.delta)
        } else if (event.type === "response.done") {
          if (
            event.response &&
            event.response.output &&
            event.response.output.length > 0
          ) {
            let ourTranscriptOutput = event.response.output[0]
            // if (
            //   ourTranscriptOutput.content &&
            //   ourTranscriptOutput.content.length > 0
            // ) {
            //   let ourTranscript = ourTranscriptOutput.content[0];
            //   if (ourTranscript.transcript) {
            //     let ourTranscriptData = ourTranscript.transcript;
            //     console.log("ourTranscriptData", ourTranscriptData);

            //   }
            // }
            const output = event.response?.output?.[0]
            const content = output?.content?.[0]
            if (output && content?.transcript) {
              const message = {
                role: output.role || "assistant", // assistant typically
                text: content.transcript,
                timestamp: event.timestamp || new Date().toISOString(),
              }
              setConversationHistory((prev) => [...prev, message])
              let ourTranscriptData = content.transcript
              console.log("ourTranscriptData", ourTranscriptData)
              updateCurrentIndex(ourTranscriptData)
            }
          }
        } // ✅ User's final transcript after speech
        else if (
          event.type === "conversation.item.input_audio_transcription.completed"
        ) {
          console.log("eventUser", event)
          if (event.transcript) {
            const message = {
              role: "user",
              text: event.transcript,
              timestamp: event.timestamp || new Date().toISOString(),
            }
            setConversationHistory((prev) => [...prev, message])
          }
        } else if (event.type === "response.function_call_arguments.done") {
          const fn = fns[event.name]
          if (fn !== undefined) {
            console.log(
              `Calling local function ${event.name} with ${event.arguments}`
            )
            const args = JSON.parse(event.arguments)
            const result = fn(args)
            // Let OpenAI know that the function has been called and share it's output
            const anotherEvent = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: event.call_id, // call_id from the function_call message
                output: JSON.stringify(result), // result of the function
              },
            }
            dataChannel.send(JSON.stringify(anotherEvent))
          }
        }
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString()
        }
        setEvents((prev) => [event, ...prev])
      })

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true)
        setEvents([])
      })
    }
  }, [dataChannel])

  const fns = {
    moveToStep: ({ stepCount }) => {
      console.log("from function call")
      setCurrentStepIndex(stepCount)
      return { success: true }
    },
  }

  //working code
  // const updateCurrentIndex = (text) => {
  //   const workMatch = text.match(/let's work on step\s+(\d+)/i);
  //   const completeMatch = text.match(/step\s+(\d+)\s+is completed/i);

  //   if (workMatch) {
  //     const stepNum = parseInt(workMatch[1], 10);
  //     setCurrentStepIndex(stepNum === 1 ? 0 : stepNum - 1);
  //   } else if (completeMatch) {
  //     const stepNum = parseInt(completeMatch[1], 10);
  //     setCurrentStepIndex(stepNum);
  //   }
  // };

  const updateCurrentIndex = (text) => {
    const completeMatches = [
      ...text.matchAll(/step[-\s]+(\d+)\s+is completed/gi),
    ]
    const workMatches = [
      ...text.matchAll(/let's (?:move on to|work on) step[-\s]+(\d+)/gi),
    ]

    let stepNum = null

    if (workMatches.length > 0) {
      stepNum = parseInt(workMatches.at(-1)[1], 10) - 1 // latest "work on" step
    } else if (completeMatches.length > 0) {
      stepNum = parseInt(completeMatches.at(-1)[1], 10) // latest "completed" step
    }

    if (stepNum !== null) setCurrentStepIndex(stepNum)
  }

  //Smart video features
  useEffect(() => {
    if (smartTutorValiables.isVideoOn) {
      // Start the video
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => {
          console.error("Error accessing camera: ", err)
        })
    } else {
      // Stop the video
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [smartTutorValiables.isVideoOn])

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error("Error accessing camera:", error)
      }
    }

    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    if (smartTutorValiables.isVideoOn) {
      startCamera()
    } else {
      stopCamera()
    }

    // Cleanup on unmount
    return () => {
      stopCamera()
    }
  }, [smartTutorValiables.isVideoOn])

  const toggleSmartTutorValue = (key) => {
    setSmartTutorValiables((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  function renderUserCamera() {
    return (
      <div className="meet-camera-cont meet-user-video">
        <div className="meet-video-area">
          <video
            className="video-style"
            ref={videoRef}
            autoPlay
            playsInline
            muted
          />
          <div className="on-video-icon">
            <Minimize className="on-video-minim" />
          </div>
          {smartTutorValiables.isHandRaised && (
            <div className="on-video-hand-cont">
              <img className="meet-hand-style" src={Images.meet_hand} />
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderAICamera() {
    return (
      <div className="meet-camera-cont meet-ai-video">
        <div className="meet-video-area">
          <div className="ai-style">
            {smartTutorValiables.isMeetingStarted ? (
              isTutorStarted ? (
                <RiveComponent
                  style={{
                    width: 200,
                    height: 200,
                  }}
                />
              ) : (
                <p className="loading-text">
                  Connecting<span className="dots"></span>
                </p>
              )
            ) : null}
          </div>

          <div className="on-video-icon">
            <Minimize className="on-video-minim" />
          </div>
        </div>
      </div>
    )
  }

  function renderCompData() {
    const optionNum = ["A) ", "B) ", "C) ", "D) "]
    return (
      <div className="tut-comp-cont">
        <div className="comp-ques-label">{demo.problem}</div>
        <div className="comp-option-cont">
          {smartTutorCompData.Options.length > 0 &&
            smartTutorCompData.Options.map((optionData, optionIndex) => {
              return (
                <div className="comp-option">
                  <p className="comp-option-label">
                    {optionNum[optionIndex] + optionData.Option}
                  </p>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (currentStepIndex === 1) {
      let smartTutorValiablesCopy = { ...smartTutorValiables }
      smartTutorValiablesCopy.isNoteOpen = true
      setSmartTutorValiables(smartTutorValiablesCopy)
      const stepsCopy = JSON.parse(demo.steps)
      const completedSteps =
        stepsCopy && stepsCopy.length > 0
          ? stepsCopy.slice(0, Math.max(0, currentStepIndex - 1))
          : []
    }
  }, [currentStepIndex])

  // top-level constants (keep as you had)
  const text = "8 + (6 ÷ 2 × (3 + 1)) - 5"
  const highlightQues = "(3 + 1)"
  const highlightArray = ["6 ÷ 2", "(3 × 4)", "8 + 12", "20 - 5"]

  // replace first occurrence in the main question (unchanged)
  const highlightedTextQues = text.replace(
    highlightQues,
    `<span style="font-weight: bolder;  text-decoration: underline;
  text-decoration-color: #f90e12;
  text-decoration-thickness: 4px;
  text-underline-offset: 4px;">${highlightQues}</span>`
  )

  // helper: safely convert any value to a string
  function safeString(val) {
    if (val === null || val === undefined) return ""
    return String(val)
  }

  // improved highlight function that takes the stepIndex explicitly
  function renderHighLightTextForStep(updatedText, stepIndex) {
    // updatedText should be a string
    const textToUse = safeString(updatedText)

    // validate the highlight exists for the given stepIndex
    const highlightPattern = highlightArray[stepIndex]
    if (!highlightPattern) {
      // fallback: return the passed text or a default placeholder
      return textToUse || "<span></span>"
    }

    // create a safe HTML-wrapped highlighted version of the first match
    // Note: This is a plain string replacement. If the highlightPattern
    // contains special regex chars, escape them. We'll escape to be safe:
    const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex chars

    const pattern = new RegExp(escapeForRegex(highlightPattern))
    const highlighted = textToUse.replace(
      pattern,
      `<span style="font-weight: bolder; text-decoration: underline;
      text-decoration-color: #f90e12;
      text-decoration-thickness: 4px;
      text-underline-offset: 4px;">${highlightPattern}</span>`
    )

    return highlighted
  }

  // main render function for notes/steps
  function renderNoteSteps() {
    const stepsCopy = JSON.parse(demo.steps || "[]")

    return (
      <div className="steps-area">
        <div className="notes-stpes-cont">
          {currentStepIndex === 1 ? (
            <p
              className="notes-updated-exp"
              dangerouslySetInnerHTML={{ __html: highlightedTextQues }}
            />
          ) : (
            <p className="notes-updated-exp">{demo.problem}</p>
          )}
        </div>

        {(() => {
          const completedSteps =
            stepsCopy && stepsCopy.length > 0
              ? stepsCopy.slice(0, Math.max(0, currentStepIndex))
              : []

          if (completedSteps.length === 0) return <span />

          return completedSteps.map((step, idx) => {
            // Prepare safe strings for Description and UpdatedExpression
            const description = safeString(step?.notes?.Description ?? "")
            const updatedExpression = safeString(
              step?.notes?.UpdatedExpression ?? ""
            )

            // determine display mode:
            // - If this is the current step being worked on, show TypingText for UpdatedExpression
            // - If this is the immediate previous step (idx === currentStepIndex - 2), show highlighted HTML
            // - Otherwise show plain text
            const isCurrentWorkingStep = currentStepIndex - 1 === idx
            const isImmediatePrevious = currentStepIndex - 2 === idx

            return (
              <div className="notes-stpes-cont" key={idx}>
                {/* 1) ALWAYS show Description first (notes before updated expression) */}
                {/* <p
                className="notes-updated-exp"
                // If you want the Description to allow highlights too, you can use renderHighLightTextForStep
                // For now we place it as plain text. If you prefer HTML highlights inside description,
                // replace the next line with dangerouslySetInnerHTML and call renderHighLightTextForStep(description, idx)
              >
                {description}
              </p> */}

                <p
                  className="notes-updated-exp"
                  dangerouslySetInnerHTML={{
                    __html: description,
                  }}
                />

                {/* 2) Show UpdatedExpression in the appropriate form */}
                {isCurrentWorkingStep ? (
                  // TypingText expects a string
                  <TypingText text={updatedExpression} speed={80} />
                ) : isImmediatePrevious ? (
                  // highlighted HTML for the immediate previous step (uses the step index)
                  <p
                    className="notes-updated-exp"
                    dangerouslySetInnerHTML={{
                      __html: renderHighLightTextForStep(
                        updatedExpression,
                        idx
                      ),
                    }}
                  />
                ) : (
                  // normal plain text for older steps
                  <p className="notes-updated-exp">{updatedExpression}</p>
                )}
              </div>
            )
          })
        })()}
      </div>
    )
  }

  return (
    <div className="tutor-main-cont">
      <div
        className={
          smartTutorValiables.isNoteOpen
            ? "meeting-area-cont"
            : "meeting-area-cont expand-meeting"
        }
      >
        <div className="meeting-canvas-main-cont">
          <div className="meeting-header-cont">
            <div className="header-title-label-cont">
              <div className="smart-tutor-logo-cont">
                <img
                  className="smart-tut-logo"
                  src={Images.smart_tutor_logo_white}
                ></img>
              </div>
              <span className="smart-tut-label-divider"></span>
              <p className="smart-tut-label">
                {"meeting with Knova about the " + SlideName}
              </p>
            </div>
            <div className="header-title-timer-cont">
              <Time className="meet-timer-logo" />
              <p className="meet-timer-label">{getTimeSpent}</p>
            </div>
          </div>

          <div className="meeting-canvas-cont">
            {Object.keys(smartTutorCompData).length > 0 && renderCompData()}
          </div>
          {renderUserCamera()}
          {renderAICamera()}
        </div>
        <div className="meeting-settings-cont">
          <div className="media-icons-cont">
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isMicroPhone")}
            >
              <img className="meet-icon-style" src={Images.meet_microphone} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isVideoOn")}
            >
              <img className="meet-icon-style" src={Images.meet_camera} />
            </div>
          </div>
          <div className="meeting-set-icons-cont">
            <div className="meet-set-icon">
              <img className="meet-icon-style" src={Images.meet_smile} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isHandRaised")}
            >
              <img className="meet-icon-style" src={Images.meet_raise_hand} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isNoteOpen")}
            >
              <img className="meet-icon-style" src={Images.meet_notes} />
            </div>
          </div>
          <div className="meet-cancel-icon-cont">
            <div
              className={
                smartTutorValiables.isMeetingStarted
                  ? "meet-set-icon meet-end-icon"
                  : "meet-set-icon meet-start-icon"
              }
              onClick={() => {
                if (smartTutorValiables.isMeetingStarted) {
                  toggleSmartTutorValue("isMeetingStarted")
                  stopSession()
                  setValue(0)
                } else {
                  setCurrentStepIndex(0)
                  toggleSmartTutorValue("isMeetingStarted")
                  startSession()
                }
              }}
            >
              {smartTutorValiables.isMeetingStarted ? (
                <img className="meet-icon-style" src={Images.meet_call_end} />
              ) : (
                <PhoneFilled className="meet-start-icon-style" />
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className={
          smartTutorValiables.isNoteOpen
            ? "notes-area-cont minimize-meeting"
            : "notes-area-cont"
        }
      >
        <div className="notes-heading-cont">
          <p className="notes-head-label">Notes</p>
        </div>
        {renderNoteSteps()}
      </div>
    </div>
  )
}

export default SmartTutorScreen
