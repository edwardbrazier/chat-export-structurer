# Chat Archive Backend

TypeScript backend for the Chat Archive application, providing both a REST API and MCP server.

## Features

- **REST API**: Express-based API for web frontend
- **MCP Server**: Model Context Protocol server for Claude Desktop integration
- **Dual Search**: SQLite FTS5 keyword search + Qdrant semantic search
- **Hybrid Search**: RRF (Reciprocal Rank Fusion) algorithm

## Installation

```bash
npm install
```

## Development

Run in API mode:
```bash
npm run dev:api
```

Run in MCP mode:
```bash
npm run dev:mcp
```

## Production

Build TypeScript:
```bash
npm run build
```

Start API server:
```bash
npm run start:api
```

Start MCP server:
```bash
npm run start:mcp
```

## API Endpoints

- `GET /api/v1/chats` - List threads (paginated)
- `GET /api/v1/chats/:threadId` - Get thread with messages
- `POST /api/v1/search` - Hybrid search
- `POST /api/v1/search/keyword` - Keyword search only
- `POST /api/v1/search/semantic` - Semantic search only
- `GET /api/v1/chats/stats/overview` - Archive statistics

## MCP Integration

Add to Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chat-archive": {
      "command": "node",
      "args": ["/path/to/backend/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "DATABASE_PATH": "/path/to/my_chats.sqlite"
      }
    }
  }
}
```

## Environment Variables

See `.env.example` for configuration options.
