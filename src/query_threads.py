#!/usr/bin/env python3
"""
query_threads.py
Query conversation threads in Qdrant
"""

import argparse
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer


def main():
    parser = argparse.ArgumentParser(description="Query conversation threads in Qdrant")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--collection", default="chat-threads", help="Collection name")
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
    print(f"[*] Searching threads for: {args.query}\n")
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
        print(f"\nThread {i} (relevance: {result.score:.4f})")
        print(f"Title: {result.payload['title']}")
        print(f"Platform: {result.payload['platform']}")
        print(f"Messages: {result.payload['message_count']}")
        print(f"Time range: {result.payload['first_timestamp']} to {result.payload['last_timestamp']}")
        print(f"\nPreview:")
        print(result.payload['preview'])
        print("=" * 80)


if __name__ == "__main__":
    main()
