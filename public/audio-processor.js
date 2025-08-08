/**
 * Audio Worklet Processor for real-time audio processing
 * Converts incoming audio to PCM16 format for the ADK backend
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 1024
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    
    if (input.length > 0) {
      const inputChannel = input[0]
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i]
        this.bufferIndex++
        
        // When buffer is full, send it to the main thread
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({
            type: 'audio',
            audio: new Float32Array(this.buffer)
          })
          
          this.bufferIndex = 0
        }
      }
    }
    
    // Keep the processor alive
    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)