# Chat Archive Project Structure

## Directory Layout

```
chat-export-structurer/
├── backend/                          # Node.js + TypeScript Backend
│   ├── src/
│   │   ├── api/                      # REST API
│   │   │   ├── routes/
│   │   │   │   ├── chats.ts         # Thread endpoints
│   │   │   │   └── search.ts        # Search endpoints
│   │   │   ├── services/
│   │   │   │   ├── sqlite.service.ts    # SQLite FTS5 queries
│   │   │   │   ├── qdrant.service.ts    # Python script caller
│   │   │   │   └── search.service.ts    # Hybrid search (RRF)
│   │   │   ├── middleware/
│   │   │   │   ├── error.ts             # Error handling
│   │   │   │   └── logger.ts            # Request logging
│   │   │   ├── models/
│   │   │   │   └── index.ts             # Type exports
│   │   │   └── server.ts                # Express setup
│   │   ├── mcp/
│   │   │   └── server.ts                # MCP server
│   │   ├── shared/
│   │   │   ├── config.ts                # Configuration
│   │   │   └── types.ts                 # Shared types
│   │   └── index.ts                     # Main entry point
│   ├── dist/                        # Compiled JavaScript (generated)
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
│
├── frontend/                        # Angular 18 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   └── services/
│   │   │   │       ├── chat.service.ts      # Chat API client
│   │   │   │       └── search.service.ts    # Search API client
│   │   │   ├── features/
│   │   │   │   ├── search/
│   │   │   │   │   ├── search.component.ts
│   │   │   │   │   ├── search.component.html
│   │   │   │   │   └── search.component.scss
│   │   │   │   └── chat-viewer/
│   │   │   │       ├── chat-viewer.component.ts
│   │   │   │       ├── chat-viewer.component.html
│   │   │   │       └── chat-viewer.component.scss
│   │   │   ├── models/
│   │   │   │   ├── message.model.ts
│   │   │   │   └── thread.model.ts
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.routes.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   ├── main.ts
│   │   ├── index.html
│   │   └── styles.scss
│   ├── package.json
│   ├── angular.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── nginx.conf
│
├── src/                             # Python Scripts
│   ├── query_with_context.py        # Qdrant semantic search
│   ├── embed_threads.py             # Embedding generation
│   └── ...                          # Other utilities
│
├── my_chats.sqlite                  # SQLite Database
├── qdrant_storage/                  # Qdrant Data Directory
│
├── docker-compose.yml               # Multi-container orchestration
├── .env                             # Environment variables
├── .gitignore
│
├── WEB_APP_README.md                # Main documentation
├── SETUP_GUIDE.md                   # Setup instructions
├── IMPLEMENTATION_SUMMARY.md        # What was built
├── PROJECT_STRUCTURE.md             # This file
├── mcp-config-example.json          # MCP configuration
├── quick-start.sh                   # Quick setup script
└── test-backend.sh                  # API testing script
```

## Component Interaction Flow

### Search Flow

```
User enters search query in Angular frontend
    ↓
SearchComponent calls SearchService.search()
    ↓
HTTP POST to /api/v1/search
    ↓
Express router → SearchService.search()
    ↓
┌─────────────────┬─────────────────┐
│ Keyword Search  │ Semantic Search │
│ (SQLite FTS5)   │ (Qdrant)        │
│                 │                 │
│ SqliteService   │ QdrantService   │
│ .keywordSearch()│ .semanticSearch()│
│      ↓          │      ↓          │
│   SQLite DB     │  Python Script  │
│                 │      ↓          │
│                 │   Qdrant DB     │
└─────────────────┴─────────────────┘
           ↓
    Merge with RRF (Reciprocal Rank Fusion)
           ↓
    Return combined results
           ↓
    Display in Angular UI
```

### Chat Viewer Flow

