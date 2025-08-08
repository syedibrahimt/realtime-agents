/**
 * WebSocket client for communicating with Google ADK backend
 * Replaces the OpenAI Realtime Agents SDK functionality
 */

export class AdkWebSocketClient {
  constructor() {
    this.ws = null
    this.sessionId = null
    this.isConnected = false
    this.isMuted = true
    this.listeners = new Map()
    
    // Audio recording setup
    this.audioContext = null
    this.mediaStream = null
    this.audioWorklet = null
    this.isRecording = false
  }
  
  /**
   * Connect to the ADK WebSocket backend
   */
  async connect({ backendUrl }) {
    if (this.isConnected) {
      throw new Error("Already connected")
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(backendUrl)
        
        this.ws.onopen = async () => {
          console.log("WebSocket connected to ADK backend")
          this.isConnected = true
          
          // Initialize audio context
          await this._initializeAudio()
          
          // Send session initialization
          this._send({
            type: "init_session",
            data: {}
          })
          
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this._handleMessage(message)
          } catch (error) {
            console.error("Error parsing WebSocket message:", error)
          }
        }
        
        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          reject(error)
        }
        
        this.ws.onclose = () => {
          console.log("WebSocket connection closed")
          this.isConnected = false
          this.sessionId = null
          this._cleanup()
          this._emit("disconnect")
        }
        
      } catch (error) {
        reject(error)
      }
    })
  }
  
  /**
   * Close the WebSocket connection
   */
  async close() {
    if (!this.isConnected) return
    
    // End session first
    if (this.sessionId) {
      this._send({
        type: "end_session",
        session_id: this.sessionId
      })
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close()
    }
    
    this._cleanup()
  }
  
  /**
   * Mute or unmute the microphone
   */
  mute(shouldMute) {
    this.isMuted = shouldMute
    
    if (shouldMute) {
      this._stopRecording()
    } else {
      this._startRecording()
    }
  }
  
  /**
   * Send text message to the agent
   */
  sendText(text) {
    if (!this.isConnected || !this.sessionId) {
      throw new Error("Not connected or session not initialized")
    }
    
    this._send({
      type: "text_message",
      session_id: this.sessionId,
      data: { text }
    })
  }
  
  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }
  
  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
  
  /**
   * Initialize audio recording capabilities
   */
  async _initializeAudio() {
    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      })
      
      // Load audio worklet for processing
      await this.audioContext.audioWorklet.addModule('/audio-processor.js')
      
      // Create audio worklet node
      this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor')
      
      // Handle processed audio data
      this.audioWorklet.port.onmessage = (event) => {
        if (event.data.type === 'audio' && !this.isMuted) {
          this._sendAudioData(event.data.audio)
        }
      }
      
      // Connect audio pipeline
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.audioWorklet)
      
    } catch (error) {
      console.error("Error initializing audio:", error)
      throw error
    }
  }
  
  /**
   * Start recording audio
   */
  _startRecording() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    this.isRecording = true
  }
  
  /**
   * Stop recording audio
   */
  _stopRecording() {
    this.isRecording = false
  }
  
  /**
   * Send audio data to backend
   */
  _sendAudioData(audioData) {
    if (!this.isConnected || !this.sessionId || this.isMuted) return
    
    // Convert Float32Array to base64
    const buffer = new ArrayBuffer(audioData.length * 2)
    const view = new DataView(buffer)
    
    for (let i = 0; i < audioData.length; i++) {
      // Convert float32 to int16
      const sample = Math.max(-1, Math.min(1, audioData[i]))
      view.setInt16(i * 2, sample * 0x7FFF, true)
    }
    
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    
    this._send({
      type: "audio_data",
      session_id: this.sessionId,
      data: {
        audio_base64: base64Audio,
        format: "pcm16",
        sample_rate: 24000
      }
    })
  }
  
  /**
   * Send message to WebSocket
   */
  _send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  _handleMessage(message) {
    const { type, data, session_id } = message
    
    switch (type) {
      case "connection_status":
        if (data?.status === "connected") {
          this._emit("connected")
        }
        break
        
      case "session_created":
        this.sessionId = session_id
        console.log("Session created:", session_id)
        break
        
      case "agent_response":
        this._handleAgentResponse(data)
        break
        
      case "visual_feedback":
        this._handleVisualFeedback(data)
        break
        
      case "step_completion":
        this._handleStepCompletion(data)
        break
        
      case "agent_handoff":
        console.log("Agent handoff:", data)
        this._emit("agent_handoff", data)
        break
        
      case "session_ended":
        console.log("Session ended")
        this.sessionId = null
        break
        
      case "error":
        console.error("Backend error:", data)
        this._emit("error", data)
        break
        
      default:
        console.log("Unknown message type:", type, data)
    }
  }
  
  /**
   * Handle agent responses (text and audio)
   */
  _handleAgentResponse(data) {
    const { response_type, content, audio_base64 } = data
    
    if (response_type === "text" && content) {
      // Handle text response
      console.log("Agent text response:", content)
    }
    
    if (response_type === "audio" && audio_base64) {
      // Play audio response
      this._playAudioResponse(audio_base64)
    }
    
    this._emit("agent_response", data)
  }
  
  /**
   * Handle visual feedback
   */
  _handleVisualFeedback(data) {
    // Trigger frontend visual feedback system
    if (typeof window !== "undefined" && window.handleVisualFeedback) {
      const { type, content, label, step_number, question_index } = data
      window.handleVisualFeedback(type, content, label, step_number, question_index)
    }
    
    // Also handle intro visuals
    if (data.type === "intro" && typeof window !== "undefined" && window.handleIntroVisual) {
      const { content, label, explanation, contentType } = data
      window.handleIntroVisual(content, label, explanation, contentType)
    }
    
    this._emit("visual_feedback", data)
  }
  
  /**
   * Handle step completion
   */
  _handleStepCompletion(data) {
    // Trigger frontend step completion system
    if (typeof window !== "undefined" && window.handleStepCompletion) {
      if (Array.isArray(data)) {
        // Multiple steps completed
        data.forEach(step => {
          window.handleStepCompletion(
            step.step_number,
            step.description,
            step.updated_expression
          )
        })
      } else {
        // Single step completed
        window.handleStepCompletion(
          data.step_number,
          data.description,
          data.updated_expression
        )
      }
    }
    
    this._emit("step_completion", data)
  }
  
  /**
   * Play audio response from agent
   */
  async _playAudioResponse(base64Audio) {
    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio)
      const arrayBuffer = new ArrayBuffer(binaryString.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }
      
      // Create audio buffer and play
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()
      
    } catch (error) {
      console.error("Error playing audio response:", error)
    }
  }
  
  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error("Error in event listener:", error)
        }
      })
    }
  }
  
  /**
   * Cleanup resources
   */
  _cleanup() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    if (this.audioWorklet) {
      this.audioWorklet.disconnect()
      this.audioWorklet = null
    }
    
    this.isRecording = false
    this.isMuted = true
  }
}