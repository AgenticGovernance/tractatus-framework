#!/bin/bash

##
## SAFE Full Project Deployment Script
## Uses .rsyncignore to exclude sensitive files
##
## WARNING: Only use this for initial deployment or major updates
## For regular deployments, use deploy-frontend.sh instead
##

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_KEY="/home/theflow/.ssh/tractatus_deploy"
REMOTE_USER="ubuntu"
REMOTE_HOST="vps-93a693da.vps.ovh.net"
REMOTE_PATH="/var/www/tractatus"
PROJECT_ROOT="/home/theflow/projects/tractatus"

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   TRACTATUS FULL PROJECT DEPLOYMENT (SAFE MODE)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .rsyncignore exists
if [ ! -f "$PROJECT_ROOT/.rsyncignore" ]; then
  echo -e "${RED}ERROR: .rsyncignore not found!${NC}"
  echo "This file is required to prevent sensitive data deployment."
  echo "Expected location: $PROJECT_ROOT/.rsyncignore"
  exit 1
fi

# Show excluded patterns
echo -e "${GREEN}Security Check: .rsyncignore loaded${NC}"
echo "Excluded patterns:"
head -20 "$PROJECT_ROOT/.rsyncignore" | grep -v "^#" | grep -v "^$" | sed 's/^/  - /'
echo "  ... (see .rsyncignore for full list)"
echo ""

# Confirm deployment
echo -e "${YELLOW}WARNING: This will sync the ENTIRE project directory${NC}"
echo "Source: $PROJECT_ROOT"
echo "Destination: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo ""
read -p "Continue? (yes/NO): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo -e "${GREEN}Starting deployment...${NC}"
echo ""

# Dry run first
echo -e "${YELLOW}[1/2] Running dry-run to preview changes...${NC}"
rsync -avzn --delete \
  -e "ssh -i $DEPLOY_KEY" \
  --exclude-from="$PROJECT_ROOT/.rsyncignore" \
  "$PROJECT_ROOT/" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" \
  | tail -20

echo ""
read -p "Dry-run complete. Proceed with actual deployment? (yes/NO): " confirm2

if [ "$confirm2" != "yes" ]; then
  echo "Deployment cancelled after dry-run."
  exit 0
fi

# Actual deployment
echo ""
echo -e "${YELLOW}[2/2] Deploying to production...${NC}"
rsync -avz --delete \
  -e "ssh -i $DEPLOY_KEY" \
  --exclude-from="$PROJECT_ROOT/.rsyncignore" \
  "$PROJECT_ROOT/" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "1. Verify sensitive files NOT deployed:"
echo "   ssh -i $DEPLOY_KEY $REMOTE_USER@$REMOTE_HOST 'ls -la /var/www/tractatus/CLAUDE.md 2>/dev/null || echo NOT FOUND (good)'"
echo ""
echo "2. Restart server if needed:"
echo "   ssh -i $DEPLOY_KEY $REMOTE_USER@$REMOTE_HOST 'sudo systemctl restart tractatus'"
echo ""
echo "3. Test site: https://agenticgovernance.digital"
echo ""
