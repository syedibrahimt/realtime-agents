/**
 * ADK WebSocket Client
 * Replaces OpenAI Realtime API with Google ADK backend communication
 */

import { ADK_BACKEND_URL, ADK_HTTP_URL } from "../../env"

export class AdkWebSocketClient {
  constructor() {
    this.ws = null
    this.sessionId = null
    this.isConnected = false
    this.isMuted = true
    this.eventListeners = new Map()
    this.audioContext = null
    this.mediaRecorder = null
    this.audioChunks = []
    this.isRecording = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
  }

  // Event handling
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event).push(callback)
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // Create a new session
  async createSession() {
    try {
      const response = await fetch(`${ADK_HTTP_URL}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`)
      }

      const data = await response.json()
      this.sessionId = data.session_id
      console.log('Created session:', this.sessionId)
      return data
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  }

  // Connect to the WebSocket
  async connect() {
    try {
      // Create session if we don't have one
      if (!this.sessionId) {
        await this.createSession()
      }

      // Connect WebSocket
      const wsUrl = `${ADK_BACKEND_URL}${this.sessionId}`
      this.ws = new WebSocket(wsUrl)

      return new Promise((resolve, reject) => {
        this.ws.onopen = () => {
          console.log('WebSocket connected to ADK backend')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.setupAudioCapture()
          this.emit('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason)
          this.isConnected = false
          this.emit('disconnected')
          
          // Attempt to reconnect if it wasn't a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', error)
          reject(error)
        }
      })
    } catch (error) {
      console.error('Error connecting:', error)
      throw error
    }
  }

  // Handle incoming messages
  handleMessage(message) {
    console.log('Received message:', message.type)
    
    switch (message.type) {
      case 'text_delta':
        // Partial text response from agent
        this.emit('response.audio_transcript.delta', {
          transcript: message.content
        })
        break

      case 'audio_delta':
        // Audio response chunk from agent
        this.playAudioChunk(message.data)
        this.emit('response.audio.delta', {
          audio: message.data
        })
        break

      case 'response_done':
        // Response complete
        this.emit('response.done')
        break

      case 'agent_switched':
        // Agent handoff occurred
        this.emit('agent.switched', {
          agent: message.agent
        })
        break

      case 'tool_call':
        // Tool/function call for visual feedback, step completion, etc.
        this.handleToolCall(message.function, message.arguments)
        break

      case 'error':
        // Error from backend
        console.error('Backend error:', message.message)
        this.emit('error', new Error(message.message))
        break

      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  // Handle tool calls from agents
  handleToolCall(functionName, args) {
    console.log('Tool call:', functionName, args)

    switch (functionName) {
      case 'update_notes':
        // Handle step completion
        if (args.steps && Array.isArray(args.steps)) {
          args.steps.forEach(step => {
            if (window.handleStepCompletion) {
              window.handleStepCompletion(
                step.stepNumber,
                step.description,
                step.updatedExpression
              )
            }
          })
        }
        break

      case 'show_visual_feedback':
        // Handle visual feedback
        if (window.handleVisualFeedback) {
          window.handleVisualFeedback(
            args.type,
            args.content,
            args.label,
            args.stepNumber,
            args.questionIndex
          )
        }
        break

      case 'show_intro_visual':
        // Handle introduction visual
        if (window.handleIntroVisual) {
          window.handleIntroVisual(
            args.content,
            args.label,
            args.explanation,
            args.type
          )
        }
        break

      case 'update_brainstorm_notes':
        // Handle brainstorm updates
        if (window.handleBrainstormUpdate) {
          window.handleBrainstormUpdate(
            args.discoveryType,
            args.studentIdeas || [],
            args.partSolved,
            args.currentExpression,
            args.approach,
            args.stepNumber,
            args.debateElements
          )
        }
        break
    }
  }

  // Set up audio capture
  async setupAudioCapture() {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        }
      })

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      })

      // Set up MediaRecorder for audio capture
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.processAudioChunks()
      }

      console.log('Audio capture setup complete')
    } catch (error) {
      console.error('Error setting up audio capture:', error)
      this.emit('error', error)
    }
  }

  // Process recorded audio chunks
  async processAudioChunks() {
    if (this.audioChunks.length === 0) return

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' })
      
      // Convert to ArrayBuffer and then to base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      
      // Send audio to backend
      this.sendMessage({
        type: 'audio',
        data: base64Audio
      })

      // Clear chunks
      this.audioChunks = []
    } catch (error) {
      console.error('Error processing audio chunks:', error)
    }
  }

  // Play audio chunk from agent
  async playAudioChunk(base64Audio) {
    try {
      if (!this.audioContext) return

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer)
      
      // Play audio
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()
    } catch (error) {
      console.error('Error playing audio chunk:', error)
    }
  }

  // Send message to backend
  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  // Send text message
  sendText(text) {
    this.sendMessage({
      type: 'text',
      content: text
    })
  }

  // Mute/unmute microphone
  mute(shouldMute) {
    this.isMuted = shouldMute
    
    if (shouldMute) {
      // Stop recording
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop()
        this.isRecording = false
      }
    } else {
      // Start recording
      if (this.mediaRecorder && !this.isRecording) {
        this.audioChunks = []
        this.mediaRecorder.start(100) // Collect data every 100ms
        this.isRecording = true
      }
    }
  }

  // Attempt to reconnect
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      await this.connect()
    } catch (error) {
      console.error('Reconnection failed:', error)
    }
  }

  // Disconnect
  async disconnect() {
    try {
      // Stop recording
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop()
        this.isRecording = false
      }

      // Close WebSocket
      if (this.ws) {
        this.ws.close(1000, 'Client disconnecting')
        this.ws = null
      }

      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close()
        this.audioContext = null
      }

      this.isConnected = false
      this.emit('disconnected')

      // Clean up session
      if (this.sessionId) {
        await fetch(`${ADK_HTTP_URL}/api/session/${this.sessionId}`, {
          method: 'DELETE'
        })
        this.sessionId = null
      }

      console.log('Disconnected from ADK backend')
    } catch (error) {
      console.error('Error during disconnect:', error)
      throw error
    }
  }
}