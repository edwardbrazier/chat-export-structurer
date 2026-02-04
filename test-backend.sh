#!/bin/bash

# Test script for the backend API

API_URL="http://localhost:5000"

echo "Testing Chat Archive Backend API"
echo "=================================="
echo

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$API_URL/health" | jq .
echo

# Test stats
echo "2. Testing stats endpoint..."
curl -s "$API_URL/api/v1/chats/stats/overview" | jq .
echo

# Test list chats
echo "3. Testing list chats (first page)..."
curl -s "$API_URL/api/v1/chats?page=1&pageSize=5" | jq '.items[] | {threadId, title, platform, messageCount}'
echo

# Test keyword search
echo "4. Testing keyword search..."
curl -s -X POST "$API_URL/api/v1/search/keyword" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 3}' | jq '.results[] | {title, platform, score, matchSource}'
echo

# Test semantic search (if Qdrant is running)
echo "5. Testing semantic search..."
curl -s -X POST "$API_URL/api/v1/search/semantic" \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "limit": 3}' | jq '.results[] | {title, platform, score, matchSource}'
echo

# Test hybrid search
echo "6. Testing hybrid search..."
curl -s -X POST "$API_URL/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "programming", "mode": "hybrid", "limit": 3}' | jq '.metadata'
echo

echo "Testing complete!"
