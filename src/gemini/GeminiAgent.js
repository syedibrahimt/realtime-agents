/**
 * GeminiAgent - Base class for multi-agent tutoring system using Gemini Live API
 * Replaces OpenAI's RealtimeAgent functionality
 */

class GeminiAgent {
  constructor(config) {
    const {
      name,
      voice = 'Kore',
      handoffDescription = '',
      instructions = '',
      handoffs = [],
      systemInstructions = '',
      tools = []
    } = config

    this.name = name
    this.voice = voice
    this.handoffDescription = handoffDescription
    this.instructions = instructions
    this.handoffs = handoffs
    this.systemInstructions = systemInstructions
    this.tools = tools
    
    // Agent state
    this.isActive = false
    this.session = null
    this.eventListeners = new Map()
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this)
    this.handleAudioResponse = this.handleAudioResponse.bind(this)
    this.handleTextResponse = this.handleTextResponse.bind(this)
  }

  /**
   * Activate this agent in the session
   * @param {GeminiLiveSession} session - The live session instance
   */
  async activate(session) {
    if (this.isActive) {
      console.warn(`Agent ${this.name} is already active`)
      return
    }

    this.session = session
    this.isActive = true

    console.log(`🤖 Activating agent: ${this.name}`)

    // Set up event listeners
    this.session.addEventListener('message', this.handleMessage)
    this.session.addEventListener('audioResponse', this.handleAudioResponse)
    this.session.addEventListener('textResponse', this.handleTextResponse)

    // Send system instructions for this agent
    await this.updateSystemInstructions()

    // Send initial prompt if agent has instructions
    if (this.instructions) {
      await this.sendPrompt(this.instructions)
    }

    this.emit('activated', { agent: this.name })
  }

  /**
   * Deactivate this agent
   */
  async deactivate() {
    if (!this.isActive) {
      return
    }

    console.log(`🤖 Deactivating agent: ${this.name}`)

    this.isActive = false

    // Remove event listeners
    if (this.session) {
      this.session.removeEventListener('message', this.handleMessage)
      this.session.removeEventListener('audioResponse', this.handleAudioResponse)
      this.session.removeEventListener('textResponse', this.handleTextResponse)
    }

    this.emit('deactivated', { agent: this.name })
    
    this.session = null
  }

  /**
   * Update system instructions for this agent
   */
  async updateSystemInstructions() {
    if (!this.session) return

    const fullInstructions = this.buildSystemInstructions()
    
    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{
            text: `[SYSTEM] Agent: ${this.name}. ${fullInstructions}`
          }]
        }]
      }
    }

    this.session.sendMessage(message)
  }

  /**
   * Build complete system instructions for this agent
   */
  buildSystemInstructions() {
    let instructions = `You are the "${this.name}" agent in a multi-agent tutoring system. `
    
    if (this.handoffDescription) {
      instructions += `Your role: ${this.handoffDescription} `
    }

    if (this.systemInstructions) {
      instructions += `${this.systemInstructions} `
    }

    // Add handoff information
    if (this.handoffs && this.handoffs.length > 0) {
      const handoffNames = this.handoffs.map(agent => agent.name).join(', ')
      instructions += `When your task is complete, you can hand off to: ${handoffNames}. `
    }

    instructions += `Always speak in English. Be encouraging and supportive in your tone.`

    return instructions
  }

  /**
   * Send a text prompt to the model
   */
  async sendPrompt(text) {
    if (!this.session || !this.isActive) {
      console.warn(`Cannot send prompt: Agent ${this.name} is not active`)
      return
    }

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{
            text: text
          }]
        }]
      }
    }

    this.session.sendMessage(message)
  }

  /**
   * Handle incoming messages from the session
   */
  handleMessage(data) {
    if (!this.isActive) return

    // Process message and check for handoff signals
    this.processMessage(data)
  }

  /**
   * Handle audio responses
   */
  handleAudioResponse(audioBuffer) {
    if (!this.isActive) return
    
    this.emit('audioResponse', { 
      agent: this.name, 
      audioBuffer 
    })
  }

  /**
   * Handle text responses
   */
  handleTextResponse(text) {
    if (!this.isActive) return
    
    console.log(`📝 ${this.name} text response:`, text)
    
    // Check if response indicates completion or handoff
    this.checkForHandoff(text)
    
    this.emit('textResponse', { 
      agent: this.name, 
      text 
    })
  }

  /**
   * Process incoming messages for agent-specific logic
   */
  processMessage(data) {
    // Override in subclasses for agent-specific message processing
    this.emit('message', { agent: this.name, data })
  }

  /**
   * Check if the response indicates this agent should hand off to another
   */
  checkForHandoff(text) {
    // Simple handoff detection - can be enhanced with more sophisticated logic
    const handoffKeywords = [
      'hand off',
      'handoff', 
      'next agent',
      'proceed to',
      'moving to',
      'completed',
      'finished'
    ]

    const shouldHandoff = handoffKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    )

    if (shouldHandoff && this.handoffs.length > 0) {
      // For now, hand off to the first available agent
      // This can be enhanced with more intelligent handoff logic
      setTimeout(() => {
        this.performHandoff(this.handoffs[0])
      }, 1000) // Small delay to allow current response to complete
    }
  }

  /**
   * Perform handoff to another agent
   */
  async performHandoff(nextAgent) {
    if (!nextAgent || !this.isActive) return

    console.log(`🔄 ${this.name} handing off to ${nextAgent.name}`)

    this.emit('handoff', { 
      fromAgent: this.name, 
      toAgent: nextAgent.name,
      nextAgent: nextAgent
    })

    // Deactivate current agent
    await this.deactivate()
  }

  /**
   * Force handoff to a specific agent (for manual control)
   */
  async forceHandoff(nextAgent) {
    if (!nextAgent) return

    console.log(`🔄 Force handoff: ${this.name} -> ${nextAgent.name}`)
    
    await this.performHandoff(nextAgent)
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
          console.error(`Error in ${this.name} agent event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      isActive: this.isActive,
      hasSession: !!this.session,
      handoffOptions: this.handoffs.map(agent => agent.name)
    }
  }
}

/**
 * GeminiAgentManager - Manages multiple agents and their handoffs
 */
class GeminiAgentManager {
  constructor(session) {
    this.session = session
    this.agents = new Map()
    this.currentAgent = null
    this.eventListeners = new Map()
  }

  /**
   * Register an agent with the manager
   */
  registerAgent(agent) {
    this.agents.set(agent.name, agent)
    
    // Listen for handoffs from this agent
    agent.addEventListener('handoff', (data) => {
      this.handleAgentHandoff(data)
    })

    console.log(`📋 Registered agent: ${agent.name}`)
  }

  /**
   * Start with a specific agent
   */
  async startWithAgent(agentName) {
    const agent = this.agents.get(agentName)
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`)
    }

    if (this.currentAgent) {
      await this.currentAgent.deactivate()
    }

    this.currentAgent = agent
    await agent.activate(this.session)

    this.emit('agentChanged', { 
      previousAgent: null, 
      currentAgent: agentName 
    })
  }

  /**
   * Handle agent handoffs
   */
  async handleAgentHandoff(data) {
    const { fromAgent, toAgent, nextAgent } = data
    
    console.log(`🔄 Agent Manager: Handling handoff ${fromAgent} -> ${toAgent}`)

    this.currentAgent = nextAgent
    await nextAgent.activate(this.session)

    this.emit('agentChanged', { 
      previousAgent: fromAgent, 
      currentAgent: toAgent 
    })
  }

  /**
   * Get current agent
   */
  getCurrentAgent() {
    return this.currentAgent
  }

  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.values())
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
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in agent manager event listener for ${event}:`, error)
        }
      })
    }
  }
}

export { GeminiAgent, GeminiAgentManager }