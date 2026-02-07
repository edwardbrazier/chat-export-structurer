# Getting Started Guide

**Quick start guide to get your chat archive up and running in 3 steps.**

## Overview

This system gives you searchable access to your AI chat history through:
1. **SQLite database** - Structured storage for all your conversations
2. **Qdrant vector database** - Semantic search using AI embeddings (all local)
3. **Web application** - Beautiful interface to search and browse your chats

**Privacy First:** Everything runs locally on your computer. No data leaves your machine.

---

## Prerequisites

- Python 3.8+
- Node.js 18+
- Docker (for Qdrant)

---

## Step 1: Import Your Chats → SQLite

### Export your data from AI platforms:

**ChatGPT:**
- Settings → Data controls → Export data → Download `conversations.json`

**Claude (Anthropic):**
- Settings → Export data

**Grok (X.AI):**
- Settings → Export conversations

### Import to SQLite database:

```bash
# ChatGPT export
python src/ingest.py \
  --in path/to/conversations.json \
  --db my_chats.sqlite \
  --format chatgpt

# Claude export
python src/ingest.py \
  --in path/to/claude_export.json \
  --db my_chats.sqlite \
  --format anthropic

# Grok export
python src/ingest.py \
  --in path/to/grok_export.json \
  --db my_chats.sqlite \
  --format grok
```

**Result:** Your chats are now in `my_chats.sqlite` (structured, searchable data)

---

## Step 2: Vectorize → Qdrant (Semantic Search)

### Start Qdrant (Vector Database):

```bash
docker-compose up -d qdrant
```

**Check it's running:** Open http://localhost:6335/dashboard

### Vectorize your chats:

```bash
python3 src/vectorize.py --db my_chats.sqlite
```

**What this does:**
- Reads all messages from SQLite
- Generates embeddings using `all-MiniLM-L6-v2` model (downloaded locally, ~90MB)
- Uploads vectors to Qdrant for semantic search
- Takes ~20 seconds per 10,000 messages

**Privacy:** The embedding model runs entirely on your computer. No data is sent anywhere.

**Result:** Your chats are now searchable by meaning, not just keywords

---

## Step 3: Start the Servers

### Backend (REST API + MCP Server):

```bash
cd backend
npm install
npm run dev:api
```

**Running on:** http://localhost:5000 (localhost only - secure by default)

### Frontend (Web Application):

```bash
cd frontend
npm install
npm run dev
```

**Running on:** http://localhost:5173

**Open in browser:** http://localhost:5173

---

## You're Done! 🎉

### What you can do now:

**Search your chats:**
- Keyword search (fast SQLite FTS)
- Semantic search (AI-powered meaning-based)
- Hybrid search (best of both)

**Browse conversations:**
- Infinite scroll through all your chats
- Platform filtering (ChatGPT, Claude, Grok)
- Full conversation view with timestamps

**Use MCP (Model Context Protocol):**
- Connect Claude Desktop to search your archive
- Connect ChatGPT Developer Mode (see `backend/MCP_CHATGPT_SETUP.md`)

---

## Common Commands

### Update your archive with new exports:

```bash
# Import new conversations (deduplication is automatic)
python src/ingest.py --in new_export.json --db my_chats.sqlite --format chatgpt

# Re-vectorize (updates Qdrant with new messages)
python3 src/vectorize.py --db my_chats.sqlite
```

### Check your data:

```bash
# Database statistics
sqlite3 my_chats.sqlite "SELECT COUNT(*) as messages FROM messages;"
sqlite3 my_chats.sqlite "SELECT COUNT(*) as threads FROM threads;"

# Qdrant statistics
curl http://localhost:6335/collections/chat-messages
```

### Stop services:

```bash
# Stop Docker services
docker-compose down

# Stop backend/frontend: Ctrl+C in their terminals
```

---

## Troubleshooting

### Port already in use:

```bash
# Check what's using the port
lsof -i :5000
lsof -i :3001
lsof -i :5173

# Kill the process
kill <PID>
```

### Qdrant not starting:

```bash
# Check Docker status
docker ps

# Restart Qdrant
docker-compose restart qdrant

# Check logs
docker-compose logs qdrant
```

### Missing Python packages:

```bash
pip install -r requirements.txt
```

### Vectorization too slow:

```bash
# Process in batches with larger batch size
python3 src/vectorize.py --db my_chats.sqlite --batch-size 128

# Or limit number of messages for testing
python3 src/vectorize.py --db my_chats.sqlite --limit 1000
```

---

## File Structure

```
chat-export-structurer/
├── my_chats.sqlite          # Your chat database (SQLite)
├── src/
│   ├── ingest.py            # Import JSON → SQLite
│   └── vectorize.py         # SQLite → Qdrant vectors
├── backend/
│   ├── src/
│   │   ├── api/             # REST API endpoints
│   │   └── mcp/             # MCP server (Claude/ChatGPT)
│   └── .env                 # Configuration (ports, database path)
├── frontend/
│   └── src/                 # React web application
└── docker-compose.yml       # Qdrant vector database
```

---

## Next Steps

- **Customize search:** See `backend/README.md` for API documentation
- **ChatGPT integration:** See `backend/MCP_CHATGPT_SETUP.md`
- **Deploy remotely:** See deployment guides (coming soon)
- **Privacy config:** See `PRIVACY_CONFIG.md` for data handling details

---

## Privacy & Security

✅ **Everything is local** - No data leaves your computer
✅ **Localhost-only by default** - Services not accessible from network
✅ **No telemetry** - Qdrant telemetry disabled in docker-compose.yml
✅ **No API keys needed** - All processing is local
✅ **Open source** - Audit the code yourself

Your chat history is sensitive data. This system is designed to keep it private and under your control.

---

## Need Help?

- **Documentation:** See individual README files in `backend/` and `frontend/`
- **Issues:** https://github.com/edwardbrazier/chat-export-structurer/issues
- **MCP Setup:** `backend/MCP_CHATGPT_SETUP.md`
- **Vector DB Guide:** `VECTOR_DATABASE_GUIDE.md` (detailed technical docs)

---

**Built for privacy. Built for ownership. Built for builders.**
