#!/bin/bash
# Local development starter script for SmartPrior-AI

echo "🚀 Starting SmartPrior-AI Development Environment..."

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Run Docker services if docker-compose available
if command -v docker-compose &> /dev/null; then
    echo "🐳 Starting PostgreSQL via Docker Compose..."
    docker-compose -f docker/docker-compose.yml up -d postgres
fi

# Start frontend and backend concurrently
npm run dev:backend &
npm run dev:frontend &

wait
