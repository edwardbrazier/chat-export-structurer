# Chat Archive Web Application - Setup Guide

Complete setup guide for the full-stack TypeScript chat archive application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Setup](#docker-setup)
4. [MCP Server Setup](#mcp-server-setup)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Python 3.10+** - For Qdrant semantic search scripts
- **SQLite database** - `my_chats.sqlite` with chat data

### Optional (for Docker)

- **Docker** - [Download](https://docs.docker.com/get-docker/)
- **Docker Compose** - Usually bundled with Docker Desktop

### Python Dependencies

```bash
pip install qdrant-client sentence-transformers
```

## Local Development Setup

### 1. Clone and Setup

```bash
cd /home/edward/chat-export-structurer
```

### 2. Backend Setup

```bash
cd backend
npm install
npm run build
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Environment Configuration

Copy `.env.example` to `.env` and adjust paths:

```bash
cp .env.example .env
```

Edit `.env`:
```env
MODE=api
API_PORT=5000
API_HOST=0.0.0.0
DATABASE_PATH=../my_chats.sqlite
QDRANT_HOST=localhost
QDRANT_PORT=6335
QDRANT_COLLECTION=chat_messages
PYTHON_SCRIPTS_PATH=../src
```

### 5. Start Qdrant

#### Option A: Docker
```bash
docker run -d -p 6335:6333 \
  -v ./qdrant_storage:/qdrant/storage \
  --name qdrant \
  qdrant/qdrant:latest
```

#### Option B: Local Installation
Follow [Qdrant installation guide](https://qdrant.tech/documentation/quick-start/)

### 6. Start Backend

```bash
cd backend
npm run dev:api
```

Backend runs on `http://localhost:5000`

Test: `curl http://localhost:5000/health`

### 7. Start Frontend

```bash
cd frontend
npm start
```

Frontend runs on `http://localhost:4200`

Open browser: `http://localhost:4200`

## Docker Setup

### Build and Run All Services

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check status
docker-compose ps
```

### Services

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:5000
- **Qdrant**: http://localhost:6335

### Stop Services

```bash
docker-compose down

# Remove volumes
docker-compose down -v
```

## MCP Server Setup

### 1. Build Backend

```bash
cd backend
npm run build
```

### 2. Configure Claude Desktop

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chat-archive": {
      "command": "node",
      "args": ["/home/edward/chat-export-structurer/backend/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "DATABASE_PATH": "/home/edward/chat-export-structurer/my_chats.sqlite",
        "QDRANT_HOST": "localhost",
        "QDRANT_PORT": "6335",
        "QDRANT_COLLECTION": "chat_messages",
        "PYTHON_SCRIPTS_PATH": "/home/edward/chat-export-structurer/src"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The MCP server will start automatically when Claude Desktop launches.

### 4. Test MCP Tools

In Claude Desktop, try:
- "Search my chats for machine learning"
- "List my recent conversations"
- "Show me the chat with thread ID abc123"

### Available MCP Tools

1. **search_chats**
   - Searches conversations with keyword/semantic/hybrid modes
   - Returns relevant threads with scores

2. **get_chat**
   - Retrieves full conversation by thread ID
   - Shows all messages in chronological order

3. **list_chats**
   - Lists recent conversations
   - Optional platform filtering

## Testing

### Backend API Tests

```bash
# Start backend first
cd backend
npm run dev:api

# In another terminal
./test-backend.sh
```

### Manual API Tests

```bash
# Health check
curl http://localhost:5000/health

# Get stats
curl http://localhost:5000/api/v1/chats/stats/overview | jq

# List chats
curl "http://localhost:5000/api/v1/chats?page=1&pageSize=5" | jq

# Search
curl -X POST http://localhost:5000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "mode": "hybrid", "limit": 5}' | jq
```

### Frontend Tests

Open browser to `http://localhost:4200` and:

1. Enter a search query
2. Select search mode (keyword/semantic/hybrid)
3. Click Search
4. Click on a result to view the full conversation

## Troubleshooting

### Backend won't start

**Error: Cannot find module**
```bash
cd backend
npm install
npm run build
```

**Error: Database not found**
- Check `DATABASE_PATH` in `.env`
- Ensure `my_chats.sqlite` exists

**Error: Python script failed**
- Install Python dependencies: `pip install qdrant-client sentence-transformers`
- Check `PYTHON_SCRIPTS_PATH` in `.env`

### Qdrant connection errors

**Connection refused**
```bash
# Check if Qdrant is running
curl http://localhost:6335/collections

# Start Qdrant
docker run -d -p 6335:6333 qdrant/qdrant:latest
```

**Collection not found**
- Ensure you've run the embedding script to create the collection
- Check collection name matches in `.env`

### Frontend won't connect to backend

**CORS errors**
- Backend should have CORS enabled (already configured)
- Check backend is running on port 5000
- Check environment.ts has correct API URL

**404 errors**
- Verify backend routes match service calls
- Check browser console for actual API calls

### MCP Server issues

**MCP server not appearing in Claude Desktop**
- Check config file path: `~/.config/claude/claude_desktop_config.json`
- Verify absolute paths (not relative)
- Check backend was built: `ls backend/dist/index.js`
- Restart Claude Desktop

**MCP tools fail**
- Check Claude Desktop logs
- Test backend in API mode first
- Ensure database and Qdrant are accessible

### Docker issues

**Port conflicts**
```bash
# Check what's using port 5000
lsof -i :5000

# Stop conflicting service or change ports in docker-compose.yml
```

**Build failures**
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Performance Tips

### Keyword Search
- Very fast (< 50ms)
- Good for exact terms
- Best for known keywords

### Semantic Search
- Slower (500-2000ms)
- Understands meaning
- Better for concepts

### Hybrid Search
- Moderate speed (600-2500ms)
- Best results
- Recommended default

## Next Steps

1. **Customize UI**: Edit Angular components in `frontend/src/app/features/`
2. **Add Filters**: Extend search with date ranges, platforms
3. **Improve Ranking**: Tune RRF parameters in `search.service.ts`
4. **Add Authentication**: Secure the API for multi-user deployments
5. **Analytics**: Track search queries and popular conversations

## Support

For issues or questions:
- Check this guide's troubleshooting section
- Review backend logs: `docker-compose logs backend`
- Review frontend logs in browser console
- Check Qdrant status: `curl http://localhost:6335/collections`
