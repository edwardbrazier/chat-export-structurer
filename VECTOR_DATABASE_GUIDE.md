# Vector Database Integration Guide

This guide covers the Qdrant vector database integration for semantic search across your chat archives.

## Architecture Overview

```
Chat Exports (JSON)
    ↓
SQLite Database (structured storage)
    ↓
Qdrant Vector DB (semantic search)
```

## Data Safety & Privacy

### Is Your Data Safe in Qdrant?

**YES.** When running Qdrant locally in Docker, your data never leaves your computer:

✅ **All data stored locally** in `qdrant_storage/` directory
✅ **No outbound connections** - Qdrant doesn't phone home
✅ **No telemetry or cloud sync**
✅ **Localhost-only access** (127.0.0.1) - not accessible from network
✅ **Encrypted at rest** if you encrypt the storage directory

### Current Security Configuration

```bash
# Container: qdrant-chat-archive
# Ports: 127.0.0.1:6335-6336 (localhost only)
# Storage: /home/edward/chat-export-structurer/qdrant_storage
```

**This means:**
- Only applications on your computer can access Qdrant
- Not accessible from your local network or internet
- Data persists in the storage directory (survives container restarts)

### Additional Security Steps

**Backup your data:**
```bash
# Backup Qdrant storage
tar -czf qdrant_backup_$(date +%Y%m%d).tar.gz qdrant_storage/

# Backup SQLite database
cp my_chats.sqlite my_chats_backup_$(date +%Y%m%d).sqlite
```

**Encrypt the storage directory:**
```bash
# Using LUKS or ecryptfs for folder encryption
# Or encrypt the entire disk with full-disk encryption
```

## Vectorization Approaches

### Two Methods Available

#### 1. Per-Message Vectorization (`vectorize.py`)
- Creates one vector per individual message
- Good for: Finding specific answers or quotes
- Use case: "Show me all messages mentioning Python decorators"

```bash
python3 src/vectorize.py --db my_chats.sqlite --collection chat-archive --port 6335
```

#### 2. Per-Thread Vectorization (`vectorize_threads.py`) ⭐ RECOMMENDED
- Creates one vector per entire conversation
- Good for: Finding relevant conversations by topic
- Use case: "Show me conversations about database optimization"

```bash
python3 src/vectorize_threads.py --db my_chats.sqlite --collection chat-threads --port 6335
```

**Why per-thread is better for chats:**
- Preserves conversation context
- Better semantic understanding of the full discussion
- More efficient (fewer vectors to store)
- Returns complete conversations, not fragments

## Usage Examples

### Import Data from SQLite to Qdrant

**Import by conversation threads (recommended):**
```bash
python3 src/vectorize_threads.py \
  --db my_chats.sqlite \
  --collection chat-threads \
  --port 6335
```

**Import individual messages:**
```bash
python3 src/vectorize.py \
  --db my_chats.sqlite \
  --collection chat-messages \
  --port 6335
```

### Query Your Vector Database

**Search conversation threads:**
```bash
python3 src/query_threads.py "machine learning best practices"
python3 src/query_threads.py "how to optimize SQL queries" --limit 5
```

**Search individual messages:**
```bash
python3 src/query_qdrant.py "Python decorators" --collection chat-archive
```

### Advanced Options

```bash
# Use different embedding model
python3 src/vectorize_threads.py \
  --db my_chats.sqlite \
  --model all-mpnet-base-v2 \
  --port 6335

# Limit for testing
python3 src/vectorize_threads.py \
  --db my_chats.sqlite \
  --limit 10 \
  --port 6335
```

## Embedding Models

Default model: **all-MiniLM-L6-v2**
- Dimension: 384
- Speed: Very fast
- Quality: Good for most use cases

Alternative models:
- `all-mpnet-base-v2` - Higher quality, slower (768 dimensions)
- `paraphrase-multilingual-MiniLM-L12-v2` - Multilingual support
- `multi-qa-MiniLM-L6-cos-v1` - Optimized for Q&A

## Docker Management

### Start/Stop Container

```bash
# Stop container
docker stop qdrant-chat-archive

# Start container
docker start qdrant-chat-archive

# Restart container
docker restart qdrant-chat-archive
```

