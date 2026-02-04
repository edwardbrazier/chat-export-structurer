#!/usr/bin/env python3
"""
vectorize_threads.py
Migrate chat THREADS (not individual messages) from SQLite to Qdrant
Each vector represents an entire conversation thread
"""

import argparse
import sqlite3
from typing import List, Dict
from datetime import datetime
from collections import defaultdict
from tqdm import tqdm
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer


def load_threads_from_sqlite(db_path: str) -> Dict[str, Dict]:
    """Load all messages grouped by thread."""
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("""
        SELECT
            message_id,
            canonical_thread_id,
            platform,
            account_id,
            ts,
            role,
            text,
            title,
            source_id
        FROM messages
        ORDER BY canonical_thread_id, ts
    """)

    # Group messages by thread
    threads = defaultdict(lambda: {
        "messages": [],
        "metadata": {}
    })

    for row in cur.fetchall():
        thread_id = row['canonical_thread_id']
        message = dict(row)

        threads[thread_id]["messages"].append(message)

        # Store thread metadata from first message
        if not threads[thread_id]["metadata"]:
            threads[thread_id]["metadata"] = {
                "thread_id": thread_id,
                "platform": row['platform'],
                "account_id": row['account_id'],
                "title": row['title'],
                "source_id": row['source_id'],
                "first_timestamp": row['ts'],
            }

    con.close()

    # Add last timestamp and message count
    for thread_id, thread_data in threads.items():
        thread_data["metadata"]["last_timestamp"] = thread_data["messages"][-1]['ts']
        thread_data["metadata"]["message_count"] = len(thread_data["messages"])

    return dict(threads)


def thread_to_text(thread_data: Dict) -> str:
    """Convert a thread's messages into a single text representation."""
    messages = thread_data["messages"]
    title = thread_data["metadata"]["title"] or "Untitled Conversation"

    # Format: Title + full conversation with role markers
    text_parts = [f"# {title}\n"]

    for msg in messages:
        role = msg['role'].upper()
        text = msg['text'].strip()
        text_parts.append(f"\n{role}: {text}")

    return "\n".join(text_parts)


