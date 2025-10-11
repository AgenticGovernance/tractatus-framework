#!/bin/bash

##
## Koha Production Deployment Script
## Deploys Koha system to production WITHOUT activating Stripe
##

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production server details
SSH_KEY="/home/theflow/.ssh/tractatus_deploy"
SSH_USER="ubuntu"
SSH_HOST="vps-93a693da.vps.ovh.net"
REMOTE_PATH="/var/www/tractatus"
LOCAL_PATH="/home/theflow/projects/tractatus"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Koha Production Deployment (Pre-Stripe)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Deploy backend configuration
echo -e "${GREEN}[1/7] Deploying backend configuration...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/src/config/currencies.config.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/src/config/"

# Step 2: Deploy backend services
echo -e "${GREEN}[2/7] Deploying backend services...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/src/services/koha.service.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/src/services/"

# Step 3: Deploy backend controllers
echo -e "${GREEN}[3/7] Deploying backend controllers...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/src/controllers/koha.controller.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/src/controllers/"

# Step 4: Deploy backend models
echo -e "${GREEN}[4/7] Deploying backend models...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/src/models/Donation.model.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/src/models/"

# Step 5: Deploy backend routes
echo -e "${GREEN}[5/7] Deploying backend routes...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/src/routes/koha.routes.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/src/routes/"

# Step 6: Deploy frontend pages
echo -e "${GREEN}[6/7] Deploying frontend pages...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/public/koha.html" \
  "$LOCAL_PATH/public/privacy.html" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/public/"

rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/public/koha/" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/public/koha/"

# Step 7: Deploy frontend JavaScript
echo -e "${GREEN}[7/7] Deploying frontend JavaScript...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/public/js/utils/currency.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/public/js/utils/"

rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/public/js/components/currency-selector.js" \
  "$LOCAL_PATH/public/js/components/footer.js" \
  "$LOCAL_PATH/public/js/components/coming-soon-overlay.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/public/js/components/"

# Deploy scripts
echo -e "${GREEN}Deploying initialization scripts...${NC}"
rsync -avz -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/scripts/init-koha.js" \
  "$SSH_USER@$SSH_HOST:$REMOTE_PATH/scripts/"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Deployment Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. SSH into production: ssh -i $SSH_KEY $SSH_USER@$SSH_HOST"
echo "2. Initialize database: cd $REMOTE_PATH && node scripts/init-koha.js"
echo "3. Update .env with PLACEHOLDER Stripe keys"
echo "4. Restart server: sudo systemctl restart tractatus"
echo "5. Test API: curl https://agenticgovernance.digital/api/koha/transparency"
echo "6. Verify overlay: https://agenticgovernance.digital/koha.html"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "$LOCAL_PATH/docs/KOHA_PRODUCTION_DEPLOYMENT.md"
echo ""
