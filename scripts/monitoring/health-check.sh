#!/bin/bash
#
# Health Check Monitoring Script
# Monitors Tractatus application health endpoint and service status
#
# Usage:
#   ./health-check.sh                 # Run check, alert if issues
#   ./health-check.sh --quiet         # Suppress output unless error
#   ./health-check.sh --test          # Test mode (no alerts)
#
# Exit codes:
#   0 = Healthy
#   1 = Health endpoint failed
#   2 = Service not running
#   3 = Configuration error

set -euo pipefail

# Configuration
HEALTH_URL="${HEALTH_URL:-https://agenticgovernance.digital/health}"
SERVICE_NAME="${SERVICE_NAME:-tractatus}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/tractatus/health-check.log"
STATE_FILE="/var/tmp/tractatus-health-state"
MAX_FAILURES=3  # Alert after 3 consecutive failures

# Parse arguments
QUIET=false
TEST_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --quiet) QUIET=true; shift ;;
    --test) TEST_MODE=true; shift ;;
    *) echo "Unknown option: $1"; exit 3 ;;
  esac
done

# Logging function
log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  if [[ "$QUIET" != "true" ]] || [[ "$level" == "ERROR" ]] || [[ "$level" == "CRITICAL" ]]; then
    echo "[$timestamp] [$level] $message"
  fi

  # Log to file if directory exists
  if [[ -d "$(dirname "$LOG_FILE")" ]]; then
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
  fi
}

# Get current failure count
get_failure_count() {
  if [[ -f "$STATE_FILE" ]]; then
    cat "$STATE_FILE"
  else
    echo "0"
  fi
}

# Increment failure count
increment_failure_count() {
  local count=$(get_failure_count)
  echo $((count + 1)) > "$STATE_FILE"
}

# Reset failure count
reset_failure_count() {
  echo "0" > "$STATE_FILE"
}

# Send alert email
send_alert() {
  local subject="$1"
  local body="$2"

  if [[ "$TEST_MODE" == "true" ]]; then
    log "INFO" "TEST MODE: Would send alert: $subject"
    return 0
  fi

  if [[ -z "$ALERT_EMAIL" ]]; then
    log "WARN" "No alert email configured (ALERT_EMAIL not set)"
    return 0
  fi

  # Try to send email using mail command (if available)
  if command -v mail &> /dev/null; then
    echo "$body" | mail -s "$subject" "$ALERT_EMAIL"
    log "INFO" "Alert email sent to $ALERT_EMAIL"
  elif command -v sendmail &> /dev/null; then
    {
      echo "Subject: $subject"
      echo "From: tractatus-monitoring@agenticgovernance.digital"
      echo "To: $ALERT_EMAIL"
      echo ""
      echo "$body"
    } | sendmail "$ALERT_EMAIL"
    log "INFO" "Alert email sent via sendmail to $ALERT_EMAIL"
  else
    log "WARN" "No email command available (install mailutils or sendmail)"
  fi
}

# Check health endpoint
check_health_endpoint() {
  log "INFO" "Checking health endpoint: $HEALTH_URL"

  # Make HTTP request with timeout
  local response
  local http_code

  response=$(curl -s -w "\n%{http_code}" --max-time 10 "$HEALTH_URL" 2>&1) || {
    log "ERROR" "Health endpoint request failed: $response"
    return 1
  }

  # Extract HTTP code (last line)
  http_code=$(echo "$response" | tail -n 1)

  # Extract response body (everything except last line)
  local body=$(echo "$response" | sed '$d')

  # Check HTTP status
  if [[ "$http_code" != "200" ]]; then
    log "ERROR" "Health endpoint returned HTTP $http_code"
    return 1
  fi

  # Check response contains expected JSON
  if ! echo "$body" | jq -e '.status == "ok"' &> /dev/null; then
    log "ERROR" "Health endpoint response invalid: $body"
    return 1
  fi

  log "INFO" "Health endpoint OK (HTTP $http_code)"
  return 0
}

# Check systemd service status
check_service_status() {
  log "INFO" "Checking service status: $SERVICE_NAME"

  if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    log "ERROR" "Service $SERVICE_NAME is not active"
    return 2
  fi

  # Check if service is enabled
  if ! systemctl is-enabled --quiet "$SERVICE_NAME"; then
    log "WARN" "Service $SERVICE_NAME is not enabled (won't start on boot)"
  fi

  log "INFO" "Service $SERVICE_NAME is active"
  return 0
}

# Check database connectivity (quick MongoDB ping)
check_database() {
  log "INFO" "Checking database connectivity"

  # Try to connect to MongoDB (timeout 5 seconds)
  if ! timeout 5 mongosh --quiet --eval "db.adminCommand('ping')" localhost:27017/tractatus_prod &> /dev/null; then
    log "ERROR" "Database connection failed"
    return 1
  fi

  log "INFO" "Database connectivity OK"
  return 0
}

# Check disk space
check_disk_space() {
  log "INFO" "Checking disk space"

  # Get root filesystem usage percentage
  local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

  if [[ "$usage" -gt 90 ]]; then
    log "CRITICAL" "Disk space critical: ${usage}% used"
    return 1
  elif [[ "$usage" -gt 80 ]]; then
    log "WARN" "Disk space high: ${usage}% used"
  else
    log "INFO" "Disk space OK: ${usage}% used"
  fi

  return 0
}

# Main health check
main() {
  log "INFO" "Starting health check"

  local all_healthy=true
  local issues=()

  # Run all checks
  if ! check_service_status; then
    all_healthy=false
    issues+=("Service not running")
  fi

  if ! check_health_endpoint; then
    all_healthy=false
    issues+=("Health endpoint failed")
  fi

  if ! check_database; then
    all_healthy=false
    issues+=("Database connectivity failed")
  fi

  if ! check_disk_space; then
    all_healthy=false
    issues+=("Disk space issue")
  fi

  # Handle results
  if [[ "$all_healthy" == "true" ]]; then
    log "INFO" "All health checks passed ✓"
    reset_failure_count
    exit 0
  else
    log "ERROR" "Health check failed: ${issues[*]}"
    increment_failure_count

    local failure_count=$(get_failure_count)
    log "WARN" "Consecutive failures: $failure_count/$MAX_FAILURES"

    # Alert if threshold reached
    if [[ "$failure_count" -ge "$MAX_FAILURES" ]]; then
      local subject="[ALERT] Tractatus Health Check Failed ($failure_count failures)"
      local body="Tractatus health check has failed $failure_count times consecutively.

Issues detected:
$(printf -- "- %s\n" "${issues[@]}")

Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)
Service: $SERVICE_NAME
Health URL: $HEALTH_URL

Please investigate immediately.

View logs:
sudo journalctl -u $SERVICE_NAME -n 100

Check service status:
sudo systemctl status $SERVICE_NAME

Restart service:
sudo systemctl restart $SERVICE_NAME
"

      send_alert "$subject" "$body"
      log "CRITICAL" "Alert sent after $failure_count consecutive failures"
    fi

    exit 1
  fi
}

# Run main function
main
