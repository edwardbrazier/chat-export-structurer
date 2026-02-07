# MCP Server - ChatGPT Setup Guide

This guide shows how to use the Chat Archive MCP server with ChatGPT Developer Mode.

## Quick Start

### 1. Start the HTTP Server

```bash
cd backend
npm run dev:mcp:http
```

You should see:
```
MCP HTTP server: http://127.0.0.1:3001/mcp
Health check: http://127.0.0.1:3001/health
```

### 2. Configure ChatGPT

1. Open ChatGPT
2. Go to **Settings** → **Developer Mode** (Beta)
3. Click **Add MCP Connector**
4. Enter the URL: `http://localhost:3001/mcp`
5. Save the configuration

### 3. Start Searching!

In ChatGPT, you can now use commands like:

- "Search my chat archive for conversations about Python"
- "Find discussions about machine learning in my archived chats"
- "Fetch conversation with thread ID abc123..."

## Available Tools

### `search` - Search Conversations

Search your archived AI conversations using keyword, semantic, or hybrid search.

**Parameters:**
- `query` (string, required): What to search for
- `mode` (string, optional): Search mode
  - `keyword` - Fast text search (SQLite FTS)
  - `semantic` - Meaning-based search (Qdrant vectors)
  - `hybrid` - Best of both (default)
- `platforms` (array, optional): Filter by platform
  - Example: `["claude.ai", "chatgpt"]`
- `limit` (number, optional): Max results (default: 5)

**Example responses:**
```
Found 3 conversations (45ms):

**Python Data Processing** (claude.ai)
Score: 0.876 | Source: hybrid | Messages: 24
Date: 2024-01-15 to 2024-01-15
Preview: How can I efficiently process large CSV files in Python using pandas...
Thread ID: 972aedd36cc4a14ecacc353e459b7b914003414e
```

### `fetch` - Get Full Conversation

Retrieve the complete conversation by thread ID.

**Parameters:**
- `threadId` (string, required): Thread ID from search results

**Example response:**
```
# Python Data Processing

Platform: claude.ai
Messages: 24
Date Range: 2024-01-15 10:23:45 to 2024-01-15 11:45:23

---

**USER** (2024-01-15 10:23:45):
How can I efficiently process large CSV files in Python?

**ASSISTANT** (2024-01-15 10:24:12):
Here are several efficient approaches for processing large CSV files...
```

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Use HTTP transport for ChatGPT
MCP_TRANSPORT=http

# HTTP server settings
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PATH=/mcp

# Database location
DATABASE_PATH=../my_chats.sqlite
```

### Security Notes

- **Localhost only**: By default, the server binds to `127.0.0.1` (localhost only)
- **No remote access**: Cannot be accessed from other machines
- **DNS protection**: Built-in protection against DNS rebinding attacks
- **No authentication**: Assumes local, trusted environment

For remote access (not recommended for personal data):
```bash
MCP_HTTP_HOST=0.0.0.0
MCP_ALLOWED_HOSTS=your-hostname.com,another-allowed.com
```

## Troubleshooting

### Server won't start

**Check if port is in use:**
```bash
lsof -i :3001
```

**Use a different port:**
```bash
MCP_HTTP_PORT=3002 npm run dev:mcp:http
```

### ChatGPT can't connect

1. **Verify server is running:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","server":"chat-archive-mcp"}`

2. **Check URL in ChatGPT:**
   - Must be exactly: `http://localhost:3001/mcp`
   - No trailing slash
   - Must include `/mcp` path

3. **Restart ChatGPT** after adding the connector

### Search returns no results

1. **Check database exists:**
   ```bash
   ls -lh ../my_chats.sqlite
   ```

2. **Verify Qdrant is running** (for semantic search):
   ```bash
   curl http://localhost:6335/healthz
   ```

3. **Try keyword-only search** to isolate issues:
   - In ChatGPT: "Search my chats for 'python' using keyword mode"

### Tools not appearing in ChatGPT

1. **Verify tools are registered:**
   ```bash
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

2. **Remove and re-add** the MCP connector in ChatGPT

3. **Check ChatGPT Developer Mode is enabled** (Beta feature)

## Production Deployment

For production use:

```bash
# Build TypeScript
npm run build

# Start in production mode
npm run start:mcp:http
```

Consider using a process manager like PM2:
```bash
pm2 start npm --name "mcp-server" -- run start:mcp:http
pm2 save
```

## Claude Desktop vs ChatGPT

The same server supports both clients with different transports:

| Feature | Claude Desktop | ChatGPT |
|---------|---------------|---------|
| Transport | Stdio | HTTP (SSE) |
| Port | N/A | 3001 |
| Command | `npm run dev:mcp:stdio` | `npm run dev:mcp:http` |
| Config location | `~/.config/claude/` | ChatGPT Settings |
| Tools | `search`, `fetch` | `search`, `fetch` |

To run both simultaneously:
```bash
npm run dev:mcp:both
```

## Migration from Old Tool Names

If you were using the previous MCP server:

| Old Name | New Name | Changes |
|----------|----------|---------|
| `search_chats` | `search` | No parameter changes |
| `get_chat` | `fetch` | No parameter changes |
| `list_chats` | *(removed)* | Use REST API instead |

Update any saved ChatGPT instructions or workflows to use the new tool names.

## Support

For issues or questions:
1. Check the main [backend README](./README.md)
2. Run the test suite: `./test-mcp-transports.sh`
3. Report issues on GitHub: https://github.com/anthropics/claude-code/issues