### View Container Status

```bash
# Check if running
docker ps | grep qdrant

# View logs
docker logs qdrant-chat-archive

# View resource usage
docker stats qdrant-chat-archive
```

### Access Qdrant Dashboard

Open in browser: http://localhost:6335/dashboard

### Recreate Container (if needed)

```bash
docker stop qdrant-chat-archive
docker rm qdrant-chat-archive

# Recreate with same data (data persists in qdrant_storage/)
docker run -d --name qdrant-chat-archive \
  -p 127.0.0.1:6335:6333 \
  -p 127.0.0.1:6336:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

## Collection Management

### List Collections

```python
from qdrant_client import QdrantClient
client = QdrantClient(host="localhost", port=6335)
print(client.get_collections())
```

### Delete Collection

```bash
python3 -c "from qdrant_client import QdrantClient; \
QdrantClient(host='localhost', port=6335).delete_collection('collection-name')"
```

## Full Workflow Example

```bash
# 1. Import chat export to SQLite
python3 src/ingest.py \
  --in chatgpt_export.json \
  --db my_archive.sqlite \
  --format chatgpt

# 2. Vectorize conversations to Qdrant
python3 src/vectorize_threads.py \
  --db my_archive.sqlite \
  --collection my-chats \
  --port 6335

# 3. Search your conversations
python3 src/query_threads.py "topic you're interested in" --collection my-chats
```

## Performance & Scaling

### Storage Requirements

- **SQLite:** ~1KB per message (with full text)
- **Qdrant:** ~1.5KB per vector (384 dimensions)
- **Example:** 10,000 messages ≈ 10MB SQLite + 15MB Qdrant

### Query Performance

- Semantic search: <50ms for collections under 100K vectors
- Exact search: <10ms
- Batch uploads: ~100-500 messages/second

### Recommended Limits

- Per collection: Up to 1M vectors (conversations)
- Message text: Truncate at 10K chars per thread
- Batch size: 8-32 threads at a time

## Troubleshooting

### Connection Refused

```bash
# Check if container is running
docker ps | grep qdrant-chat-archive

# Check port binding
docker port qdrant-chat-archive

# Restart container
docker restart qdrant-chat-archive
```

### Out of Memory

```bash
# Reduce batch size
python3 src/vectorize_threads.py --db my_chats.sqlite --batch-size 4

# Use smaller model
python3 src/vectorize_threads.py --db my_chats.sqlite --model all-MiniLM-L6-v2
```

### Slow Embedding Generation

```bash
# Use GPU if available (automatically detected)
# Or use smaller model
python3 src/vectorize_threads.py --model all-MiniLM-L6-v2
```

## Python API Usage

### Query Programmatically

```python
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

# Setup
model = SentenceTransformer('all-MiniLM-L6-v2')
client = QdrantClient(host="localhost", port=6335)

# Search
query = "your search query"
query_vector = model.encode(query).tolist()

results = client.query_points(
    collection_name="chat-threads",
    query=query_vector,
    limit=5
).points

for result in results:
    print(f"Score: {result.score}")
    print(f"Title: {result.payload['title']}")
    print(f"Preview: {result.payload['preview'][:200]}")
```

### Filter by Metadata

```python
from qdrant_client.models import Filter, FieldCondition, MatchValue

# Search only ChatGPT conversations
results = client.query_points(
    collection_name="chat-threads",
    query=query_vector,
    query_filter=Filter(
        must=[
            FieldCondition(
                key="platform",
                match=MatchValue(value="chatgpt")
            )
        ]
    ),
    limit=5
)
```

## Next Steps

1. **Import all your chat exports** into SQLite
2. **Vectorize by thread** for semantic search
3. **Build custom search tools** using the Python API
4. **Integrate with RAG systems** for AI context
5. **Create a web UI** for browsing conversations

## Security Checklist

- [x] Qdrant bound to localhost only (127.0.0.1)
- [ ] Storage directory encrypted
- [ ] Regular backups configured
- [ ] No sensitive data in collection names
- [ ] Firewall rules verified
- [ ] Docker container auto-restart disabled (or secured)

---

**Need help?** Check the main README.md or open an issue on GitHub.