```
User clicks on search result
    ↓
Angular router navigates to /chat/:id
    ↓
ChatViewerComponent loads
    ↓
ChatService.getThreadById(id)
    ↓
HTTP GET to /api/v1/chats/:threadId
    ↓
Express router → SqliteService.getThreadById()
    ↓
SQLite query for thread + all messages
    ↓
Return Thread with Message[]
    ↓
Render message bubbles with markdown
```

### MCP Server Flow

```
Claude Desktop starts
    ↓
Reads claude_desktop_config.json
    ↓
Spawns: node backend/dist/index.js (MODE=mcp)
    ↓
MCP Server starts on stdio
    ↓
Registers tools: search_chats, get_chat, list_chats
    ↓
Claude user: "Search my chats for machine learning"
    ↓
MCP CallToolRequest: search_chats
    ↓
SearchService.search() (same as API)
    ↓
Return formatted results to Claude
```

## Data Flow

### Keyword Search (SQLite)

```sql
SELECT DISTINCT
  m.canonical_thread_id as threadId,
  m.platform,
  m.title,
  COUNT(m.message_id) as messageCount,
  MIN(m.ts) as firstTimestamp,
  MAX(m.ts) as lastTimestamp,
  GROUP_CONCAT(SUBSTR(m.text, 1, 100), ' ') as preview
FROM messages_fts fts
JOIN messages_fts_docids d ON fts.rowid = d.rowid
JOIN messages m ON m.message_id = d.message_id
WHERE messages_fts MATCH 'search query'
GROUP BY m.canonical_thread_id
ORDER BY COUNT(*) DESC
LIMIT 10
```

### Semantic Search (Qdrant)

```bash
python3 query_with_context.py \
  "machine learning" \
  --db my_chats.sqlite \
  --collection chat_messages \
  --limit 10 \
  --format json

# Returns JSON:
[
  {
    "threadId": "...",
    "title": "...",
    "platform": "...",
    "score": 0.85,
    "matchSource": "semantic"
  }
]
```

### Hybrid Search (RRF Algorithm)

```typescript
// For each result in keyword and semantic lists:
score = 1 / (rank + k)  // k = 60

// If thread appears in both:
combined_score = keyword_score + semantic_score
matchSource = "both"

// Sort by combined score
// Return top N results
```

## Port Allocation

| Service  | Port | Purpose                |
|----------|------|------------------------|
| Frontend | 4200 | Angular dev server     |
| Frontend | 80   | Nginx (Docker)         |
| Backend  | 5000 | Express API server     |
| Qdrant   | 6335 | Vector database (host) |
| Qdrant   | 6333 | Vector database (container) |

## Environment Variables

### Backend (.env)

```env
MODE=api                              # 'api' or 'mcp'
API_PORT=5000                         # Express port
API_HOST=0.0.0.0                      # Bind address
DATABASE_PATH=./my_chats.sqlite       # SQLite path
QDRANT_HOST=localhost                 # Qdrant host
QDRANT_PORT=6335                      # Qdrant port
QDRANT_COLLECTION=chat_messages       # Collection name
PYTHON_SCRIPTS_PATH=./src             # Python scripts
```

### Frontend (environment.ts)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/v1',
};
```

## Key Files Reference

### Backend Entry Points

| File | Purpose | Mode |
|------|---------|------|
| `src/index.ts` | Main entry point | Switches based on MODE env var |
| `src/api/server.ts` | Express app | API mode |
| `src/mcp/server.ts` | MCP server | MCP mode |

### Frontend Entry Points

| File | Purpose |
|------|---------|
| `src/main.ts` | Bootstrap Angular app |
| `src/app/app.config.ts` | App configuration |
| `src/app/app.routes.ts` | Routing |

### Docker Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrate all services |
| `backend/Dockerfile` | Backend image |
| `frontend/Dockerfile` | Frontend build + Nginx |
| `frontend/nginx.conf` | Nginx config |

### Scripts

| File | Purpose |
|------|---------|
| `quick-start.sh` | Automated setup |
| `test-backend.sh` | API testing |

## Build Artifacts

### Backend Build

```bash
npm run build
# Creates: backend/dist/
# Contains: Compiled .js + .d.ts files
```

### Frontend Build

```bash
npm run build
# Creates: frontend/dist/frontend/browser/
# Contains: Static HTML, CSS, JS
```

## Docker Volumes

```yaml
volumes:
  - ./my_chats.sqlite:/data/my_chats.sqlite:ro    # Database (read-only)
  - ./src:/app/scripts:ro                         # Python scripts
  - ./qdrant_storage:/qdrant/storage              # Qdrant data
