import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeSession } from "@openai/agents/realtime";
import "./App.css";
import "./visualFeedback.css";
import { aiTutoring } from "./agents/tutor";
import mathData from "../hard4.json"; // Updated to use hard3.json
import { OPENAI_API_KEY, OPENAI_API_URL } from "../env";
import logoImage from "./assets/knomAI_white.png";
import {
  Time,
  MicrophoneFilled,
  Minimize,
  PhoneFilled,
} from "@carbon/icons-react";
import smart_tutor_logo_white from "./assets/knomAI_white.png";

import meet_microphone from "./assets/meet_microphone.png";
import meet_camera from "./assets/meet_camera.png";
import meet_smile from "./assets/meet_smile.png";
import meet_raise_hand from "./assets/meet_raise_hand.png";
import meet_notes from "./assets/meet_notes.png";
import meet_call_end from "./assets/meet_call_end.png";
import meet_hand from "./assets/meet_hand.png";
import { motion } from "framer-motion";

import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

import demo from "../hard4.json";

const STATE_MACHINE_NAME = "State Machine 1";
const INPUT_NAME = "Input";

// Visual Feedback Component
const VisualFeedback = ({ feedback }) => {
  if (!feedback) return null;

  const { type, content, label, explanation, contentType } = feedback;

  // Check if content is just an emoji
  const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(content);

  // If this is an intro type
  if (type === "intro") {
    return (
      <div className={`visual-feedback ${type}`}>
        {contentType === "image" || content.startsWith("http") ? (
          <div className="intro-image-container">
            <img src={content} alt={label} className="intro-image" />
          </div>
        ) : (
          <div className="feedback-content">
            {isEmojiOnly ? (
              <span className="feedback-emoji">{content}</span>
            ) : (
              <div className="feedback-text">{content}</div>
            )}
          </div>
        )}
        <div className="intro-explanation">{explanation}</div>
        {label && <div className="feedback-label">{label}</div>}
      </div>
    );
  }

  // Regular feedback types
  return (
    <div className={`visual-feedback ${type}`}>
      <div className="feedback-content">
        {isEmojiOnly ? (
          <span className="feedback-emoji">{content}</span>
        ) : (
          <div className="feedback-text">{content}</div>
        )}
      </div>
      {label && <div className="feedback-label">{label}</div>}
    </div>
  );
}; // Notes Area Component
const NotesArea = ({ isVisible = false, completedSteps = [] }) => {
  // Validate props
  if (!mathData || !mathData.steps || !Array.isArray(mathData.steps)) {
    console.error("Invalid mathData structure");
    return (
      <div className={`notes-area ${isVisible ? "visible" : "hidden"}`}>
        <div className="notes-header">
          <div className="notes-title">
            <h3>Error</h3>
            <p>Unable to load problem data</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if step is completed
  const isStepCompleted = (stepNumber) => {
    return (
      Array.isArray(completedSteps) &&
      completedSteps.some((step) => step.stepNumber === stepNumber)
    );
  };

  // Get completed step data
  const getCompletedStepData = (stepNumber) => {
    return Array.isArray(completedSteps)
      ? completedSteps.find((step) => step.stepNumber === stepNumber)
      : null;
  };

  return (
    <div className={`notes-area ${isVisible ? "visible" : "hidden"}`}>
      <div className="notes-header">
        <div className="notes-title">
          <h3>Notes</h3>
          <h3>{mathData.title}</h3>
        </div>
      </div>

      <div className="notes-content">
        {mathData.steps.map((step, index) => {
          const stepNumber = step.step;
          const isCompleted = isStepCompleted(stepNumber);
          const completedData = getCompletedStepData(stepNumber);

          // Only show completed steps
          if (!isCompleted) {
            return null;
          }

          return (
            <div key={index} className="note-card completed">
              <div className="note-header">
                <span className="step-number">Step {stepNumber}</span>
                <span className="step-title">{step.stepTitle}</span>
                <span className="completion-badge">✓</span>
              </div>
              <p className="step-notes">
                {completedData.description || "No description available"}
              </p>
              <>
                <div className="expression-container">
                  <code className="math-expression">
                    {completedData.updatedExpression || "N/A"}
                  </code>
                </div>
              </>
            </div>
          );
        })}

        {completedSteps.length === 0 && (
          <div className="no-steps-message">
            <p>🎓 Start the tutoring session to see your progress here!</p>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  // Initialize session with error handling
  const session = useRef(null);
  const [sessionError, setSessionError] = useState(null);
  const [clientSecret, setClientSecret] = useState();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(
    "Click 'Connect' to start a tutoring session"
  );

  // Push-to-talk state management (always enabled)
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [pushToTalkKey] = useState("Space");

  // Update message for push-to-talk mode
  useEffect(() => {
    if (isConnected) {
      setMessage(
        `Connected! Hold ${
          pushToTalkKey === "Space" ? "Spacebar" : pushToTalkKey
        } to talk.`
      );
    } else {
      setMessage("Click 'Connect' to start a tutoring session");
    }
  }, [isConnected, pushToTalkKey]);
  const [notesVisible, setNotesVisible] = useState(true);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [visualFeedback, setVisualFeedback] = useState(null);

  //Animation variables
  const [value, setValue] = useState(0);
  const { rive, RiveComponent } = useRive({
    src: "https://learnpodseditornodeserver.knomadixapp.com/backpack/knomadix_ai.riv",
    autoplay: true,
    stateMachines: STATE_MACHINE_NAME,
  });
  const input = useStateMachineInput(rive, STATE_MACHINE_NAME, INPUT_NAME);

  const streamRef = useRef(null); // Store the stream
  const [smartTutorValiables, setSmartTutorValiables] = useState({
    isMicroPhone: false,
    isVideoOn: true,
    isHandRaised: false,
    isNoteOpen: true,
    isMeetingStarted: false,
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(4);

  useEffect(() => {
    if (input) {
      input.value = value;
    }
  }, [input, value]);

  //Video variables
  const videoRef = useRef(null);

  function cameraPermission() {
    // Request access to the camera
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // toggleSmartTutorValue("isVideoOn");
        }
      })
      .catch((err) => {
        console.error("Error accessing camera: ", err);
      });
  }

  // Initialize session
  useEffect(() => {
    cameraPermission();

    try {
      if (aiTutoring?.greeterAgent) {
        // Start with the greeter agent, which will handle the proper flow
        session.current = new RealtimeSession(aiTutoring.brainStormerAgent);
      } else {
        throw new Error("Greeter agent not available");
      }
    } catch (error) {
      console.error("Failed to initialize session:", error);
      setSessionError(error.message);
      setMessage("Failed to initialize tutoring session");
    }
  }, []);

  // Handle step completion from the agent
  const handleStepCompletion = useCallback(
    (stepNumber, description, updatedExpression) => {
      console.log(
        `🎯 Step ${stepNumber} completed in UI:`,
        description,
        updatedExpression
      );

      // Validate input parameters
      if (!stepNumber || !description || !updatedExpression) {
        console.error("Invalid step completion data:", {
          stepNumber,
          description,
          updatedExpression,
        });
        return;
      }

      // Add to completed steps if not already present
      setCompletedSteps((prev) => {
        if (!prev.find((step) => step.stepNumber === stepNumber)) {
          const newStep = {
            stepNumber,
            description,
            updatedExpression,
            completedAt: new Date().toISOString(),
          };
          const updated = [...prev, newStep].sort(
            (a, b) => a.stepNumber - b.stepNumber
          );
          console.log("Updated completed steps:", updated);
          return updated;
        }
        return prev;
      });
    },
    []
  ); // Empty dependency array since we're using functional updates

  // Handle visual feedback from the agent
  const handleVisualFeedback = useCallback(
    (type, content, label, stepNumber, questionIndex) => {
      console.log(
        `🎨 Visual feedback in UI:`,
        type,
        content,
        label,
        stepNumber,
        questionIndex
      );

      // Validate input parameters
      if (!type || !content || !label || !stepNumber) {
        console.error("Invalid visual feedback data:", {
          type,
          content,
          label,
          stepNumber,
          questionIndex,
        });
        return;
      }

      // For any new feedback, clear previous feedback first
      setVisualFeedback(null);

      // Small delay to ensure smooth transition
      setTimeout(() => {
        // Set the current visual feedback
        const timestamp = new Date().toISOString();
        setVisualFeedback({
          type,
          content,
          label,
          stepNumber,
          questionIndex,
          timestamp,
        });

        // For success and hint types, automatically clear after 5 seconds
        if (type === "success" || type === "hint") {
          setTimeout(() => {
            setVisualFeedback((current) => {
              // Only clear if this is the same feedback that was set
              if (current && current.timestamp === timestamp) {
                return null;
              }
              return current;
            });
          }, 5000);
        }
      }, 100);
    },
    []
  );

  // Handle introduction visual from the introGiver agent
  const handleIntroVisual = useCallback((content, label, explanation, type) => {
    console.log(`🎨 Intro visual in UI:`, content, label, explanation, type);

    // Validate input parameters
    if (!content || !label || !explanation) {
      console.error("Invalid intro visual data:", {
        content,
        label,
        explanation,
        type,
      });
      return;
    }

    // For any new feedback, clear previous feedback first
    setVisualFeedback(null);

    // Small delay to ensure smooth transition
    setTimeout(() => {
      // Set the current visual feedback with intro type
      const timestamp = new Date().toISOString();
      setVisualFeedback({
        type: "intro",
        content,
        label,
        explanation,
        contentType: type || "text",
        timestamp,
      });
    }, 100);
  }, []);

  // Expose handler functions globally for agents to call
  useEffect(() => {
    window.handleStepCompletion = handleStepCompletion;
    window.handleVisualFeedback = handleVisualFeedback;
    window.handleIntroVisual = handleIntroVisual;

    return () => {
      delete window.handleStepCompletion;
      delete window.handleVisualFeedback;
      delete window.handleIntroVisual;
    };
  }, [handleStepCompletion, handleVisualFeedback, handleIntroVisual]);

  // Push-to-talk keyboard event handlers
  useEffect(() => {
    if (!isConnected) return;

    const handleKeyDown = (event) => {
      // Only activate if the key matches our push-to-talk key and we're not already active
      if (
        (event.code === pushToTalkKey || event.key === " ") &&
        !isPushToTalkActive &&
        !event.repeat
      ) {
        event.preventDefault();
        setIsPushToTalkActive(true);
        setValue(100);
        if (session.current) {
          session.current.mute(false);
          setIsMicrophoneMuted(false);
        }
      }
    };

    const handleKeyUp = (event) => {
      // Deactivate when the key is released
      if (
        (event.code === pushToTalkKey || event.key === " ") &&
        isPushToTalkActive
      ) {
        event.preventDefault();
        setIsPushToTalkActive(false);
        setValue(-100);
        if (session.current) {
          session.current.mute(true);
          setIsMicrophoneMuted(true);
        }
      }
    };

    // Add event listeners to the document
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [isConnected, isPushToTalkActive, pushToTalkKey]);

  // Initialize microphone state when connecting/disconnecting
  useEffect(() => {
    if (isConnected) {
      // Always start muted in push-to-talk mode
      if (session.current) {
        session.current.mute(true);
        setIsMicrophoneMuted(true);
      }
    }
  }, [isConnected]);

  useEffect(() => {
    fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime",
          // model: "gpt-realtime-mini-2025-10-06",
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.value);
      })
      .catch((err) => {
        console.error(err);
        setMessage("Failed to initialize session. Please try again.");
      });
  }, []);

  const handleConnect = async () => {
    if (!clientSecret || isConnected) return;

    try {
      setIsLoading(true);
      setMessage("Connecting to AI tutor...");

      if (!session.current) {
        throw new Error("Session not initialized");
      }

      // For debugging visual feedback on initial connection
      // Comment this out for production
      /*
      setTimeout(() => {
        // Show illustration first
        handleVisualFeedback(
          'illustration',
          '(3 + 1)',
          'The innermost parentheses',
          1,
          0
        );
      }, 2000);
      */

      await session.current.connect({
        apiKey: clientSecret,
      });

      setIsConnected(true);
    } catch (err) {
      console.error("Connection error:", err);
      setMessage(`Failed to connect: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isConnected) return;

    try {
      setIsLoading(true);
      setMessage("Disconnecting...");

      if (!session.current) {
        throw new Error("Session not found");
      }

      await session.current.close();

      setIsConnected(false);
    } catch (err) {
      console.error("Disconnection error:", err);
      setMessage(`Failed to disconnect: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // const updateCurrentIndex = (text) => {
  //   const stepMatch = text.match(/Step\s+(\d+)/i); // matches "Step 1", "Step  2", etc.
  //   if (!stepMatch) return;

  //   const stepNum = parseInt(stepMatch[1], 10);

  //   if (text.toLowerCase().includes("let's work on step")) {
  //     setCurrentStepIndex(stepNum === 1 ? 0 : stepNum - 1);
  //   } else if (
  //     text.toLowerCase().includes("step") &&
  //     text.toLowerCase().includes("completed")
  //   ) {
  //     setCurrentStepIndex(stepNum);
  //   }
  // };

  // const updateCurrentIndex = (text) => {
  //   const stepMatch = text.match(/Step(\d+)/);
  //   if (!stepMatch) return;

  //   const stepNum = parseInt(stepMatch[1], 10);
  //   if (text.toLowerCase().includes("let's work on step")) {
  //     setCurrentStepIndex(stepNum === 1 ? 0 : stepNum - 1);
  //   } else if (
  //     text.toLowerCase().includes("step") &&
  //     text.toLowerCase().includes("completed")
  //   ) {
  //     console.log("from transcript");
  //     setCurrentStepIndex(stepNum); // Proceed to the next step
  //   }
  // };

  // useEffect(() => {
  //   if (dataChannel) {
  //     dataChannel.addEventListener("message", (e) => {
  //       const event = JSON.parse(e.data);

  //     });
  //   }
  // }, [dataChannel]);

  // useEffect(() => {
  //   if (audioOver) {
  //     const stepMatch = phrase.toLowerCase().match(/step\s*(\d+)/);
  //     if (stepMatch) {
  //       setCurrentStepIndex(parseInt(stepMatch[1], 10));
  //     } else if (phrase.toLowerCase().includes("successfully")) {
  //       const stepsCopy = JSON.parse(demo.steps);
  //       setCurrentStepIndex(stepsCopy.length + 1);
  //     }
  //   }
  // }, [audioOver]);

  //Smart video features
  useEffect(() => {
    if (smartTutorValiables.isVideoOn) {
      // Start the video
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Error accessing camera: ", err);
        });
    } else {
      // Stop the video
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [smartTutorValiables.isVideoOn]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (smartTutorValiables.isVideoOn) {
      startCamera();
    } else {
      stopCamera();
    }

    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [smartTutorValiables.isVideoOn]);

  const toggleSmartTutorValue = (key) => {
    setSmartTutorValiables((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  function renderSpaceBar() {
    // const { isRecording, isProcessingAI, isPlayingAI, isConnected } = props;

    // 1. Determine the button's text based on the current state
    let buttonText = "Press & Hold Spacebar to Speak";
    if (!isConnected) {
      buttonText = "Connecting...";
    } else if (isPushToTalkActive) {
      buttonText = "Recording...";
    }

    // 2. Determine if the button should be disabled
    // This fulfills your requirement to disable it during processing and playback
    const isDisabled = !isConnected;

    return (
      <div style={{ position: "absolute", bottom: "2%", alignSelf: "center" }}>
        <motion.button
          style={{
            borderRadius: "14px",
            border: "2px solid #262947",
            backgroundColor: "white",
            color: "#1d2038",
            cursor: isDisabled ? "not-allowed" : "pointer",
            // 3. Add opacity to show the disabled "fade" state
            opacity: isDisabled ? 0.6 : 1,
          }}
          // 4. Pass the 'disabled' attribute to the button
          disabled={isDisabled}
          // 5. Your animation now correctly uses the 'isRecording' state
          animate={{ scale: isPushToTalkActive ? 0.95 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* <Mic className="w-5 h-5" /> */}
          {buttonText}
        </motion.button>
      </div>
    );
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
          {/* {smartTutorValiables.isHandRaised && (
            <div className="on-video-hand-cont">
              <img className="meet-hand-style" src={Images.meet_hand} />
            </div>
          )} */}
        </div>
      </div>
    );
  }

  function renderAICamera() {
    return (
      <div className="meet-camera-cont meet-ai-video">
        <div className="meet-video-area">
          <div className="ai-style">
            {isLoading ? (
              <p className="loading-text">
                Connecting<span className="dots"></span>
              </p>
            ) : isConnected ? (
              <RiveComponent
                style={{
                  width: 200,
                  height: 200,
                }}
              />
            ) : null}
          </div>

          <div className="on-video-icon">
            <Minimize className="on-video-minim" />
          </div>
        </div>
      </div>
    );
  }

  // main render function for notes/steps
  function renderNoteSteps() {
    const stepsCopy = demo.steps;
    console.log("stepsCopy", stepsCopy);
    return (
      <div className="steps-area">
        {/* <div className="notes-stpes-cont">
          {currentStepIndex === 1 ? (
            <p
              className="notes-updated-exp"
              dangerouslySetInnerHTML={{ __html: highlightedTextQues }}
            />
          ) : (
            <p className="notes-updated-exp">{demo.problem}</p>
          )}
        </div> */}

        {(() => {
          const completedSteps =
            stepsCopy && stepsCopy.length > 0
              ? stepsCopy.slice(0, Math.max(0, currentStepIndex))
              : [];

          if (completedSteps.length === 0) return <span />;

          return completedSteps.map((step, idx) => {
            // Prepare safe strings for Description and UpdatedExpression
            const description = step.Notes.Description;
            const updatedExpression = step.Notes.UpdatedExpression;

            // determine display mode:
            // - If this is the current step being worked on, show TypingText for UpdatedExpression
            // - If this is the immediate previous step (idx === currentStepIndex - 2), show highlighted HTML
            // - Otherwise show plain text
            const isCurrentWorkingStep = currentStepIndex - 1 === idx;
            const isImmediatePrevious = currentStepIndex - 2 === idx;

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

                <p className="notes-updated-exp"> {description}</p>
                <p className="notes-updated-exp">{updatedExpression}</p>

                {/* 2) Show UpdatedExpression in the appropriate form */}
                {/* {isCurrentWorkingStep ? (
                  // TypingText expects a string
                  <TypingTe text={updatedExpression} speed={80} />
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
                )} */}
              </div>
            );
          });
        })()}
      </div>
    );
  }

  return (
    <div className="tutor-main-cont">
      <div
        className={
          notesVisible
            ? "meeting-area-cont"
            : "meeting-area-cont expand-meeting"
        }
      >
        <div className="meeting-canvas-main-cont">
          {/* Header UI */}
          <div className="meeting-header-cont">
            <div className="header-title-label-cont">
              <div className="smart-tutor-logo-cont">
                <img
                  className="smart-tut-logo"
                  src={smart_tutor_logo_white}
                ></img>
              </div>
              <span className="smart-tut-label-divider"></span>
              <p className="smart-tut-label">
                {"meeting with Knova about the States of matter"}
              </p>
            </div>
            {/* <div className="header-title-timer-cont">
              <Time className="meet-timer-logo" />
              <p className="meet-timer-label">{getTimeSpent}</p>
            </div> */}
          </div>
          <div className="meeting-canvas-cont">
            {/* {Object.keys(smartTutorCompData).length > 0 && renderCompData()} */}
          </div>
          {renderUserCamera()}
          {renderAICamera()}
          {isConnected && renderSpaceBar()}
        </div>
        <div className="meeting-settings-cont">
          <div className="media-icons-cont">
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isMicroPhone")}
            >
              <img className="meet-icon-style" src={meet_microphone} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isVideoOn")}
            >
              <img className="meet-icon-style" src={meet_camera} />
            </div>
          </div>
          <div className="meeting-set-icons-cont">
            <div className="meet-set-icon">
              <img className="meet-icon-style" src={meet_smile} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isHandRaised")}
            >
              <img className="meet-icon-style" src={meet_raise_hand} />
            </div>
            <div
              className="meet-set-icon"
              onClick={() => toggleSmartTutorValue("isNoteOpen")}
            >
              <img className="meet-icon-style" src={meet_notes} />
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
                  toggleSmartTutorValue("isMeetingStarted");
                  handleDisconnect();
                  setValue(0);
                } else {
                  toggleSmartTutorValue("isMeetingStarted");
                  handleConnect();
                }
              }}
            >
              {isConnected ? (
                <img className="meet-icon-style" src={meet_call_end} />
              ) : (
                <PhoneFilled className="meet-start-icon-style" />
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className={
          notesVisible ? "notes-area-cont minimize-meeting" : "notes-area-cont"
        }
      >
        <div className="notes-heading-cont">
          <p className="notes-head-label">Notes</p>
        </div>
        {renderNoteSteps()}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <div className={`main-layout ${notesVisible ? "notes-open" : ""}`}>
        <div className="content-area">
          <div
            className={`video-call-container ${
              isConnected ? "connected" : ""
            } ${isPushToTalkActive ? "ptt-active" : ""} ${
              isMicrophoneMuted ? "ptt-muted" : ""
            }`}
          >
            <div className="video-call-header">
              {sessionError ? (
                <div className="header-content">
                  <h1>Session Error</h1>
                  <p className="status-message">
                    Failed to initialize: {sessionError}
                  </p>
                </div>
              ) : (
                <div className="header-content">
                  <h1>AI Tutoring Session</h1>
                  <p className="status-message">{message}</p>
                </div>
              )}
              <div className="header-controls">
                {isConnected && (
                  <div className="timer">
                    <span className="timer-dot"></span>
                    Connected
                  </div>
                )}
              </div>
            </div>{" "}
            <div className="video-frame">
              <div className="ai-avatar">
                {isConnected ? (
                  <div className="avatar-active">
                    <div className="avatar-image">
                      <span className="avatar-initial">AI</span>
                    </div>
                    <div className="speaking-indicator">
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                    </div>
                  </div>
                ) : (
                  <div className="avatar-inactive">
                    <span className="avatar-initial">AI</span>
                  </div>
                )}
                <p className="avatar-name">AI Tutor</p>
              </div>

              {/* Visual feedback display area */}
              {visualFeedback && (
                <div className="visual-feedback-container">
                  <VisualFeedback feedback={visualFeedback} />
                </div>
              )}
            </div>
            <div className="call-controls">
              <button
                className={`call-button connect-button ${
                  isConnected ? "disabled" : ""
                }`}
                onClick={handleConnect}
                disabled={isLoading || isConnected || !clientSecret}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20 15.5c-1.2 0-2.5-.2-3.6-.6h-.3c-.3 0-.5.1-.7.3l-2.2 2.2c-2.8-1.5-5.2-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.6 0-.5-.4-1-1-1H4c-.5 0-1 .5-1 1 0 9.4 7.6 17 17 17 .5 0 1-.5 1-1v-3.5c0-.5-.4-1-1-1zM12 3v10l3-3h6V3h-9z" />
                </svg>
                Connect
              </button>

              <button
                className={`call-button disconnect-button ${
                  !isConnected ? "disabled" : ""
                }`}
                onClick={handleDisconnect}
                disabled={isLoading || !isConnected}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
                Disconnect
              </button>

              {/* Push-to-Talk Controls */}
              {isConnected && (
                <>
                  <button
                    className={`call-button mic-button ${
                      isPushToTalkActive ? "active" : "muted"
                    }`}
                    onClick={undefined}
                    disabled={true}
                    title={`Hold ${
                      pushToTalkKey === "Space" ? "Spacebar" : pushToTalkKey
                    } to talk`}
                  >
                    {isPushToTalkActive ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                      </svg>
                    )}
                    {isPushToTalkActive ? "TALKING" : "HOLD SPACE"}
                  </button>
                </>
              )}

              <button
                className="notes-toggle-main"
                onClick={() => setNotesVisible(!notesVisible)}
                title={notesVisible ? "Hide Notes" : "Show Notes"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
                Notes
              </button>
            </div>
          </div>
        </div>

        <NotesArea isVisible={notesVisible} completedSteps={completedSteps} />
      </div>
    </div>
  );
}

export default App;
