#!/bin/bash
#
# SSL Certificate Monitoring Script
# Monitors SSL certificate expiry and alerts before expiration
#
# Usage:
#   ./ssl-monitor.sh                       # Check all domains
#   ./ssl-monitor.sh --domain example.com  # Check specific domain
#   ./ssl-monitor.sh --test                # Test mode (no alerts)
#
# Exit codes:
#   0 = OK
#   1 = Warning (expires soon)
#   2 = Critical (expires very soon)
#   3 = Expired or error

set -euo pipefail

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/tractatus/ssl-monitor.log"
WARN_DAYS=30       # Warn 30 days before expiry
CRITICAL_DAYS=7    # Critical alert 7 days before expiry

# Default domains to monitor
DOMAINS=(
  "agenticgovernance.digital"
)

# Parse arguments
TEST_MODE=false
SPECIFIC_DOMAIN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)
      SPECIFIC_DOMAIN="$2"
      shift 2
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

# Override domains if specific domain provided
if [[ -n "$SPECIFIC_DOMAIN" ]]; then
  DOMAINS=("$SPECIFIC_DOMAIN")
fi

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

# Get SSL certificate expiry date
get_cert_expiry() {
  local domain="$1"

  # Use openssl to get certificate
  local expiry_date
  expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
    openssl x509 -noout -enddate 2>/dev/null | \
    cut -d= -f2) || {
    log "ERROR" "Failed to retrieve certificate for $domain"
    return 1
  }

  echo "$expiry_date"
}

# Get days until expiry
get_days_until_expiry() {
  local expiry_date="$1"

  # Convert expiry date to seconds since epoch
  local expiry_epoch
  expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null) || {
    log "ERROR" "Failed to parse expiry date: $expiry_date"
    return 1
  }

  # Get current time in seconds since epoch
  local now_epoch=$(date +%s)

  # Calculate days until expiry
  local seconds_until_expiry=$((expiry_epoch - now_epoch))
  local days_until_expiry=$((seconds_until_expiry / 86400))

  echo "$days_until_expiry"
}

# Get certificate details
get_cert_details() {
  local domain="$1"

  echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
    openssl x509 -noout -subject -issuer -dates 2>/dev/null || {
    echo "Failed to retrieve certificate details"
    return 1
  }
}

# Check single domain
check_domain() {
  local domain="$1"

  log "INFO" "Checking SSL certificate for $domain"

  # Get expiry date
  local expiry_date
  expiry_date=$(get_cert_expiry "$domain") || {
    log "ERROR" "Failed to check certificate for $domain"
    return 3
  }

  # Calculate days until expiry
  local days_until_expiry
  days_until_expiry=$(get_days_until_expiry "$expiry_date") || {
    log "ERROR" "Failed to calculate expiry for $domain"
    return 3
  }

  # Check if expired
  if [[ "$days_until_expiry" -lt 0 ]]; then
    log "CRITICAL" "$domain: Certificate EXPIRED ${days_until_expiry#-} days ago!"
    return 3
  fi

  # Check thresholds
  if [[ "$days_until_expiry" -le "$CRITICAL_DAYS" ]]; then
    log "CRITICAL" "$domain: Certificate expires in $days_until_expiry days (expires: $expiry_date)"
    return 2
  elif [[ "$days_until_expiry" -le "$WARN_DAYS" ]]; then
    log "WARN" "$domain: Certificate expires in $days_until_expiry days (expires: $expiry_date)"
    return 1
  else
    log "INFO" "$domain: Certificate valid for $days_until_expiry days (expires: $expiry_date)"
    return 0
  fi
}

# Main monitoring function
main() {
  log "INFO" "Starting SSL certificate monitoring"

  local max_severity=0
  local expired_domains=()
  local critical_domains=()
  local warning_domains=()

  # Check all domains
  for domain in "${DOMAINS[@]}"; do
    local exit_code=0
    local expiry_date=$(get_cert_expiry "$domain" 2>/dev/null || echo "Unknown")
    local days_until_expiry=$(get_days_until_expiry "$expiry_date" 2>/dev/null || echo "Unknown")

    check_domain "$domain" || exit_code=$?

    if [[ "$exit_code" -eq 3 ]]; then
      max_severity=3
      expired_domains+=("$domain (EXPIRED or ERROR)")
    elif [[ "$exit_code" -eq 2 ]]; then
      [[ "$max_severity" -lt 2 ]] && max_severity=2
      critical_domains+=("$domain (expires in $days_until_expiry days)")
    elif [[ "$exit_code" -eq 1 ]]; then
      [[ "$max_severity" -lt 1 ]] && max_severity=1
      warning_domains+=("$domain (expires in $days_until_expiry days)")
    fi
  done

  # Send alerts based on severity
  if [[ "$max_severity" -eq 3 ]]; then
    local subject="[CRITICAL] SSL Certificate Expired or Error"
    local body="CRITICAL: SSL certificate has expired or error occurred.

Expired/Error Domains:
$(printf -- "- %s\n" "${expired_domains[@]}")
"

    # Add other alerts if any
    if [[ "${#critical_domains[@]}" -gt 0 ]]; then
      body+="
Critical Domains (<= $CRITICAL_DAYS days):
$(printf -- "- %s\n" "${critical_domains[@]}")
"
    fi

    if [[ "${#warning_domains[@]}" -gt 0 ]]; then
      body+="
Warning Domains (<= $WARN_DAYS days):
$(printf -- "- %s\n" "${warning_domains[@]}")
"
    fi

    body+="
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Action Required:
1. Renew SSL certificate immediately
2. Check Let's Encrypt auto-renewal:
   sudo certbot renew --dry-run

Certificate details:
$(get_cert_details "${DOMAINS[0]}")

Renewal commands:
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates
"

    send_alert "$subject" "$body"
    log "CRITICAL" "SSL certificate alert sent"

  elif [[ "$max_severity" -eq 2 ]]; then
    local subject="[CRITICAL] SSL Certificate Expires Soon"
    local body="CRITICAL: SSL certificate expires in $CRITICAL_DAYS days or less.

Critical Domains (<= $CRITICAL_DAYS days):
$(printf -- "- %s\n" "${critical_domains[@]}")
"

    if [[ "${#warning_domains[@]}" -gt 0 ]]; then
      body+="
Warning Domains (<= $WARN_DAYS days):
$(printf -- "- %s\n" "${warning_domains[@]}")
"
    fi

    body+="
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Please renew certificates soon.

Check renewal:
sudo certbot renew --dry-run
"

    send_alert "$subject" "$body"
    log "CRITICAL" "SSL expiry alert sent"

  elif [[ "$max_severity" -eq 1 ]]; then
    local subject="[WARN] SSL Certificate Expires Soon"
    local body="WARNING: SSL certificate expires in $WARN_DAYS days or less.

Warning Domains (<= $WARN_DAYS days):
$(printf -- "- %s\n" "${warning_domains[@]}")

Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Host: $(hostname)

Please plan certificate renewal.
"

    send_alert "$subject" "$body"
    log "WARN" "SSL expiry warning sent"
  else
    log "INFO" "All SSL certificates valid"
  fi

  exit $max_severity
}

# Run main function
main
