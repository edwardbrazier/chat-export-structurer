#!/usr/bin/env python3
"""
query_with_context.py
Query Qdrant and enrich results with full context from SQLite
"""

import argparse
import sqlite3
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer


def get_thread_context(db_path: str, qdrant_id: int, collection_name: str) -> dict:
    """Get full thread context from SQLite using Qdrant ID."""
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Get thread info from mapping
    cur.execute("""
        SELECT
            qt.canonical_thread_id,
            m.platform,
            m.title,
            m.account_id,
            MIN(m.ts) as first_timestamp,
            MAX(m.ts) as last_timestamp,
            COUNT(m.message_id) as message_count
        FROM qdrant_threads qt
        JOIN messages m ON qt.canonical_thread_id = m.canonical_thread_id
        WHERE qt.qdrant_id = ? AND qt.collection_name = ?
        GROUP BY qt.canonical_thread_id, m.platform, m.title, m.account_id
    """, (qdrant_id, collection_name))

    result = cur.fetchone()
    con.close()

    return dict(result) if result else None


def main():
    parser = argparse.ArgumentParser(
        description="Query Qdrant with full SQLite context"
    )
    parser.add_argument("query", help="Search query")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--collection", default="chat-threads-v2", help="Collection name")
    parser.add_argument("--host", default="localhost", help="Qdrant host")
    parser.add_argument("--port", type=int, default=6335, help="Qdrant port")
    parser.add_argument("--model", default="all-MiniLM-L6-v2", help="Embedding model")
    parser.add_argument("--limit", type=int, default=3, help="Number of results")

    args = parser.parse_args()

    # Load model
    print(f"[*] Loading model: {args.model}")
    model = SentenceTransformer(args.model)

    # Connect to Qdrant
    print(f"[*] Connecting to Qdrant at {args.host}:{args.port}")
    client = QdrantClient(host=args.host, port=args.port)

    # Generate query embedding
    print(f"[*] Searching for: {args.query}\n")
    query_vector = model.encode(args.query).tolist()

    # Search
    results = client.query_points(
        collection_name=args.collection,
        query=query_vector,
        limit=args.limit
    ).points

    print(f"[+] Found {len(results)} relevant conversation threads:\n")
    print("=" * 80)

    for i, result in enumerate(results, 1):
        qdrant_id = result.id

        # Get full context from SQLite
        context = get_thread_context(args.db, qdrant_id, args.collection)

        if context:
            print(f"\nThread {i} (relevance: {result.score:.4f})")
            print(f"Qdrant ID: {qdrant_id}")
            print(f"Platform: {context['platform']}")
            print(f"Title: {context['title']}")
            print(f"Messages: {context['message_count']}")
            print(f"Time range: {context['first_timestamp']} to {context['last_timestamp']}")
            print(f"\nPreview from vector:")
            print(result.payload.get('preview', '(no preview)'))
        else:
            # Fallback to Qdrant payload only
            print(f"\nThread {i} (relevance: {result.score:.4f})")
            print(f"Qdrant ID: {qdrant_id}")
            print(f"(No SQLite context found - using Qdrant payload only)")
            print(f"Platform: {result.payload.get('platform', 'unknown')}")
            print(f"Title: {result.payload.get('title', 'unknown')}")

        print("=" * 80)


if __name__ == "__main__":
    main()
