#!/bin/bash

echo "🚨 Force Recovery Script"
echo "======================"

echo "📊 Current Status:"
pm2 status whatsapp-transcriber

echo ""
echo "📋 Recent Logs:"
pm2 logs whatsapp-transcriber --lines 5 --nostream

echo ""
echo "🔄 Forcing recovery by restarting the bot..."
pm2 restart whatsapp-transcriber

echo ""
echo "⏳ Waiting 10 seconds for restart..."
sleep 10

echo ""
echo "📊 New Status:"
pm2 status whatsapp-transcriber

echo ""
echo "📋 Startup Logs:"
pm2 logs whatsapp-transcriber --lines 5 --nostream

echo ""
echo "✅ Recovery attempt complete!"
echo "💡 Monitor with: npm run pm2:logs"