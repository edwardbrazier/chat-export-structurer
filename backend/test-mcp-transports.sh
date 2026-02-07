#!/bin/bash
# Test script for MCP server transports
# This script validates both stdio and HTTP transports

set -e

echo "================================"
echo "MCP Transport Test Suite"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_passed() {
    echo -e "${GREEN}✓ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_failed() {
    echo -e "${RED}✗ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

echo "Building TypeScript..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    test_passed "TypeScript build successful"
else
    test_failed "TypeScript build failed"
    exit 1
fi

echo ""
echo "================================"
echo "Testing Stdio Transport"
echo "================================"
echo ""

# Test 1: Stdio tools/list
echo "Test 1: List tools via stdio..."
RESULT=$(echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | MODE=mcp MCP_TRANSPORT=stdio node dist/index.js 2>/dev/null)
if echo "$RESULT" | grep -q '"name":"search"' && echo "$RESULT" | grep -q '"name":"fetch"'; then
    test_passed "Stdio transport lists 'search' and 'fetch' tools"
else
    test_failed "Stdio transport tool listing failed"
fi

# Test 2: Verify old tool names are NOT present
if echo "$RESULT" | grep -q '"name":"search_chats"' || echo "$RESULT" | grep -q '"name":"get_chat"' || echo "$RESULT" | grep -q '"name":"list_chats"'; then
    test_failed "Old tool names still present (should be renamed)"
else
    test_passed "Old tool names removed (search_chats, get_chat, list_chats)"
fi

echo ""
echo "================================"
echo "Testing HTTP Transport"
echo "================================"
echo ""

# Start HTTP server in background
echo "Starting HTTP server..."
npm run dev:mcp:http > /tmp/mcp-http-test.log 2>&1 &
HTTP_PID=$!
sleep 3

# Test 3: Health endpoint
echo "Test 3: Health endpoint..."
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q '"status":"ok"' && echo "$HEALTH" | grep -q '"server":"chat-archive-mcp"'; then
    test_passed "HTTP health endpoint working"
else
    test_failed "HTTP health endpoint failed"
fi

# Test 4: HTTP tools/list
echo "Test 4: List tools via HTTP..."
HTTP_RESULT=$(curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

if echo "$HTTP_RESULT" | grep -q '"name":"search"' && echo "$HTTP_RESULT" | grep -q '"name":"fetch"'; then
    test_passed "HTTP transport lists 'search' and 'fetch' tools"
else
    test_failed "HTTP transport tool listing failed"
fi

# Test 5: Verify old tool names are NOT present in HTTP
if echo "$HTTP_RESULT" | grep -q '"name":"search_chats"' || echo "$HTTP_RESULT" | grep -q '"name":"get_chat"' || echo "$HTTP_RESULT" | grep -q '"name":"list_chats"'; then
    test_failed "Old tool names still present in HTTP (should be renamed)"
else
    test_passed "Old tool names removed in HTTP"
fi

# Test 6: Verify search tool schema
echo "Test 6: Search tool schema..."
if echo "$HTTP_RESULT" | grep -q '"mode"' && echo "$HTTP_RESULT" | grep -q '"hybrid"' && echo "$HTTP_RESULT" | grep -q '"platforms"'; then
    test_passed "Search tool schema correct (mode, platforms, limit)"
else
    test_failed "Search tool schema incomplete"
fi

# Test 7: Verify fetch tool schema
echo "Test 7: Fetch tool schema..."
if echo "$HTTP_RESULT" | grep -q '"threadId"'; then
    test_passed "Fetch tool schema correct (threadId parameter)"
else
    test_failed "Fetch tool schema incomplete"
fi

# Cleanup
echo ""
echo "Cleaning up..."
kill $HTTP_PID 2>/dev/null || true
rm -f /tmp/mcp-http-test.log

echo ""
echo "================================"
echo "Test Results Summary"
echo "================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
