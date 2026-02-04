#!/bin/bash

set -e

echo "=================================="
echo "Chat Archive Quick Start"
echo "=================================="
echo

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Please install Node.js 20+"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found. Please install npm"; exit 1; }

echo "✅ Prerequisites check passed"
echo

# Backend setup
echo "📦 Setting up backend..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

if [ ! -d "dist" ]; then
    echo "   Building TypeScript..."
    npm run build
fi
cd ..
echo "✅ Backend ready"
echo

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies (this may take a few minutes)..."
    npm install
fi
cd ..
echo "✅ Frontend ready"
echo

# Check for Qdrant
echo "🔍 Checking Qdrant..."
if ! curl -s http://localhost:6335/collections >/dev/null 2>&1; then
    echo "⚠️  Qdrant not running on port 6335"
    echo "   Start Qdrant with: docker run -d -p 6335:6333 qdrant/qdrant:latest"
    echo "   Or continue without semantic search (keyword-only mode will work)"
    echo
else
    echo "✅ Qdrant is running"
    echo
fi

# Check for database
if [ ! -f "my_chats.sqlite" ]; then
    echo "⚠️  Database not found: my_chats.sqlite"
    echo "   Please ensure your SQLite database exists in this directory"
    exit 1
fi
echo "✅ Database found"
echo

# Environment setup
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env 2>/dev/null || cat > .env <<EOF
MODE=api
API_PORT=5000
API_HOST=0.0.0.0
DATABASE_PATH=./my_chats.sqlite
QDRANT_HOST=localhost
QDRANT_PORT=6335
QDRANT_COLLECTION=chat_messages
PYTHON_SCRIPTS_PATH=./src
EOF
    echo "✅ .env created"
else
    echo "✅ .env exists"
fi
echo

echo "=================================="
echo "🚀 Ready to start!"
echo "=================================="
echo
echo "To start the application:"
echo
echo "1. Terminal 1 - Backend API:"
echo "   cd backend && npm run dev:api"
echo
echo "2. Terminal 2 - Frontend:"
echo "   cd frontend && npm start"
echo
echo "3. Open browser:"
echo "   http://localhost:4200"
echo
echo "=================================="
echo
echo "For Docker deployment:"
echo "   docker-compose up -d"
echo
echo "For MCP server setup:"
echo "   See SETUP_GUIDE.md section 'MCP Server Setup'"
echo
echo "=================================="
