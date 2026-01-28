#!/bin/bash

echo "🍺 Welcome to TavernLink Setup 🍺"
echo "---------------------------------"

# Check for Docker
if ! command -v docker &> /dev/null
then
    echo "❌ Docker could not be found. Please install Docker first."
    exit 1
fi

echo "📦 Building Docker Image... (This may take a few minutes)"
docker build -t tavernlink .

if [ $? -eq 0 ]; then
    echo "✅ Build Successful!"
else
    echo "❌ Build Failed."
    exit 1
fi

# Stop existing container if running
if [ "$(docker ps -q -f name=tavernlink_instance)" ]; then
    echo "🛑 Stopping existing instance..."
    docker stop tavernlink_instance
    docker rm tavernlink_instance
fi

echo "🚀 Running TavernLink on port 3003..."
# Ensure data directory exists on host for persistence
mkdir -p $(pwd)/data

docker run -d \
  -p 3003:3003 \
  -v "$(pwd)/data:/app/data" \
  --restart unless-stopped \
  --name tavernlink_instance \
  tavernlink

echo ""
echo "✨ TavernLink is running!"
echo "👉 Access the app at: http://localhost:3003"
echo "📂 User data is stored in: $(pwd)/data"
