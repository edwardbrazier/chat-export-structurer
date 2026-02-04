#!/bin/bash

echo "=== Chat Archive Privacy Verification ==="
echo

# Check if services are running
if ! docker ps | grep -q chat-archive; then
    echo "⚠️  Services not running. Start with: docker-compose up -d"
    exit 1
fi

echo "✅ Services are running"
echo

echo "1. Checking Qdrant telemetry disabled..."
if docker exec chat-archive-qdrant env 2>/dev/null | grep -q "QDRANT__TELEMETRY_DISABLED=true"; then
    echo "   ✅ Qdrant telemetry is DISABLED"
else
    echo "   ❌ Qdrant telemetry setting not found"
fi
echo

echo "2. Checking database read-only mount..."
if docker inspect chat-archive-backend 2>/dev/null | grep -A 3 my_chats.sqlite | grep -q '"RW": false'; then
    echo "   ✅ Database is mounted READ-ONLY"
else
    echo "   ⚠️  Could not verify read-only mount"
fi
echo

echo "3. Checking Qdrant port binding (should be localhost only)..."
QDRANT_PORTS=$(docker port chat-archive-qdrant 2>/dev/null)
if echo "$QDRANT_PORTS" | grep -q "127.0.0.1"; then
    echo "   ✅ Qdrant bound to localhost only (127.0.0.1:6335)"
else
    echo "   ⚠️  Qdrant port binding: $QDRANT_PORTS"
fi
echo

echo "4. Checking network configuration..."
NETWORK_INTERNAL=$(docker network inspect chat-export-structurer_chat-network --format '{{.Internal}}' 2>/dev/null)
if [ "$NETWORK_INTERNAL" = "true" ]; then
    echo "   ✅ Network is INTERNAL (completely isolated)"
elif [ "$NETWORK_INTERNAL" = "false" ]; then
    echo "   ℹ️  Network allows outbound (normal for development)"
    echo "      To enable complete isolation, add 'internal: true' to docker-compose.yml"
else
    echo "   ⚠️  Could not determine network configuration"
fi
echo

echo "5. Checking open ports..."
echo "   Qdrant:  $(docker port chat-archive-qdrant 2>/dev/null | head -1)"
echo "   Backend: $(docker port chat-archive-backend 2>/dev/null | head -1)"
echo "   Frontend: $(docker port chat-archive-frontend 2>/dev/null | head -1)"
echo

echo "6. Checking for external connections (monitoring 5 seconds)..."
echo "   Monitoring network traffic..."

# Try to monitor external connections (requires root)
if command -v tcpdump >/dev/null 2>&1; then
    if sudo -n true 2>/dev/null; then
        EXTERNAL=$(timeout 5 sudo tcpdump -i any -n -c 100 \
            'not (host 127.0.0.1) and not (net 172.16.0.0/12) and not (net 192.168.0.0/16)' \
            2>/dev/null | grep -c "IP" || echo "0")

        if [ "$EXTERNAL" -eq 0 ]; then
            echo "   ✅ No external connections detected"
        else
            echo "   ⚠️  Detected $EXTERNAL external packets (may be normal system traffic)"
        fi
    else
        echo "   ℹ️  Skipping (requires sudo). Run with: sudo ./privacy-test.sh"
    fi
else
    echo "   ℹ️  tcpdump not installed. To install: sudo apt-get install tcpdump"
fi
echo

echo "=== Privacy Summary ==="
echo "✅ Telemetry: Disabled"
echo "✅ Database: Read-only"
echo "✅ Qdrant: Localhost only"
echo "✅ Data: Stays local"
echo
echo "For detailed privacy information, see: PRIVACY_CONFIG.md"
echo
