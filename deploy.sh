#!/bin/bash

# Fantasy Forge - Ship Script
#
# Runs the same checks as CI, commits your changes and pushes the current
# branch. Deployment itself happens in GitHub Actions: every merge to main
# builds ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge (private) and
# Watchtower on Unraid picks up the new :latest image.
#
# Usage: ./deploy.sh ["commit message"]
# Env:   SKIP_CHECKS=1   skip lint/typecheck/tests

set -euo pipefail

REPO="mikesawayda-adaptivesoftware/Fantasy-Forge"
REPO_URL="https://github.com/${REPO}.git"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🏈 Fantasy Forge - Ship Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

cd "$(cd "$(dirname "$0")" && pwd)"

if [ "${SKIP_CHECKS:-0}" != "1" ]; then
    echo -e "${BLUE}🧪 Running lint, type-check and tests...${NC}"
    npm run lint
    npm run typecheck
    npm test
    echo -e "${GREEN}✅ Checks passed${NC}"
    echo ""
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ -z $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    # Refuse to commit anything that looks like a secret
    SENSITIVE=$(git status --porcelain --untracked-files=all | awk '{print $NF}' | grep -Ei '(^|/)(\.env(\..*)?|.*\.pem|.*\.key|.*\.p12|id_rsa.*|credentials.*)$' | grep -v '\.env\.example$' || true)
    if [ -n "$SENSITIVE" ]; then
        echo -e "${RED}❌ Refusing to commit files that look like secrets:${NC}"
        echo "$SENSITIVE"
        echo -e "${YELLOW}Add them to .gitignore or remove them, then re-run.${NC}"
        exit 1
    fi

    COMMIT_MSG="${1:-Update Fantasy-Forge - $(date '+%Y-%m-%d %H:%M')}"
    echo -e "${YELLOW}💬 Commit message: ${COMMIT_MSG}${NC}"
    git status --short
    echo ""
    git add -A
    git commit -m "$COMMIT_MSG"
fi

if ! git remote get-url origin > /dev/null 2>&1; then
    git remote add origin "$REPO_URL"
fi

echo -e "${BLUE}🚀 Pushing ${BRANCH}...${NC}"
git push -u origin "$BRANCH"
echo -e "${GREEN}✅ Pushed${NC}"
echo ""

if [ "$BRANCH" = "main" ]; then
    echo -e "${GREEN}GitHub Actions is now verifying and publishing the image.${NC}"
    echo -e "Watch it: ${BLUE}https://github.com/${REPO}/actions/workflows/release.yml${NC}"
    echo -e "Watchtower will roll the Unraid container once ${BLUE}:latest${NC} updates."
else
    echo -e "${YELLOW}Branch ${BRANCH} was pushed. Open a pull request and merge it to main to deploy:${NC}"
    echo -e "${BLUE}https://github.com/${REPO}/compare/main...${BRANCH}?expand=1${NC}"
fi
echo ""
