#!/usr/bin/env python3
"""
show_mappings.py
Show human-readable view of Qdrant ID mappings
"""

import argparse
import sqlite3


def main():
    parser = argparse.ArgumentParser(
        description="Show Qdrant ID to conversation mappings"
    )
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--collection", help="Filter by collection name")
    parser.add_argument("--format", choices=['table', 'list'], default='table',
                       help="Output format")

    args = parser.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    query = """
        SELECT
            qt.qdrant_id,
            qt.collection_name,
            m.platform,
            m.title,
            MIN(m.ts) as first_message,
            MAX(m.ts) as last_message,
            COUNT(m.message_id) as message_count
        FROM qdrant_threads qt
        JOIN messages m ON qt.canonical_thread_id = m.canonical_thread_id
    """

    params = []
    if args.collection:
        query += " WHERE qt.collection_name = ?"
        params.append(args.collection)

    query += " GROUP BY qt.qdrant_id, qt.collection_name, m.platform, m.title"
    query += " ORDER BY qt.qdrant_id"

    cur.execute(query, params)
    results = cur.fetchall()

    if not results:
        print("[!] No mappings found")
        return

    print(f"\n[+] Found {len(results)} Qdrant thread mappings\n")

    if args.format == 'table':
        # Table format
        print(f"{'ID':<4} {'Collection':<20} {'Platform':<12} {'Messages':<8} Title")
        print("-" * 80)
        for row in results:
            print(f"{row['qdrant_id']:<4} {row['collection_name']:<20} "
                  f"{row['platform']:<12} {row['message_count']:<8} {row['title'][:40]}")
    else:
        # List format (detailed)
        for row in results:
            print(f"Qdrant ID: {row['qdrant_id']}")
            print(f"  Collection: {row['collection_name']}")
            print(f"  Platform: {row['platform']}")
            print(f"  Title: {row['title']}")
            print(f"  Messages: {row['message_count']}")
            print(f"  Date range: {row['first_message']} to {row['last_message']}")
            print()

    con.close()


if __name__ == "__main__":
    main()
