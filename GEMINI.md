
# Gemini Live API Migration

This document provides context for the project migration from OpenAI Realtime API to Google Gemini Live API.

## Project Overview

This is a web application built with **React** and **Vite**. It is an AI-powered tutoring application that has been **migrated from OpenAI's Realtime API to Google's Gemini Live API** for real-time, interactive tutoring sessions with voice communication.

## Key Technologies

*   **Frontend:** React.js
*   **Build Tool:** Vite
*   **Realtime AI:** Google Gemini Live API (WebSocket-based)
*   **Agent Framework:** Custom GeminiAgent system
*   **Styling:** Custom CSS

## Core Functionality

*   **AI Tutoring Session:** The application connects to Google's Gemini Live API for real-time, interactive voice tutoring sessions.
*   **Agent-based Architecture:** The tutoring logic is modularized into several agents built on the custom GeminiAgent framework:
    *   `greeterAgent`: Initiates the conversation and welcomes students.
    *   `introGiverAgent`: Provides concept introduction with visual aids.
    *   `questionReaderAgent`: Presents problems and questions to students.
    *   `stepTutorAgent`: Guides through step-by-step problem solving with visual feedback.
    *   `brainStormerAgent`: Facilitates discovery learning through ASK → EXPLORE → CONNECT framework.
    *   `closerAgent`: Concludes the tutoring session with encouragement.
*   **Visual Feedback:** The UI displays visual cues (e.g., success messages, hints, illustrations) based on agent responses.
*   **Notes Area:** Shows problem statement, user progress, and completed steps with real-time updates.
*   **Push-to-Talk:** Uses spacebar for voice communication with muted-by-default microphone.

## Migration Details

### What Changed
- **Replaced** `@openai/agents-realtime` with custom Gemini Live API implementation
- **Created** `GeminiLiveSession` class for WebSocket communication
- **Built** `GeminiAgent` and `GeminiAgentManager` classes for agent management
- **Updated** all agents to use new framework with trigger-word based tool calling
- **Migrated** to Google's native audio models for better voice interaction

### New Architecture
- **WebSocket Connection:** Direct connection to `wss://generativelanguage.googleapis.com/ws/...`
- **Audio Handling:** 16kHz input, 24kHz output with real-time streaming
- **Tool System:** Agents use trigger phrases like "showVisualFeedback", "updateNotes" for UI interactions
- **Agent Flow:** Maintains same logical flow with improved handoff system

## Project Structure

*   `public/`: Static assets.
*   `src/`: Main application source code.
    *   `agents/tutor/`: Migrated AI agent modules using GeminiAgent.
    *   `gemini/`: New Gemini Live API implementation
        *   `LiveSession.js`: WebSocket session manager
        *   `GeminiAgent.js`: Base agent class and manager
    *   `App.jsx`: Updated main React component.
    *   `main.jsx`: Application entry point.
*   `env.js`: Updated for Gemini API key configuration.
*   `package.json`: Updated dependencies (removed OpenAI, added @google/genai).
*   `vite.config.js`: Vite configuration file.

## Setup Instructions

1. **Get Gemini API Key:** Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Update env.js:** Replace `YOUR_GEMINI_API_KEY_HERE` with your actual API key
3. **Install Dependencies:** `npm install`
4. **Run Development Server:** `npm run dev`