```

## Network Architecture (Docker)

```
┌─────────────────────────────────────────────────┐
│        Docker Network: chat-network             │
│                                                  │
│  ┌──────────┐   ┌─────────┐   ┌─────────────┐ │
│  │ Frontend │   │ Backend │   │   Qdrant    │ │
│  │  :80     │   │  :5000  │   │   :6333     │ │
│  └────┬─────┘   └────┬────┘   └──────┬──────┘ │
│       │              │                │         │
└───────┼──────────────┼────────────────┼─────────┘
        │              │                │
    Host:4200      Host:5000       Host:6335
        ↓              ↓                ↓
    Browser         API Client      Qdrant Client
```

## TypeScript Type Flow

```typescript
// Shared types (backend/src/shared/types.ts)
export interface Thread { ... }
export interface Message { ... }
export interface SearchRequest { ... }
export interface SearchResponse { ... }

// Backend uses shared types
import { Thread, Message } from '../shared/types.js';

// Frontend duplicates types
// (Could be shared via npm package in production)
export interface Thread { ... }  // Same structure
```

## Development Workflow

### Local Development

1. **Terminal 1**: Backend API
   ```bash
   cd backend
   npm run dev:api  # tsx watch mode
   ```

2. **Terminal 2**: Frontend Dev Server
   ```bash
   cd frontend
   npm start  # ng serve
   ```

3. **Terminal 3**: Qdrant (if needed)
   ```bash
   docker run -d -p 6335:6333 qdrant/qdrant
   ```

### Docker Development

```bash
docker-compose up -d       # Start all
docker-compose logs -f     # Watch logs
docker-compose down        # Stop all
```

### MCP Development

```bash
cd backend
npm run dev:mcp           # Test MCP server
# Add to Claude Desktop config
# Restart Claude Desktop
```

## Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up -d
# All services start automatically
# Frontend: http://localhost:4200
# Backend: http://localhost:5000
```

### Option 2: Manual Deployment

```bash
# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build

# Serve with nginx or similar
# Configure reverse proxy for /api/
```

## Future Enhancements

### Potential Additions

1. **Authentication**: JWT-based user auth
2. **Multi-user**: User-specific chat archives
3. **Export**: PDF/Markdown export
4. **Analytics**: Search analytics dashboard
5. **Sharing**: Share conversation links
6. **Tags**: User-defined tags
7. **Collections**: Group related conversations
8. **Advanced Filters**: Date range, model version
9. **Full-text highlighting**: Highlight matches
10. **Real-time updates**: WebSocket for live changes

### Scalability

- **Database**: Migrate to PostgreSQL for multi-user
- **Search**: ElasticSearch for advanced queries
- **Caching**: Redis for search result caching
- **Queue**: Bull/RabbitMQ for async embedding
- **CDN**: Static asset optimization
- **Load Balancing**: Multiple backend instances

## Summary

This structure provides:

- ✅ **Clear separation**: API, MCP, Frontend
- ✅ **Modularity**: Services, routes, components
- ✅ **Type safety**: TypeScript throughout
- ✅ **Scalability**: Docker-ready, service-oriented
- ✅ **Maintainability**: Well-organized, documented
- ✅ **Extensibility**: Easy to add features
- ✅ **Testability**: Isolated components
