#!/usr/bin/env python3
"""
vectorize_threads.py
Migrate chat THREADS (not individual messages) from SQLite to Qdrant
Each vector represents an entire conversation thread
"""

import argparse
import sqlite3
from typing import List, Dict
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

                point = PointStruct(
                    id=uploaded + i,
                    vector=embedding.tolist(),
                    payload={
                        **metadata,
                        "preview": preview,
                        "full_text": text[:10000],  # Store up to 10k chars
                    }
                )
                points.append(point)

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

            point = PointStruct(
                id=uploaded + i,
                vector=embedding.tolist(),
                payload={
                    **metadata,
                    "preview": preview,
                    "full_text": text[:10000],
                }
            )
            points.append(point)

        client.upsert(collection_name=args.collection, points=points)
        uploaded += len(points)

    # Verify upload
    collection_info = client.get_collection(collection_name=args.collection)

    print(f"\n[+] Migration complete!")
    print(f"  Threads uploaded: {uploaded}")
    print(f"  Collection: {args.collection}")
    print(f"  Points in collection: {collection_info.points_count}")
    print(f"  Qdrant URL: http://{args.host}:{args.port}/dashboard")
    print(f"\n[*] Each vector represents an entire conversation thread")


if __name__ == "__main__":
    main()
