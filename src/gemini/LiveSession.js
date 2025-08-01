/**
 * Gemini Live API WebSocket Session Manager
 * Handles real-time bidirectional communication with Google's Gemini Live API
 */

class GeminiLiveSession {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.sessionId = null
    this.eventListeners = new Map()
    
    // Audio context and processing
    this.audioContext = null
    this.mediaRecorder = null
    this.audioStream = null
    this.isMuted = true
    
    // Message queue for when connection is not ready
    this.messageQueue = []
    
    // Bind methods to preserve context
    this.onOpen = this.onOpen.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this.onError = this.onError.bind(this)
    this.onClose = this.onClose.bind(this)
  }

  /**
   * Connect to Gemini Live API
   * @param {Object} config - Connection configuration
   * @param {string} config.apiKey - Google AI API key
   * @param {string} config.model - Model to use (default: gemini-2.5-flash-preview-native-audio-dialog)
   */
  async connect(config) {
    if (this.isConnected) {
      throw new Error('Session already connected')
    }

    const { apiKey, model = 'gemini-2.0-flash-live-001' } = config

    if (!apiKey) {
      throw new Error('API key is required')
    }

    try {
      // Create WebSocket connection
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
      
      this.ws = new WebSocket(wsUrl)
      this.ws.addEventListener('open', this.onOpen)
      this.ws.addEventListener('message', this.onMessage)
      this.ws.addEventListener('error', this.onError)
      this.ws.addEventListener('close', this.onClose)

      // Wait for connection to be established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.ws.addEventListener('open', () => {
          clearTimeout(timeout)
          resolve()
        })

        this.ws.addEventListener('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Initialize session with configuration
      await this.initializeSession({
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      })

      // Initialize audio context
      await this.initializeAudio()

    } catch (error) {
      console.error('Failed to connect to Gemini Live API:', error)
      this.cleanup()
      throw error
    }
  }

  /**
   * Initialize WebSocket session with configuration
   */
  async initializeSession(config) {
    const setupMessage = {
      setup: {
        model: `models/${config.model}`,
        generationConfig: config.generationConfig,
        systemInstruction: {
          parts: [{
            text: "You are a helpful AI tutor. Provide clear, educational responses."
          }]
        }
      }
    }

    this.sendMessage(setupMessage)
  }

  /**
   * Initialize audio capture and playback
   */
  async initializeAudio() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      })

      // Get user media for microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      // Set up media recorder for audio streaming with fallback MIME types
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4'
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '' // Use default
            console.warn('No preferred MIME type supported, using default')
          }
        }
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, 
        mimeType ? { mimeType } : {}
      )

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !this.isMuted) {
          this.sendAudioData(event.data)
        }
      }

      // Start recording in small chunks for real-time streaming
      this.mediaRecorder.start(100) // 100ms chunks

    } catch (error) {
      console.error('Failed to initialize audio:', error)
      throw error
    }
  }

  /**
   * Send audio data to Gemini Live API
   */
  async sendAudioData(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioData = new Uint8Array(arrayBuffer)
      
      // Convert to base64 for transmission
      const base64Audio = btoa(String.fromCharCode(...audioData))
      
      const message = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: audioBlob.type,
            data: base64Audio
          }]
        }
      }

      this.sendMessage(message)
    } catch (error) {
      console.error('Failed to send audio data:', error)
    }
  }

  /**
   * Send a message through the WebSocket
   */
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // Queue message for when connection is ready
      this.messageQueue.push(message)
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

  /**
   * Handle WebSocket open event
   */
  onOpen() {
    console.log('Connected to Gemini Live API')
    this.isConnected = true
    
    // Send any queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.sendMessage(message)
    }

    this.emit('connected')
  }

  /**
   * Handle incoming WebSocket messages
   */
  onMessage(event) {
    try {
      // Check if event.data is a string before parsing
      if (typeof event.data !== 'string') {
        console.warn('Received non-string WebSocket message:', typeof event.data, event.data)
        return
      }

      // Handle empty or whitespace-only messages
      if (!event.data.trim()) {
        console.warn('Received empty WebSocket message')
        return
      }

      // Check if the message looks like JSON
      if (!event.data.trim().startsWith('{') && !event.data.trim().startsWith('[')) {
        console.warn('Received non-JSON WebSocket message:', event.data)
        return
      }

      const data = JSON.parse(event.data)
      
      // Validate that data is an object
      if (typeof data !== 'object' || data === null) {
        console.warn('Parsed data is not an object:', data)
        return
      }
      
      if (data.serverContent) {
        // Handle server content (audio responses)
        if (data.serverContent.modelTurn) {
          const parts = data.serverContent.modelTurn.parts
          
          if (Array.isArray(parts)) {
            parts.forEach(part => {
              if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                this.playAudioResponse(part.inlineData.data)
              }
              
              if (part.text) {
                this.emit('textResponse', part.text)
              }
            })
          }
        }
      }

      if (data.setupComplete) {
        console.log('Gemini Live API session setup complete')
        this.emit('setupComplete', data.setupComplete)
      }

      // Handle error responses from the server
      if (data.error) {
        console.error('Server error received:', data.error)
        this.emit('error', new Error(data.error.message || 'Server error'))
        return
      }

      // Emit raw message for debugging
      this.emit('message', data)

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
      console.error('Raw message data:', event.data)
      
      // Try to identify the error type for better debugging
      if (error instanceof SyntaxError) {
        console.error('JSON Syntax Error - the server may be sending invalid JSON')
      }
      
      this.emit('parseError', { error, rawData: event.data })
    }
  }

  /**
   * Play audio response from Gemini
   */
  async playAudioResponse(base64Audio) {
    try {
      // Convert base64 to audio buffer
      const audioData = atob(base64Audio)
      const audioArray = new Uint8Array(audioData.length)
      
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i)
      }

      // Create audio buffer and play
      const audioBuffer = await this.audioContext.decodeAudioData(audioArray.buffer)
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()

      this.emit('audioResponse', audioBuffer)

    } catch (error) {
      console.error('Failed to play audio response:', error)
    }
  }

  /**
   * Handle WebSocket error
   */
  onError(error) {
    console.error('Gemini Live API WebSocket error:', error)
    this.emit('error', error)
  }

  /**
   * Handle WebSocket close
   */
  onClose(event) {
    console.log('Gemini Live API connection closed:', event.code, event.reason)
    this.isConnected = false
    this.cleanup()
    this.emit('disconnected', event)
  }

  /**
   * Mute/unmute microphone
   */
  mute(muted = true) {
    this.isMuted = muted
    
    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach(track => {
        track.enabled = !muted
      })
    }
  }

  /**
   * Check if microphone is muted
   */
  isMicrophoneMuted() {
    return this.isMuted
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event).push(callback)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Close the WebSocket connection and cleanup resources
   */
  async close() {
    this.isConnected = false
    
    if (this.ws) {
      this.ws.close()
    }
    
    this.cleanup()
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }

    this.ws = null
    this.mediaRecorder = null
    this.audioStream = null
    this.audioContext = null
    this.messageQueue = []
  }
}

export { GeminiLiveSession }