#!/bin/bash

echo "Starting ADK Tutoring Backend..."

# Check if we're in the project root
if [ ! -d "backend" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements if needed
echo "Installing Python dependencies..."
pip install -r requirements_simple.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please create one with GOOGLE_API_KEY"
fi

# Start the server
echo "Starting FastAPI server..."
python simple_main.py