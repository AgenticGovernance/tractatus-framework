#!/bin/bash
#
# Master Monitoring Script
# Orchestrates all monitoring checks for Tractatus production environment
#
# Usage:
#   ./monitor-all.sh              # Run all monitors
#   ./monitor-all.sh --test       # Test mode (no alerts)
#   ./monitor-all.sh --skip-ssl   # Skip SSL check
#
# Exit codes:
#   0 = All checks passed
#   1 = Some warnings
#   2 = Some critical issues
#   3 = Configuration error

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/tractatus/monitoring.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Parse arguments
TEST_MODE=false
SKIP_SSL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --test)
      TEST_MODE=true
      shift
      ;;
    --skip-ssl)
      SKIP_SSL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 3
      ;;
  esac
done

# Export configuration for child scripts
export ALERT_EMAIL
[[ "$TEST_MODE" == "true" ]] && TEST_FLAG="--test" || TEST_FLAG=""

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

# Run monitoring check
run_check() {
  local name="$1"
  local script="$2"
  shift 2
  local args="$@"

  log "INFO" "Running $name..."

  local exit_code=0
  "$SCRIPT_DIR/$script" $args $TEST_FLAG || exit_code=$?

  case $exit_code in
    0)
      log "INFO" "$name: OK ✓"
      ;;
    1)
      log "WARN" "$name: Warning"
      ;;
    2)
      log "CRITICAL" "$name: Critical"
      ;;
    *)
      log "ERROR" "$name: Error (exit code: $exit_code)"
      ;;
  esac

  return $exit_code
}

# Main monitoring function
main() {
  log "INFO" "=== Starting Tractatus Monitoring Suite ==="
  log "INFO" "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  log "INFO" "Host: $(hostname)"
  [[ "$TEST_MODE" == "true" ]] && log "INFO" "TEST MODE: Alerts suppressed"

  local max_severity=0
  local checks_run=0
  local checks_passed=0
  local checks_warned=0
  local checks_critical=0
  local checks_failed=0

  # Health Check
  if run_check "Health Check" "health-check.sh"; then
    ((checks_passed++))
  else
    local exit_code=$?
    [[ $exit_code -eq 1 ]] && ((checks_warned++))
    [[ $exit_code -eq 2 ]] && ((checks_critical++))
    [[ $exit_code -ge 3 ]] && ((checks_failed++))
    [[ $exit_code -gt $max_severity ]] && max_severity=$exit_code
  fi
  ((checks_run++))

  # Log Monitor
  if run_check "Log Monitor" "log-monitor.sh" --since "5 minutes ago"; then
    ((checks_passed++))
  else
    local exit_code=$?
    [[ $exit_code -eq 1 ]] && ((checks_warned++))
    [[ $exit_code -eq 2 ]] && ((checks_critical++))
    [[ $exit_code -ge 3 ]] && ((checks_failed++))
    [[ $exit_code -gt $max_severity ]] && max_severity=$exit_code
  fi
  ((checks_run++))

  # Disk Monitor
  if run_check "Disk Monitor" "disk-monitor.sh"; then
    ((checks_passed++))
  else
    local exit_code=$?
    [[ $exit_code -eq 1 ]] && ((checks_warned++))
    [[ $exit_code -eq 2 ]] && ((checks_critical++))
    [[ $exit_code -ge 3 ]] && ((checks_failed++))
    [[ $exit_code -gt $max_severity ]] && max_severity=$exit_code
  fi
  ((checks_run++))

  # SSL Monitor (optional)
  if [[ "$SKIP_SSL" != "true" ]]; then
    if run_check "SSL Monitor" "ssl-monitor.sh"; then
      ((checks_passed++))
    else
      local exit_code=$?
      [[ $exit_code -eq 1 ]] && ((checks_warned++))
      [[ $exit_code -eq 2 ]] && ((checks_critical++))
      [[ $exit_code -ge 3 ]] && ((checks_failed++))
      [[ $exit_code -gt $max_severity ]] && max_severity=$exit_code
    fi
    ((checks_run++))
  fi

  # Summary
  log "INFO" "=== Monitoring Summary ==="
  log "INFO" "Checks run: $checks_run"
  log "INFO" "Passed: $checks_passed | Warned: $checks_warned | Critical: $checks_critical | Failed: $checks_failed"

  if [[ $max_severity -eq 0 ]]; then
    log "INFO" "All monitoring checks passed ✓"
  elif [[ $max_severity -eq 1 ]]; then
    log "WARN" "Some checks returned warnings"
  elif [[ $max_severity -eq 2 ]]; then
    log "CRITICAL" "Some checks returned critical alerts"
  else
    log "ERROR" "Some checks failed"
  fi

  log "INFO" "=== Monitoring Complete ==="

  exit $max_severity
}

# Run main function
main
