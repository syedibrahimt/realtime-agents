import { useState, useEffect, useRef, useCallback } from "react"
import { RealtimeSession } from "@openai/agents-realtime"
import "./App.css"
import "./visualFeedback.css"
import { OPENAI_API_URL, OPENAI_API_KEY } from "../env"
import { aiTutoring } from "./agents/tutor"
import mathData from "../hard3.json" // Updated to use hard3.json

// Star background component with animation controlled by isConnected
const StarBackground = ({ isConnected }) => {
  const [stars, setStars] = useState([])
  const [nebulas, setNebulas] = useState([])
  const canvasRef = useRef(null)

  // Generate random stars and nebulas
  useEffect(() => {
    const generateStars = () => {
      const canvasWidth = window.innerWidth
      const canvasHeight = window.innerHeight
      const starCount = Math.floor((canvasWidth * canvasHeight) / 800) // Higher density

      // Generate stars
      const newStars = []
      for (let i = 0; i < starCount; i++) {
        // Create different types of stars with varied characteristics
        const isBright = Math.random() < 0.05 // 5% chance of being a bright star
        newStars.push({
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
          size: isBright ? Math.random() * 2 + 1.5 : Math.random() * 1.2 + 0.3, // Varied sizes
          opacity: isBright
            ? Math.random() * 0.3 + 0.7
            : Math.random() * 0.7 + 0.1, // Varied opacity
          pulse: Math.random() * 2, // For pulsing animation
          speed: Math.random() * 0.05, // For rotation speed
          color: isBright ? getRandomStarColor() : "rgb(255, 255, 255)", // Colored for bright stars
        })
      }

      // Generate nebula clouds
      const nebulaCount = 3 + Math.floor(Math.random() * 3) // 3-5 nebulas
      const newNebulas = []
      for (let i = 0; i < nebulaCount; i++) {
        newNebulas.push({
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
          width: Math.random() * 300 + 200, // Width between 200-500
          height: Math.random() * 200 + 100, // Height between 100-300
          opacity: Math.random() * 0.1 + 0.05, // Very subtle
          color: getRandomNebulaColor(),
          speed: Math.random() * 0.01, // Slower than stars
        })
      }

      setStars(newStars)
      setNebulas(newNebulas)
    }

    // Helper function to generate random star colors (mostly blue/white with some red/yellow)
    const getRandomStarColor = () => {
      const colorTypes = [
        "rgb(200, 220, 255)", // Blue-white
        "rgb(255, 255, 240)", // Warm white
        "rgb(255, 220, 180)", // Yellow
        "rgb(255, 180, 180)", // Red
      ]
      return colorTypes[Math.floor(Math.random() * colorTypes.length)]
    }

    // Helper function to generate random nebula colors
    const getRandomNebulaColor = () => {
      const colorTypes = [
        "rgb(40, 60, 120)", // Blue
        "rgb(80, 40, 120)", // Purple
        "rgb(120, 40, 80)", // Magenta
        "rgb(120, 40, 40)", // Red
      ]
      return colorTypes[Math.floor(Math.random() * colorTypes.length)]
    }

    generateStars()

    // Regenerate stars when window is resized
    window.addEventListener("resize", generateStars)
    return () => window.removeEventListener("resize", generateStars)
  }, [])

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    let animationId
    let angle = 0

    // Make the animation speed significantly faster when connected
    const animationSpeed = isConnected ? 0.01 : 0.0005

    const animate = () => {
      // Set canvas size
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw nebulas first (they're in the background)
      nebulas.forEach((nebula) => {
        let x = nebula.x
        let y = nebula.y

        // Apply slow rotation to nebulas if connected
        if (isConnected) {
          const centerX = canvas.width / 2
          const centerY = canvas.height / 2

          const dx = x - centerX
          const dy = y - centerY

          // Enhanced rotation for nebulas when connected
          const rotationAngle = angle * nebula.speed * 0.6

          x =
            centerX +
            dx * Math.cos(rotationAngle) -
            dy * Math.sin(rotationAngle)
          y =
            centerY +
            dx * Math.sin(rotationAngle) +
            dy * Math.cos(rotationAngle)
        }

        // Create gradient for nebula
        const gradient = ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          Math.max(nebula.width, nebula.height) / 2
        )

        // Set gradient colors
        const opacityMultiplier = isConnected ? 2 : 1
        const pulseEffect = isConnected
          ? 0.3 * Math.sin(angle * 0.5)
          : 0.2 * Math.sin(angle * 0.5)
        gradient.addColorStop(
          0,
          `rgba(${nebula.color.slice(4, -1)}, ${
            nebula.opacity * opacityMultiplier * (1 + pulseEffect)
          })`
        )
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)")

        // Draw nebula
        ctx.save()
        ctx.translate(x, y)
        const nebulaRotation = isConnected ? angle * 0.1 : angle * 0.05 // Enhanced rotation when connected
        ctx.rotate(nebulaRotation)
        ctx.scale(1, nebula.height / nebula.width)

        ctx.beginPath()
        ctx.arc(0, 0, nebula.width / 2, 0, 2 * Math.PI)
        ctx.fillStyle = gradient
        ctx.fill()

        ctx.restore()
      })

      // Draw and animate stars
      stars.forEach((star) => {
        let x = star.x
        let y = star.y

        // Apply rotation and ripple effects if connected
        if (isConnected) {
          // Center of rotation
          const centerX = canvas.width / 2
          const centerY = canvas.height / 2

          // Distance from center
          const dx = x - centerX
          const dy = y - centerY
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Slow rotation effect - enhanced when connected
          const rotationSpeed =
            star.speed *
            (1 - distance / Math.max(canvas.width, canvas.height)) *
            (isConnected ? 6 : 1)
          const currentAngle = angle * rotationSpeed

          // Apply rotation
          const rotatedX =
            centerX + dx * Math.cos(currentAngle) - dy * Math.sin(currentAngle)
          const rotatedY =
            centerY + dx * Math.sin(currentAngle) + dy * Math.cos(currentAngle)

          // Add ripple effect - enhanced when connected
          const ripplePhase = distance / 40 + angle / 3
          const rippleAmplitude = isConnected ? 3 : 0
          const ripple = rippleAmplitude * Math.sin(ripplePhase)

          x = rotatedX + (ripple * dx) / (distance || 1) // Avoid division by zero
          y = rotatedY + (ripple * dy) / (distance || 1)
        }

        // Pulsating opacity effect - enhanced when connected
        const pulseIntensity = isConnected ? 0.5 : 0.3
        const pulsingOpacity =
          star.opacity *
          (0.7 + pulseIntensity * Math.sin(angle * 2 + star.pulse))

        // Draw star
        ctx.beginPath()
        ctx.arc(x, y, star.size, 0, 2 * Math.PI)
        ctx.fillStyle = star.color
          ? `rgba(${star.color.slice(4, -1)}, ${pulsingOpacity})`
          : `rgba(255, 255, 255, ${pulsingOpacity})`
        ctx.fill()

        // Draw occasional glow for larger stars
        if (star.size > 1.2) {
          ctx.beginPath()
          const glowSize = isConnected ? star.size * 3 : star.size * 2
          ctx.arc(x, y, glowSize, 0, 2 * Math.PI)

          // Create colored glow based on star color
          const glowColor = star.color
            ? star.color.slice(4, -1)
            : "100, 200, 255"
          const glowOpacity = isConnected
            ? pulsingOpacity * 0.25
            : pulsingOpacity * 0.15
          ctx.fillStyle = `rgba(${glowColor}, ${glowOpacity})`
          ctx.fill()
        }
      })

      // Increment angle for animations - faster when connected
      angle += animationSpeed

      // Continue animation loop
      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [stars, nebulas, isConnected])

  return (
    <canvas
      ref={canvasRef}
      className={`star-background ${isConnected ? "active" : ""}`}
    />
  )
}

