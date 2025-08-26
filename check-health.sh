#!/bin/bash

echo "🔍 WhatsApp Bot Health Check"
echo "=========================="

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status whatsapp-transcriber

echo ""
echo "📋 Recent Logs (last 20 lines):"
pm2 logs whatsapp-transcriber --lines 20 --nostream

echo ""
echo "💾 Memory & CPU Usage:"
pm2 monit whatsapp-transcriber --no-daemon || true

echo ""
echo "📁 Log Files:"
ls -la logs/ 2>/dev/null || echo "No logs directory found"

echo ""
echo "🕒 Current Time: $(date)"
echo ""
echo "🔧 Useful Commands:"
echo "  npm run pm2:logs     # Live logs"
echo "  npm run pm2:restart  # Restart bot"
echo "  npm run pm2:status   # Current status"