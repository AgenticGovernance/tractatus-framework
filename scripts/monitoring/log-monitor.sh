#!/bin/bash
#
# Log Monitoring Script
# Monitors Tractatus service logs for errors, security events, and anomalies
#
# Usage:
#   ./log-monitor.sh                  # Monitor logs since last check
#   ./log-monitor.sh --since "1 hour" # Monitor specific time window
#   ./log-monitor.sh --follow         # Continuous monitoring
#   ./log-monitor.sh --test           # Test mode (no alerts)
#
# Exit codes:
#   0 = No issues found
#   1 = Errors detected
#   2 = Critical errors detected
#   3 = Configuration error

set -euo pipefail

# Configuration
SERVICE_NAME="${SERVICE_NAME:-tractatus}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/tractatus/log-monitor.log"
STATE_FILE="/var/tmp/tractatus-log-monitor-state"
ERROR_THRESHOLD=10     # Alert after 10 errors in window
CRITICAL_THRESHOLD=3   # Alert immediately after 3 critical errors

# Parse arguments
SINCE="5 minutes ago"
FOLLOW=false
TEST_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --since)
      SINCE="$2"
      shift 2
      ;;
    --follow)
      FOLLOW=true
      shift
      ;;
    --test)
      TEST_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 3
      ;;
  esac
done

# Logging function
log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo "[$timestamp] [$level] $message"

  # Log to file if directory exists
  if [[ -d "$(dirname "$LOG_FILE")" ]]; then
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
  fi
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
    log "WARN" "No email command available"
  fi
}

# Extract errors from logs
extract_errors() {
  local since="$1"

  # Get logs since specified time
  sudo journalctl -u "$SERVICE_NAME" --since "$since" --no-pager 2>/dev/null || {
    log "ERROR" "Failed to read journal for $SERVICE_NAME"
    return 1
  }
}

# Analyze log patterns
analyze_logs() {
  local logs="$1"

  # Count different severity levels (grep -c returns 0 if no matches, no need for fallback)
  local error_count=$(echo "$logs" | grep -ci "\[ERROR\]" || true)
  [[ -z "$error_count" ]] && error_count=0

  local critical_count=$(echo "$logs" | grep -ci "\[CRITICAL\]" || true)
  [[ -z "$critical_count" ]] && critical_count=0

  local warn_count=$(echo "$logs" | grep -ci "\[WARN\]" || true)
  [[ -z "$warn_count" ]] && warn_count=0

  # Security-related patterns
  local security_count=$(echo "$logs" | grep -ciE "(SECURITY|unauthorized|forbidden|authentication failed)" || true)
  [[ -z "$security_count" ]] && security_count=0

  # Database errors
  local db_error_count=$(echo "$logs" | grep -ciE "(mongodb|database|connection.*failed)" || true)
  [[ -z "$db_error_count" ]] && db_error_count=0

  # HTTP errors
  local http_error_count=$(echo "$logs" | grep -ciE "HTTP.*50[0-9]|Internal Server Error" || true)
  [[ -z "$http_error_count" ]] && http_error_count=0

  # Unhandled exceptions
  local exception_count=$(echo "$logs" | grep -ciE "(Unhandled.*exception|TypeError|ReferenceError)" || true)
  [[ -z "$exception_count" ]] && exception_count=0

  log "INFO" "Log analysis: CRITICAL=$critical_count ERROR=$error_count WARN=$warn_count SECURITY=$security_count DB_ERROR=$db_error_count HTTP_ERROR=$http_error_count EXCEPTION=$exception_count"

  # Determine severity
  if [[ "$critical_count" -ge "$CRITICAL_THRESHOLD" ]]; then
    log "CRITICAL" "Critical error threshold exceeded: $critical_count critical errors"
    return 2
  fi

  if [[ "$error_count" -ge "$ERROR_THRESHOLD" ]]; then
    log "ERROR" "Error threshold exceeded: $error_count errors"
    return 1
  fi

  if [[ "$security_count" -gt 0 ]]; then
    log "WARN" "Security events detected: $security_count events"
  fi

  if [[ "$db_error_count" -gt 5 ]]; then
    log "WARN" "Database errors detected: $db_error_count errors"
  fi

  if [[ "$exception_count" -gt 0 ]]; then
    log "WARN" "Unhandled exceptions detected: $exception_count exceptions"
  fi

  return 0
}

# Extract top error messages
get_top_errors() {
  local logs="$1"
  local limit="${2:-10}"

  echo "$logs" | grep -iE "\[ERROR\]|\[CRITICAL\]" | \
    sed 's/^.*\] //' | \
    sort | uniq -c | sort -rn | head -n "$limit"
}

# Main monitoring function
main() {
  log "INFO" "Starting log monitoring (since: $SINCE)"

  # Extract logs
  local logs
  logs=$(extract_errors "$SINCE") || {
    log "ERROR" "Failed to extract logs"
    exit 3
  }

  # Count total log entries
  local log_count=$(echo "$logs" | wc -l)
  log "INFO" "Analyzing $log_count log entries"

  if [[ "$log_count" -eq 0 ]]; then
    log "INFO" "No logs found in time window"
    exit 0
  fi

  # Analyze logs
  local exit_code=0
  analyze_logs "$logs" || exit_code=$?

  # If errors detected, send alert
  if [[ "$exit_code" -ne 0 ]]; then
    local severity="ERROR"
    [[ "$exit_code" -eq 2 ]] && severity="CRITICAL"

    local subject="[ALERT] Tractatus Log Monitoring - $severity Detected"

    # Extract top 10 error messages
    local top_errors=$(get_top_errors "$logs" 10)

    local body="Log monitoring detected $severity level issues in Tractatus service.

Time Window: $SINCE
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)
Service: $SERVICE_NAME

Top Error Messages:
$top_errors

Recent Critical/Error Logs:
$(echo "$logs" | grep -iE "\[ERROR\]|\[CRITICAL\]" | tail -n 20)

Full logs:
sudo journalctl -u $SERVICE_NAME --since \"$SINCE\"

Check service status:
sudo systemctl status $SERVICE_NAME
"

    send_alert "$subject" "$body"
  else
    log "INFO" "No significant issues detected"
  fi

  exit $exit_code
}

# Follow mode (continuous monitoring)
follow_logs() {
  log "INFO" "Starting continuous log monitoring"

  sudo journalctl -u "$SERVICE_NAME" -f --no-pager | while read -r line; do
    # Check for error patterns
    if echo "$line" | grep -qiE "\[ERROR\]|\[CRITICAL\]"; then
      log "ERROR" "$line"

      # Extract error message
      local error_msg=$(echo "$line" | sed 's/^.*\] //')

      # Check for critical patterns
      if echo "$line" | grep -qiE "\[CRITICAL\]|Unhandled.*exception|Database.*failed|Service.*crashed"; then
        local subject="[CRITICAL] Tractatus Error Detected"
        local body="Critical error detected in Tractatus logs:

$line

Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Recent logs:
$(sudo journalctl -u $SERVICE_NAME -n 10 --no-pager)
"
        send_alert "$subject" "$body"
      fi
    fi
  done
}

# Run appropriate mode
if [[ "$FOLLOW" == "true" ]]; then
  follow_logs
else
  main
fi