// Visual Feedback Component
const VisualFeedback = ({ feedback }) => {
  if (!feedback) return null

  const { type, content } = feedback
  
  // Check if content is just an emoji
  const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(content);
  
  return (
    <div className={`visual-feedback ${type}`}>
      <div className="feedback-content">
        {isEmojiOnly ? (
          <span className="feedback-emoji">{content}</span>
        ) : (
          <div className="feedback-text">{content}</div>
        )}
      </div>
      {/* {label && <div className="feedback-label">{label}</div>} */}
    </div>
  )
}

// Notes Area Component
const NotesArea = ({ isVisible = false, completedSteps = [] }) => {
  // Validate props
  if (!mathData || !mathData.steps || !Array.isArray(mathData.steps)) {
    console.error("Invalid mathData structure")
    return (
      <div className={`notes-area ${isVisible ? "visible" : "hidden"}`}>
        <div className="notes-header">
          <div className="notes-title">
            <h3>Error</h3>
            <p>Unable to load problem data</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if step is completed
  const isStepCompleted = (stepNumber) => {
    return (
      Array.isArray(completedSteps) &&
      completedSteps.some((step) => step.stepNumber === stepNumber)
    )
  }

  // Get completed step data
  const getCompletedStepData = (stepNumber) => {
    return Array.isArray(completedSteps)
      ? completedSteps.find((step) => step.stepNumber === stepNumber)
      : null
  }

  return (
    <div className={`notes-area ${isVisible ? "visible" : "hidden"}`}>
      <div className="notes-header">
        <div className="notes-title">
          <h3>{mathData.title}</h3>
          <p className="original-problem">{mathData.problem}</p>
        </div>
        <div className="progress-indicator">
          <span className="progress-text">
            Progress: {completedSteps.length} / {mathData.steps.length} steps
          </span>
        </div>
      </div>

      <div className="notes-content">
        {mathData.steps.map((step, index) => {
          const stepNumber = step.step
          const isCompleted = isStepCompleted(stepNumber)
          const completedData = getCompletedStepData(stepNumber)

          // Only show completed steps
          if (!isCompleted) {
            return null
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
          )
        })}

        {completedSteps.length === 0 && (
          <div className="no-steps-message">
            <p>🎓 Start the tutoring session to see your progress here!</p>
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  // Initialize session with error handling
  const session = useRef(null)
  const [sessionError, setSessionError] = useState(null)
  const [clientSecret, setClientSecret] = useState()
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(
    "Click 'Connect' to start a tutoring session"
  )
  const [notesVisible, setNotesVisible] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  const [visualFeedback, setVisualFeedback] = useState(null)

  // Initialize session
  useEffect(() => {
    try {
      if (aiTutoring?.stepTutorAgent) {
        session.current = new RealtimeSession(aiTutoring.stepTutorAgent)
      } else {
        throw new Error("Step tutor agent not available")
      }
    } catch (error) {
      console.error("Failed to initialize session:", error)
      setSessionError(error.message)
      setMessage("Failed to initialize tutoring session")
    }
  }, [])

  // Handle step completion from the agent
  const handleStepCompletion = useCallback(
    (stepNumber, description, updatedExpression) => {
      console.log(
        `🎯 Step ${stepNumber} completed in UI:`,
        description,
        updatedExpression
      )

      // Validate input parameters
      if (!stepNumber || !description || !updatedExpression) {
        console.error("Invalid step completion data:", {
          stepNumber,
          description,
          updatedExpression,
        })
        return
      }

      // Add to completed steps if not already present
      setCompletedSteps((prev) => {
        if (!prev.find((step) => step.stepNumber === stepNumber)) {
          const newStep = {
            stepNumber,
            description,
            updatedExpression,
            completedAt: new Date().toISOString(),
          }
          const updated = [...prev, newStep].sort(
            (a, b) => a.stepNumber - b.stepNumber
          )
          console.log("Updated completed steps:", updated)
          return updated
        }
        return prev
      })
    },
    []
  ) // Empty dependency array since we're using functional updates

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
      )

      // Validate input parameters
      if (!type || !content || !label || !stepNumber) {
        console.error("Invalid visual feedback data:", {
          type,
          content,
          label,
          stepNumber,
          questionIndex,
        })
        return
      }

      // For any new feedback, clear previous feedback first
      setVisualFeedback(null)

      // Small delay to ensure smooth transition
      setTimeout(() => {
        // Set the current visual feedback
        const timestamp = new Date().toISOString()
        setVisualFeedback({
          type,
          content,
          label,
          stepNumber,
          questionIndex,
          timestamp,
        })

        // For success and hint types, automatically clear after 5 seconds
        if (type === "success" || type === "hint") {
          setTimeout(() => {
            setVisualFeedback((current) => {
              // Only clear if this is the same feedback that was set
              if (current && current.timestamp === timestamp) {
                return null
              }
              return current
            })
          }, 5000)
        }
      }, 100)
    },
    []
  )

  // Expose handleStepCompletion globally for agent to call
  useEffect(() => {
    window.handleStepCompletion = handleStepCompletion
    window.handleVisualFeedback = handleVisualFeedback

    return () => {
      delete window.handleStepCompletion
      delete window.handleVisualFeedback
    }
  }, [handleStepCompletion, handleVisualFeedback])

  useEffect(() => {
    fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2025-06-03",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.client_secret.value)
      })
      .catch((err) => {
        console.error(err)
        setMessage("Failed to initialize session. Please try again.")
      })
  }, [])

  const handleConnect = async () => {
    if (!clientSecret || isConnected) return

    try {
      setIsLoading(true)
      setMessage("Connecting to AI tutor...")

      if (!session.current) {
        throw new Error("Session not initialized")
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
      })

      setIsConnected(true)
      setMessage("Connected! AI tutor is ready.")
    } catch (err) {
      console.error("Connection error:", err)
      setMessage(`Failed to connect: ${err.message || "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!isConnected) return

    try {
      setIsLoading(true)
      setMessage("Disconnecting...")

      if (!session.current) {
        throw new Error("Session not found")
      }

      await session.current.close()

      setIsConnected(false)
      setMessage("Disconnected. Click 'Connect' to start a new session.")
    } catch (err) {
      console.error("Disconnection error:", err)
      setMessage(`Failed to disconnect: ${err.message || "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Show error state if session failed to initialize
  if (sessionError) {
    return (
      <div className="app-container">
        <StarBackground isConnected={false} />
        <div className="main-layout">
          <div className="content-area">
            <div className="video-call-container">
              <div className="video-call-header">
                <div className="header-content">
                  <h1>Session Error</h1>
                  <p className="status-message">
                    Failed to initialize: {sessionError}
                  </p>
                </div>
              </div>
              <div className="video-frame">
                <div className="ai-avatar">
                  <div className="avatar-inactive">
                    <span className="avatar-initial">⚠️</span>
                  </div>
                  <p className="avatar-name">Error</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <StarBackground isConnected={isConnected} />

      <div className={`main-layout ${notesVisible ? "notes-open" : ""}`}>
        <div className="content-area">
          <div
            className={`video-call-container ${isConnected ? "connected" : ""}`}
          >
            <div className="video-call-header">
              <div className="header-content">
                <h1>Math Tutoring Session</h1>
                <p className="status-message">{message}</p>
              </div>
              <div className="header-controls">
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
                
                {isConnected && (
                  <div className="timer">
                    <span className="timer-dot"></span>
                    Connected
                  </div>
                )}
              </div>
            </div>            <div className="video-frame">
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
                <p className="avatar-name">Math Tutor</p>
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
            </div>
          </div>
        </div>

        <NotesArea isVisible={notesVisible} completedSteps={completedSteps} />
      </div>
    </div>
  )
}

export default App
