#!/bin/bash

# Tractatus systemd Service Installation Script
# Usage: ./scripts/install-systemd.sh [dev|prod]

set -e

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ "$ENVIRONMENT" = "dev" ]; then
  SERVICE_FILE="tractatus-dev.service"
  SERVICE_NAME="tractatus-dev"
  echo "Installing Tractatus Development Service..."
elif [ "$ENVIRONMENT" = "prod" ]; then
  SERVICE_FILE="tractatus-prod.service"
  SERVICE_NAME="tractatus"
  echo "Installing Tractatus Production Service..."
else
  echo "Error: Invalid environment. Use 'dev' or 'prod'"
  exit 1
fi

# Check if systemd service file exists
if [ ! -f "$PROJECT_ROOT/systemd/$SERVICE_FILE" ]; then
  echo "Error: Service file not found: $PROJECT_ROOT/systemd/$SERVICE_FILE"
  exit 1
fi

# Stop existing service if running
echo "Stopping existing service (if running)..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

# Copy service file to systemd directory
echo "Installing service file..."
sudo cp "$PROJECT_ROOT/systemd/$SERVICE_FILE" "/etc/systemd/system/$SERVICE_NAME.service"

# Set proper permissions
sudo chmod 644 "/etc/systemd/system/$SERVICE_NAME.service"

# Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service to start on boot
echo "Enabling service to start on boot..."
sudo systemctl enable $SERVICE_NAME

# Start the service
echo "Starting service..."
sudo systemctl start $SERVICE_NAME

# Show status
echo ""
echo "Service installation complete!"
echo ""
sudo systemctl status $SERVICE_NAME --no-pager

echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME     # Check status"
echo "  sudo systemctl restart $SERVICE_NAME    # Restart service"
echo "  sudo systemctl stop $SERVICE_NAME       # Stop service"
echo "  sudo journalctl -u $SERVICE_NAME -f    # View logs (follow)"
echo "  sudo journalctl -u $SERVICE_NAME --since today  # Today's logs"
