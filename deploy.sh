#!/bin/bash

# Fantasy Forge - Deploy Script
# This script commits changes to GitHub and pushes a new Docker image to ghcr.io

set -e  # Exit on error

GITHUB_USERNAME="mikesawayda-adaptivesoftware"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🏈 Fantasy Forge - Deploy Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="fantasy-forge"

# Navigate to the project root (EverythingHub)
cd "$SCRIPT_DIR/.."
PROJECT_ROOT=$(pwd)
APP_DIR="$PROJECT_ROOT/$APP_NAME"

echo -e "${YELLOW}📁 Project root: $PROJECT_ROOT${NC}"
echo -e "${YELLOW}📁 App directory: $APP_DIR${NC}"
echo ""

# Check for uncommitted changes in the fantasy-forge directory only
cd "$PROJECT_ROOT"
if [[ -z $(git status -s "$APP_NAME/") ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit in $APP_NAME/${NC}"
else
    # Get commit message from user or use default
    if [ -z "$1" ]; then
        # Generate a default commit message with timestamp
        COMMIT_MSG="Update fantasy-forge app - $(date '+%Y-%m-%d %H:%M')"
        echo -e "${YELLOW}💬 Using default commit message: ${COMMIT_MSG}${NC}"
    else
        COMMIT_MSG="$1"
        echo -e "${YELLOW}💬 Commit message: ${COMMIT_MSG}${NC}"
    fi
    echo ""

    # Stage only changes in the fantasy-forge directory
    echo -e "${BLUE}📦 Staging changes in $APP_NAME/...${NC}"
    git add "$APP_NAME/"

    # Commit
    echo -e "${BLUE}✍️  Committing...${NC}"
    git commit -m "$COMMIT_MSG"

    # Push to GitHub
    echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
    REPO_URL="https://github.com/mikesawayda-adaptivesoftware/Fantasy-Forge.git"
    git remote add fantasy-forge ${REPO_URL} 2>/dev/null || git remote set-url fantasy-forge ${REPO_URL}
    git push fantasy-forge main
    echo -e "${GREEN}✅ GitHub updated successfully!${NC}"
fi
echo ""

# Login to GitHub Container Registry
echo -e "${BLUE}🔑 Logging into ghcr.io...${NC}"
gh auth token | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
echo -e "${GREEN}✅ Logged into ghcr.io${NC}"
echo ""

# Build and push Docker image to ghcr.io
echo -e "${BLUE}🐳 Building Docker image for linux/amd64 and pushing to ghcr.io...${NC}"
cd "$APP_DIR"

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker buildx is not available. Please install it first.${NC}"
    exit 1
fi

# Create/use buildx builder
docker buildx create --name mybuilder --use 2>/dev/null || docker buildx use mybuilder 2>/dev/null || true

# Build and push
echo -e "${YELLOW}⏳ This may take a few minutes...${NC}"
docker buildx build --platform linux/amd64 -t ghcr.io/${GITHUB_USERNAME}/fantasy-forge:latest --push .

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Display the Unraid setup instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🖥️  UNRAID SETUP INSTRUCTIONS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}FIRST TIME SETUP:${NC}"
echo ""
echo -e "  1. SSH into your Unraid server."
echo ""
echo -e "  2. Login to GitHub Container Registry (one-time setup):"
echo ""
echo -e "     ${GREEN}echo 'YOUR_GITHUB_PAT_HERE' | docker login ghcr.io -u ${GITHUB_USERNAME} --password-stdin${NC}"
echo ""
echo -e "  3. Pull the latest image:"
echo ""
echo -e "     ${GREEN}docker pull ghcr.io/${GITHUB_USERNAME}/fantasy-forge:latest${NC}"
echo ""
echo -e "  4. Stop/remove any old containers (if exists):"
echo ""
echo -e "     ${GREEN}docker rm -f fantasy-forge 2>/dev/null || true${NC}"
echo ""
echo -e "  5. Run the container:"
echo ""
echo -e "     ${GREEN}docker run -d \\\\${NC}"
echo -e "     ${GREEN}  --name fantasy-forge \\\\${NC}"
echo -e "     ${GREEN}  --restart unless-stopped \\\\${NC}"
echo -e "     ${GREEN}  -p 3085:3000 \\\\${NC}"
echo -e "     ${GREEN}  ghcr.io/${GITHUB_USERNAME}/fantasy-forge:latest${NC}"
echo ""
echo -e "  6. Watch logs:"
echo ""
echo -e "     ${GREEN}docker logs -f fantasy-forge${NC}"
echo ""
echo -e "${YELLOW}TO UPDATE (after future deploys):${NC}"
echo ""
echo -e "     ${GREEN}docker pull ghcr.io/${GITHUB_USERNAME}/fantasy-forge:latest${NC}"
echo -e "     ${GREEN}docker rm -f fantasy-forge 2>/dev/null || true${NC}"
echo -e "     ${GREEN}docker run -d \\\\${NC}"
echo -e "     ${GREEN}       --name fantasy-forge \\\\${NC}"
echo -e "     ${GREEN}       --restart unless-stopped \\\\${NC}"
echo -e "     ${GREEN}       -p 3085:3000 \\\\${NC}"
echo -e "     ${GREEN}       ghcr.io/${GITHUB_USERNAME}/fantasy-forge:latest${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🌐 Access: http://192.168.0.248:3085${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
