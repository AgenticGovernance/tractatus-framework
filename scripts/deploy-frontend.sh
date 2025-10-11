#!/bin/bash

# Deploy Frontend with Automatic Cache Busting
# Ensures users always get latest JS/CSS without manual cache clearing

set -e

TIMESTAMP=$(date +%s)
DEPLOY_KEY="/home/theflow/.ssh/tractatus_deploy"
REMOTE_USER="ubuntu"
REMOTE_HOST="vps-93a693da.vps.ovh.net"
REMOTE_PATH="/var/www/tractatus/public"

echo "=== Frontend Deployment with Cache Busting ==="
echo ""
echo "Timestamp: $TIMESTAMP"
echo ""

# Update cache-busting version in all HTML files
echo "Updating cache-busting versions..."
find public -name "*.html" -type f | while read -r file; do
  # Update script tags - match .js followed by anything (including ?v=digits) before closing quote
  sed -i "s|\(src=\"[^\"]*\.js\)[^\"]*\"|\1?v=${TIMESTAMP}\"|g" "$file"
  # Update link tags (CSS) - same pattern
  sed -i "s|\(href=\"[^\"]*\.css\)[^\"]*\"|\1?v=${TIMESTAMP}\"|g" "$file"
  echo "  ✓ Updated: $file"
done

echo ""
echo "Deploying to production..."

# Deploy all public files
rsync -avz --delete \
  -e "ssh -i $DEPLOY_KEY" \
  --exclude='node_modules' \
  --exclude='.git' \
  public/ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "All users will receive new version: $TIMESTAMP"
echo "No cache clearing required!"
echo ""
echo "Test URL: https://agenticgovernance.digital"
