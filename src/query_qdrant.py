#!/usr/bin/env python3
"""
query_qdrant.py
Query the Qdrant vector database with semantic search
"""

import argparse
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer


def main():
    parser = argparse.ArgumentParser(description="Query Qdrant vector database")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--collection", default="chat-archive", help="Collection name")
    parser.add_argument("--host", default="localhost", help="Qdrant host")
    parser.add_argument("--port", type=int, default=6335, help="Qdrant port")
    parser.add_argument("--model", default="all-MiniLM-L6-v2", help="Embedding model")
    parser.add_argument("--limit", type=int, default=5, help="Number of results")

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

    print(f"[+] Found {len(results)} results:\n")

    for i, result in enumerate(results, 1):
        print(f"Result {i} (score: {result.score:.4f})")
        print(f"  Platform: {result.payload['platform']}")
        print(f"  Thread: {result.payload['title']}")
        print(f"  Role: {result.payload['role']}")
        print(f"  Time: {result.payload['timestamp']}")
        print(f"  Text: {result.payload['text'][:150]}...")
        print()


if __name__ == "__main__":
    main()
