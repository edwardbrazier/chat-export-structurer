# Chat Archive Web Application

Full-stack TypeScript application for searching and viewing AI chat archives.

## Architecture

- **Backend**: Node.js + TypeScript (Express API + MCP Server)
- **Frontend**: Angular 18 + Material Design
- **Database**: SQLite (keyword search) + Qdrant (semantic search)
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.10+
- Docker & Docker Compose (for containerized deployment)

### Local Development

#### Backend

```bash
cd backend
npm install
npm run dev:api
```

Backend runs on `http://localhost:5000`

#### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:4200`

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:5000`
- Qdrant: `http://localhost:6335`

## Features

### Search Modes

1. **Keyword Search**: Fast SQLite FTS5 full-text search
2. **Semantic Search**: AI-powered vector similarity via Qdrant
3. **Hybrid Search**: Combines both using Reciprocal Rank Fusion (RRF)

### Chat Viewer

- Message bubbles with role-based styling
- Markdown rendering with code highlighting
- Conversation metadata and timestamps
- Platform identification

## Project Structure

```
chat-export-structurer/
├── backend/
│   ├── src/
│   │   ├── api/           # REST API
│   │   ├── mcp/           # MCP Server
│   │   └── shared/        # Common types
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── core/      # Services
│   │       ├── features/  # Components
│   │       └── models/    # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── src/                   # Python scripts
├── my_chats.sqlite       # SQLite database
├── qdrant_storage/       # Qdrant data
└── docker-compose.yml
```

## API Documentation

### Search

```typescript
POST /api/v1/search
{
  "query": "machine learning",
  "mode": "hybrid",  // keyword | semantic | hybrid
  "limit": 10,
  "platforms": ["claude.ai"]  // optional
}
```

### Get Thread

```typescript
GET /api/v1/chats/:threadId
```

### List Threads

```typescript
GET /api/v1/chats?page=1&pageSize=20&platform=claude.ai
```

## MCP Server

The backend also functions as an MCP server for Claude Desktop.

### Configuration

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chat-archive": {
      "command": "node",
      "args": ["/absolute/path/to/backend/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "DATABASE_PATH": "/absolute/path/to/my_chats.sqlite",
        "QDRANT_HOST": "localhost",
        "QDRANT_PORT": "6335"
      }
    }
  }
}
```

### MCP Tools

- `search_chats`: Search conversations
- `get_chat`: Retrieve specific thread
- `list_chats`: List recent conversations

## Development

### Backend Development

```bash
cd backend
npm run dev:api  # API mode with hot reload
npm run dev:mcp  # MCP mode
```

### Frontend Development

```bash
cd frontend
npm start  # Development server on :4200
```

### Building

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Environment Variables

Create `.env` in the root directory:

```env
MODE=api
API_PORT=5000
DATABASE_PATH=./my_chats.sqlite
QDRANT_HOST=localhost
QDRANT_PORT=6335
QDRANT_COLLECTION=chat_messages
PYTHON_SCRIPTS_PATH=./src
```

## Technology Stack

### Backend
- **Express.js**: Web framework
- **better-sqlite3**: SQLite driver
- **@modelcontextprotocol/sdk**: MCP integration
- **TypeScript**: Type safety

### Frontend
- **Angular 18**: Framework
- **Angular Material**: UI components
- **ngx-markdown**: Markdown rendering
- **highlight.js**: Code syntax highlighting

### Infrastructure
- **Docker**: Containerization
- **Nginx**: Frontend web server
- **Qdrant**: Vector database

## License

See LICENSE file for details.
