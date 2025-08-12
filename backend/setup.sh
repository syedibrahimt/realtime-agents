#!/bin/bash

# ADK Backend Setup Script
set -e

echo "🚀 Setting up ADK Backend..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "📝 Please edit the .env file and add your Google API key:"
    echo "   GOOGLE_API_KEY=your_google_ai_api_key_here"
    echo ""
    echo "You can get an API key from: https://ai.google.dev/"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "✅ ADK Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Google API key"
echo "2. Run: source venv/bin/activate"
echo "3. Run: python main.py"
echo ""