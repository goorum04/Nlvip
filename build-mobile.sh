#!/bin/bash
# Build script for Capacitor (iOS/Android)
# Run this to prepare the app for mobile

echo "🔨 Building NL VIP CLUB for mobile..."

# 1. Create production build
echo "📦 Creating Next.js build..."
yarn build

# 2. Export static files
echo "📤 Exporting static files..."
yarn next export -o out

# 3. Sync with Capacitor
echo "📱 Syncing with Capacitor..."
npx cap sync

echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "  iOS:     npx cap open ios"
echo "  Android: npx cap open android"
