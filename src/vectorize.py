#!/usr/bin/env python3
"""
vectorize.py
Migrate chat messages from SQLite to Qdrant vector database
"""

import argparse
import sqlite3
from typing import List, Dict
from tqdm import tqdm
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer


def load_messages_from_sqlite(db_path: str) -> List[Dict]:
    """Load all messages from SQLite database."""
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
        ORDER BY ts
    """)

    messages = [dict(row) for row in cur.fetchall()]
    con.close()

    return messages


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
        description="Migrate chat messages from SQLite to Qdrant vector database",
        epilog="Example: python vectorize.py --db my_chats.sqlite --collection chat-archive"
    )
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--collection", default="chat-messages", help="Qdrant collection name")
    parser.add_argument("--host", default="localhost", help="Qdrant host")
    parser.add_argument("--port", type=int, default=6335, help="Qdrant port")
    parser.add_argument("--model", default="all-MiniLM-L6-v2",
                       help="Sentence transformer model (default: all-MiniLM-L6-v2)")
    parser.add_argument("--batch-size", type=int, default=32,
                       help="Batch size for embeddings and upload")
    parser.add_argument("--limit", type=int, help="Limit number of messages to process (for testing)")

    args = parser.parse_args()

    print(f"\n[*] Loading messages from SQLite: {args.db}")
    messages = load_messages_from_sqlite(args.db)

    if not messages:
        print("[!] No messages found in database")
        return

    if args.limit:
        messages = messages[:args.limit]
        print(f"[*] Limited to {args.limit} messages for testing")

    print(f"[+] Loaded {len(messages)} messages")

    # Show statistics
    platforms = set(m['platform'] for m in messages)
    threads = set(m['canonical_thread_id'] for m in messages)
    print(f"[+] Platforms: {', '.join(platforms)}")
    print(f"[+] Unique threads: {len(threads)}")

    # Load embedding model
    print(f"\n[*] Loading embedding model: {args.model}")
    model = SentenceTransformer(args.model)
    vector_size = model.get_sentence_embedding_dimension()
    print(f"[+] Model loaded (embedding dimension: {vector_size})")

    # Connect to Qdrant
    print(f"\n[*] Connecting to Qdrant at {args.host}:{args.port}")
    client = QdrantClient(host=args.host, port=args.port)

    # Test connection
    try:
        collections = client.get_collections()
        print(f"[+] Connected to Qdrant")
    except Exception as e:
        print(f"[!] Failed to connect to Qdrant: {e}")
        return

    # Create collection
    create_qdrant_collection(client, args.collection, vector_size)

    # Process messages in batches
    print(f"\n[*] Generating embeddings and uploading to Qdrant...")

    batch_texts = []
    batch_messages = []
    points = []
    uploaded = 0

    for msg in tqdm(messages, desc="Processing messages"):
        batch_texts.append(msg['text'])
        batch_messages.append(msg)

        # Process batch when full
        if len(batch_texts) >= args.batch_size:
            # Generate embeddings
            embeddings = model.encode(batch_texts, show_progress_bar=False)

            # Create points
            for i, (text, embedding, message) in enumerate(zip(batch_texts, embeddings, batch_messages)):
                point = PointStruct(
                    id=uploaded + i,
                    vector=embedding.tolist(),
                    payload={
                        "message_id": message['message_id'],
                        "thread_id": message['canonical_thread_id'],
                        "platform": message['platform'],
                        "account_id": message['account_id'],
                        "timestamp": message['ts'],
                        "role": message['role'],
                        "text": message['text'],
                        "title": message['title'],
                        "source_id": message['source_id']
                    }
                )
                points.append(point)

            # Upload batch
            client.upsert(collection_name=args.collection, points=points)
            uploaded += len(points)

            # Reset batch
            batch_texts = []
            batch_messages = []
            points = []

    # Process remaining messages
    if batch_texts:
        embeddings = model.encode(batch_texts, show_progress_bar=False)

        for i, (text, embedding, message) in enumerate(zip(batch_texts, embeddings, batch_messages)):
            point = PointStruct(
                id=uploaded + i,
                vector=embedding.tolist(),
                payload={
                    "message_id": message['message_id'],
                    "thread_id": message['canonical_thread_id'],
                    "platform": message['platform'],
                    "account_id": message['account_id'],
                    "timestamp": message['ts'],
                    "role": message['role'],
                    "text": message['text'],
                    "title": message['title'],
                    "source_id": message['source_id']
                }
            )
            points.append(point)

        client.upsert(collection_name=args.collection, points=points)
        uploaded += len(points)

    # Verify upload
    collection_info = client.get_collection(collection_name=args.collection)

    print(f"\n[+] Migration complete!")
    print(f"  Messages uploaded: {uploaded}")
    print(f"  Collection: {args.collection}")
    print(f"  Points in collection: {collection_info.points_count}")
    print(f"  Qdrant URL: http://{args.host}:{args.port}/dashboard")


if __name__ == "__main__":
    main()
