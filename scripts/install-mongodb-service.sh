#!/bin/bash
#
# Install mongodb-tractatus systemd service
# Run with: sudo ./install-mongodb-service.sh
#

set -e

SERVICE_NAME="mongodb-tractatus.service"
SERVICE_FILE="./mongodb-tractatus.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "Installing MongoDB Tractatus systemd service..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run with sudo"
    exit 1
fi

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Error: $SERVICE_FILE not found in current directory"
    exit 1
fi

# Copy service file to systemd directory
echo "Copying service file to $SYSTEMD_DIR..."
cp "$SERVICE_FILE" "$SYSTEMD_DIR/$SERVICE_NAME"

# Set correct permissions
chmod 644 "$SYSTEMD_DIR/$SERVICE_NAME"

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable service to start on boot
echo "Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

echo ""
echo "MongoDB Tractatus service installed successfully!"
echo ""
echo "Commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "To start the service now, run:"
echo "  sudo systemctl start $SERVICE_NAME"
