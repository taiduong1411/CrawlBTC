#!/bin/bash
# Script cleanup all node and chrome processes
# Usage: ./cleanup.sh

echo "🧹 Cleaning up processes..."

# Kill all node processes related to this project
echo "Killing node processes..."
pkill -f "node server.js" 2>/dev/null
pkill -f "node index.js" 2>/dev/null
pkill -f "node debug-server.js" 2>/dev/null
pkill -f "node test-api.js" 2>/dev/null

# Kill all chromium processes
echo "Killing chromium processes..."
pkill -f chromium 2>/dev/null
pkill -f "Chromium" 2>/dev/null

# Clean temp files
echo "Cleaning temp files..."
rm -rf /tmp/puppeteer_* 2>/dev/null

# Check if anything is still running
NODE_COUNT=$(ps aux | grep -E "node (server|index|debug)" | grep -v grep | wc -l)
CHROME_COUNT=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | grep -v "Cursor\|Discord\|Postman" | wc -l)

echo ""
echo "✅ Cleanup completed!"
echo "📊 Remaining processes:"
echo "   Node: $NODE_COUNT"
echo "   Chrome: $CHROME_COUNT"

if [ $NODE_COUNT -gt 0 ] || [ $CHROME_COUNT -gt 0 ]; then
    echo ""
    echo "⚠️  Some processes still running. Use 'ps aux | grep node' to check."
fi