def ensure_mapping_table(db_path: str):
    """Ensure the qdrant_threads mapping table exists."""
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS qdrant_threads (
            qdrant_id INTEGER PRIMARY KEY,
            canonical_thread_id TEXT NOT NULL,
            collection_name TEXT NOT NULL,
            indexed_at TEXT NOT NULL,
            UNIQUE(canonical_thread_id, collection_name)
        )
    """)
    con.commit()
    con.close()


def save_qdrant_mapping(db_path: str, collection_name: str, mappings: List[tuple]):
    """
    Save Qdrant ID to thread ID mappings in SQLite.

    Args:
        db_path: Path to SQLite database
        collection_name: Name of Qdrant collection
        mappings: List of (qdrant_id, canonical_thread_id) tuples
    """
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    indexed_at = datetime.utcnow().isoformat()

    for qdrant_id, thread_id in mappings:
        cur.execute("""
            INSERT OR REPLACE INTO qdrant_threads
            (qdrant_id, canonical_thread_id, collection_name, indexed_at)
            VALUES (?, ?, ?, ?)
        """, (qdrant_id, thread_id, collection_name, indexed_at))

    con.commit()
    con.close()


def create_qdrant_collection(client: QdrantClient, collection_name: str, vector_size: int):
    """Create or recreate Qdrant collection."""
    try:
        client.delete_collection(collection_name=collection_name)
        print(f"[*] Deleted existing collection: {collection_name}")
    except Exception:
        pass

    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )
    print(f"[+] Created collection: {collection_name} (vector size: {vector_size})")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate chat THREADS from SQLite to Qdrant (one vector per conversation)",
        epilog="Example: python vectorize_threads.py --db my_chats.sqlite --collection chat-threads"
    )
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--collection", default="chat-threads", help="Qdrant collection name")
    parser.add_argument("--host", default="localhost", help="Qdrant host")
    parser.add_argument("--port", type=int, default=6335, help="Qdrant port")
    parser.add_argument("--model", default="all-MiniLM-L6-v2",
                       help="Sentence transformer model")
    parser.add_argument("--batch-size", type=int, default=8,
                       help="Batch size for embeddings")
    parser.add_argument("--limit", type=int, help="Limit number of threads (for testing)")

    args = parser.parse_args()

    # Ensure mapping table exists
    ensure_mapping_table(args.db)

    print(f"\n[*] Loading threads from SQLite: {args.db}")
    threads = load_threads_from_sqlite(args.db)

    if not threads:
        print("[!] No threads found in database")
        return

    thread_list = list(threads.items())

    if args.limit:
        thread_list = thread_list[:args.limit]
        print(f"[*] Limited to {args.limit} threads for testing")

    print(f"[+] Loaded {len(thread_list)} threads")

    # Show statistics
    total_messages = sum(t[1]["metadata"]["message_count"] for t in thread_list)
    platforms = set(t[1]["metadata"]["platform"] for t in thread_list)
    print(f"[+] Total messages: {total_messages}")
    print(f"[+] Platforms: {', '.join(platforms)}")

    # Sample thread
    sample_thread_id, sample_thread = thread_list[0]
    print(f"\n[*] Sample thread:")
    print(f"  Title: {sample_thread['metadata']['title']}")
    print(f"  Messages: {sample_thread['metadata']['message_count']}")
    print(f"  Platform: {sample_thread['metadata']['platform']}")

    # Load embedding model
    print(f"\n[*] Loading embedding model: {args.model}")
    model = SentenceTransformer(args.model)
    vector_size = model.get_sentence_embedding_dimension()
    print(f"[+] Model loaded (embedding dimension: {vector_size})")

    # Connect to Qdrant
    print(f"\n[*] Connecting to Qdrant at {args.host}:{args.port}")
    client = QdrantClient(host=args.host, port=args.port)

    try:
        client.get_collections()
        print(f"[+] Connected to Qdrant")
    except Exception as e:
        print(f"[!] Failed to connect to Qdrant: {e}")
        return

    # Create collection
    create_qdrant_collection(client, args.collection, vector_size)

    # Process threads in batches
    print(f"\n[*] Generating thread embeddings and uploading to Qdrant...")

    batch_texts = []
    batch_thread_ids = []
    batch_metadata = []
    points = []
    uploaded = 0
    all_mappings = []  # Track (qdrant_id, thread_id) mappings

    for thread_id, thread_data in tqdm(thread_list, desc="Processing threads"):
        # Convert thread to text
        thread_text = thread_to_text(thread_data)
        batch_texts.append(thread_text)
        batch_thread_ids.append(thread_id)
        batch_metadata.append(thread_data["metadata"])

        # Process batch when full
        if len(batch_texts) >= args.batch_size:
            # Generate embeddings
            embeddings = model.encode(batch_texts, show_progress_bar=False)

            # Create points
            for i, (thread_id, embedding, metadata, text) in enumerate(
                zip(batch_thread_ids, embeddings, batch_metadata, batch_texts)
            ):
                # Store first 500 chars of conversation as preview
                preview = text[:500] + ("..." if len(text) > 500 else "")

                qdrant_id = uploaded + i

                point = PointStruct(
                    id=qdrant_id,
                    vector=embedding.tolist(),
                    payload={
                        **metadata,
                        "preview": preview,
                        "full_text": text[:10000],  # Store up to 10k chars
                    }
                )
                points.append(point)

                # Track mapping for SQLite
                all_mappings.append((qdrant_id, thread_id))

            # Upload batch
            client.upsert(collection_name=args.collection, points=points)
            uploaded += len(points)

            # Reset batch
            batch_texts = []
            batch_thread_ids = []
            batch_metadata = []
            points = []

    # Process remaining threads
    if batch_texts:
        embeddings = model.encode(batch_texts, show_progress_bar=False)

        for i, (thread_id, embedding, metadata, text) in enumerate(
            zip(batch_thread_ids, embeddings, batch_metadata, batch_texts)
        ):
            preview = text[:500] + ("..." if len(text) > 500 else "")

            qdrant_id = uploaded + i

            point = PointStruct(
                id=qdrant_id,
                vector=embedding.tolist(),
                payload={
                    **metadata,
                    "preview": preview,
                    "full_text": text[:10000],
                }
            )
            points.append(point)

            # Track mapping for SQLite
            all_mappings.append((qdrant_id, thread_id))

        client.upsert(collection_name=args.collection, points=points)
        uploaded += len(points)

    # Save mappings to SQLite
    print(f"\n[*] Saving Qdrant ID mappings to SQLite...")
    save_qdrant_mapping(args.db, args.collection, all_mappings)
    print(f"[+] Saved {len(all_mappings)} mappings to qdrant_threads table")

    # Verify upload
    collection_info = client.get_collection(collection_name=args.collection)

    print(f"\n[+] Migration complete!")
    print(f"  Threads uploaded: {uploaded}")
    print(f"  Collection: {args.collection}")
    print(f"  Points in collection: {collection_info.points_count}")
    print(f"  Qdrant URL: http://{args.host}:{args.port}/dashboard")
    print(f"\n[*] Each vector represents an entire conversation thread")
    print(f"[*] Qdrant ID mappings stored in SQLite: qdrant_threads table")


if __name__ == "__main__":
    main()
