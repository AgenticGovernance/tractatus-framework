#!/bin/bash
#
# Disk Space Monitoring Script
# Monitors disk space usage and alerts when thresholds exceeded
#
# Usage:
#   ./disk-monitor.sh          # Check all monitored paths
#   ./disk-monitor.sh --test   # Test mode (no alerts)
#
# Exit codes:
#   0 = OK
#   1 = Warning threshold exceeded
#   2 = Critical threshold exceeded

set -euo pipefail

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/tractatus/disk-monitor.log"
WARN_THRESHOLD=80      # Warn at 80% usage
CRITICAL_THRESHOLD=90  # Critical at 90% usage

# Paths to monitor
declare -A MONITORED_PATHS=(
  ["/"]="Root filesystem"
  ["/var"]="Var directory"
  ["/var/log"]="Log directory"
  ["/var/www/tractatus"]="Tractatus application"
  ["/tmp"]="Temp directory"
)

# Parse arguments
TEST_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
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

# Get disk usage for path
get_disk_usage() {
  local path="$1"

  # Check if path exists
  if [[ ! -e "$path" ]]; then
    echo "N/A"
    return 1
  fi

  # Get usage percentage (remove % sign)
  df -h "$path" 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' || echo "N/A"
}

# Get human-readable disk usage details
get_disk_details() {
  local path="$1"

  if [[ ! -e "$path" ]]; then
    echo "Path does not exist"
    return 1
  fi

  df -h "$path" 2>/dev/null | awk 'NR==2 {printf "Size: %s | Used: %s | Avail: %s | Use%%: %s | Mounted: %s\n", $2, $3, $4, $5, $6}'
}

# Find largest directories in path
find_largest_dirs() {
  local path="$1"
  local limit="${2:-10}"

  if [[ ! -e "$path" ]]; then
    return 1
  fi

  du -h "$path"/* 2>/dev/null | sort -rh | head -n "$limit" || echo "Unable to scan directory"
}

# Check single path
check_path() {
  local path="$1"
  local description="$2"

  local usage=$(get_disk_usage "$path")

  if [[ "$usage" == "N/A" ]]; then
    log "WARN" "$description ($path): Unable to check"
    return 0
  fi

  if [[ "$usage" -ge "$CRITICAL_THRESHOLD" ]]; then
    log "CRITICAL" "$description ($path): ${usage}% used (>= $CRITICAL_THRESHOLD%)"
    return 2
  elif [[ "$usage" -ge "$WARN_THRESHOLD" ]]; then
    log "WARN" "$description ($path): ${usage}% used (>= $WARN_THRESHOLD%)"
    return 1
  else
    log "INFO" "$description ($path): ${usage}% used"
    return 0
  fi
}

# Main monitoring function
main() {
  log "INFO" "Starting disk space monitoring"

  local max_severity=0
  local issues=()
  local critical_paths=()
  local warning_paths=()

  # Check all monitored paths
  for path in "${!MONITORED_PATHS[@]}"; do
    local description="${MONITORED_PATHS[$path]}"
    local exit_code=0

    check_path "$path" "$description" || exit_code=$?

    if [[ "$exit_code" -eq 2 ]]; then
      max_severity=2
      critical_paths+=("$path (${description})")
    elif [[ "$exit_code" -eq 1 ]]; then
      [[ "$max_severity" -lt 1 ]] && max_severity=1
      warning_paths+=("$path (${description})")
    fi
  done

  # Send alerts if thresholds exceeded
  if [[ "$max_severity" -eq 2 ]]; then
    local subject="[CRITICAL] Tractatus Disk Space Critical"
    local body="CRITICAL: Disk space usage has exceeded ${CRITICAL_THRESHOLD}% on one or more paths.

Critical Paths (>= ${CRITICAL_THRESHOLD}%):
$(printf -- "- %s\n" "${critical_paths[@]}")
"

    # Add warning paths if any
    if [[ "${#warning_paths[@]}" -gt 0 ]]; then
      body+="
Warning Paths (>= ${WARN_THRESHOLD}%):
$(printf -- "- %s\n" "${warning_paths[@]}")
"
    fi

    body+="
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Disk Usage Details:
$(df -h)

Largest directories in /var/www/tractatus:
$(find_largest_dirs /var/www/tractatus 10)

Largest log files:
$(du -h /var/log/tractatus/*.log 2>/dev/null | sort -rh | head -10 || echo "No log files found")

Action Required:
1. Clean up old log files
2. Remove unnecessary files
3. Check for runaway processes creating large files
4. Consider expanding disk space

Clean up commands:
# Rotate old logs
sudo journalctl --vacuum-time=7d

# Clean up npm cache
npm cache clean --force

# Find large files
find /var/www/tractatus -type f -size +100M -exec ls -lh {} \;
"

    send_alert "$subject" "$body"
    log "CRITICAL" "Disk space alert sent"

  elif [[ "$max_severity" -eq 1 ]]; then
    local subject="[WARN] Tractatus Disk Space Warning"
    local body="WARNING: Disk space usage has exceeded ${WARN_THRESHOLD}% on one or more paths.

Warning Paths (>= ${WARN_THRESHOLD}%):
$(printf -- "- %s\n" "${warning_paths[@]}")

Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Disk Usage:
$(df -h)

Please review disk usage and clean up if necessary.
"

    send_alert "$subject" "$body"
    log "WARN" "Disk space warning sent"
  else
    log "INFO" "All monitored paths within acceptable limits"
  fi

  exit $max_severity
}

# Run main function
main
