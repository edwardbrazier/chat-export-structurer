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

## MCP Server Transports

The MCP server supports multiple transport modes for different clients:

### Stdio Transport (Claude Desktop)

For Claude Desktop integration using stdio communication:

```bash
# Development
npm run dev:mcp:stdio

# Production
npm run start:mcp:stdio
```

**Claude Desktop Configuration** (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chat-archive": {
      "command": "node",
      "args": ["/path/to/backend/dist/index.js"],
      "env": {
        "MODE": "mcp",
        "MCP_TRANSPORT": "stdio",
        "DATABASE_PATH": "/path/to/my_chats.sqlite"
      }
    }
  }
}
```

### HTTP Transport (ChatGPT)

For ChatGPT Developer Mode using Server-Sent Events (SSE) / Streamable HTTP:

```bash
# Development
npm run dev:mcp:http

# Production
npm run start:mcp:http
```

**ChatGPT Configuration**:
1. Open ChatGPT Developer Mode settings
2. Add MCP connector: `http://localhost:3001/mcp`
3. The `search` and `fetch` tools will be available

**Environment Variables**:
```bash
MCP_TRANSPORT=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PATH=/mcp
```

### Both Transports Simultaneously

Run both stdio and HTTP transports for testing or dual-client usage:

```bash
npm run dev:mcp:both
```

### Available MCP Tools

Both transports expose the same tools:

- **`search`** - Search archived AI conversations
  - Parameters:
    - `query` (string, required): Search query
    - `mode` (string, optional): `keyword`, `semantic`, or `hybrid` (default)
    - `platforms` (array, optional): Filter by platforms (e.g., `["claude.ai", "chatgpt"]`)
    - `limit` (number, optional): Maximum results (default: 5)

- **`fetch`** - Retrieve a specific conversation by thread ID
  - Parameters:
    - `threadId` (string, required): The thread ID to retrieve

### Transport Configuration

Configure transport mode via environment variables:

```bash
# Stdio only (default, Claude Desktop)
MCP_TRANSPORT=stdio

# HTTP only (ChatGPT)
MCP_TRANSPORT=http

# Both transports
MCP_TRANSPORT=both
```

**HTTP Transport Settings**:
- Default port: `3001` (separate from REST API port 5000)
- Default host: `127.0.0.1` (localhost-only for security)
- Health check: `GET http://localhost:3001/health`
- DNS rebinding protection enabled by default

**Security Note**: The HTTP transport binds to localhost by default. To allow remote access, set `MCP_HTTP_HOST=0.0.0.0` and configure `MCP_ALLOWED_HOSTS` with comma-separated allowed hostnames.

## API Endpoints

- `GET /api/v1/chats` - List threads (paginated)
- `GET /api/v1/chats/:threadId` - Get thread with messages
- `POST /api/v1/search` - Hybrid search
- `POST /api/v1/search/keyword` - Keyword search only
- `POST /api/v1/search/semantic` - Semantic search only
- `GET /api/v1/chats/stats/overview` - Archive statistics

## Environment Variables

See `.env.example` for all configuration options.
