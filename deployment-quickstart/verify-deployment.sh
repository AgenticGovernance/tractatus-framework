#!/bin/bash

#=============================================================================
# Tractatus Deployment Verification Script
#
# Runs comprehensive checks to verify deployment is working correctly
#
# Usage: ./verify-deployment.sh
#=============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Tractatus Framework - Deployment Verification                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

#=============================================================================
# Helper Functions
#=============================================================================

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────"
}

#=============================================================================
# 1. Environment Check
#=============================================================================

section "1. Environment Variables"

if [ -f ".env" ]; then
    pass "Found .env file"

    # Check for required variables
    required_vars=(
        "MONGODB_PASSWORD"
        "JWT_SECRET"
        "SESSION_SECRET"
        "ADMIN_PASSWORD"
        "ANTHROPIC_API_KEY"
    )

    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .env && ! grep -q "^${var}=.*CHANGE.*" .env && ! grep -q "^${var}=.*YOUR.*" .env; then
            pass "$var is set"
        else
            fail "$var is missing or using default value"
        fi
    done
else
    fail ".env file not found (copy from .env.example)"
fi

#=============================================================================
# 2. Docker Services
#=============================================================================

section "2. Docker Services"

if command -v docker &> /dev/null; then
    pass "Docker is installed"

    if docker compose ps | grep -q "tractatus-mongodb.*Up"; then
        pass "MongoDB container is running"
    else
        fail "MongoDB container is not running"
    fi

    if docker compose ps | grep -q "tractatus-app.*Up"; then
        pass "Application container is running"
    else
        fail "Application container is not running"
    fi
else
    fail "Docker is not installed"
fi

#=============================================================================
# 3. Network Connectivity
#=============================================================================

section "3. Network Connectivity"

APP_URL="${BASE_URL:-http://localhost:9000}"

if curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" | grep -q "200"; then
    pass "API health endpoint responding (${APP_URL}/api/health)"
else
    fail "API health endpoint not responding"
fi

if curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/" | grep -q "200"; then
    pass "Homepage accessible (${APP_URL}/)"
else
    fail "Homepage not accessible"
fi

#=============================================================================
# 4. Database Connectivity
#=============================================================================

section "4. Database Connectivity"

if docker exec tractatus-mongodb mongosh --eval "db.runCommand({ ping: 1 })" --quiet &> /dev/null; then
    pass "MongoDB is accepting connections"

    # Check if database exists
    if docker exec tractatus-mongodb mongosh --eval "use ${MONGODB_DATABASE:-tractatus_prod}; db.stats()" --quiet &> /dev/null; then
        pass "Database '${MONGODB_DATABASE:-tractatus_prod}' exists"
    else
        warn "Database '${MONGODB_DATABASE:-tractatus_prod}' not initialized yet"
    fi
else
    fail "Cannot connect to MongoDB"
fi

#=============================================================================
# 5. Governance Services
#=============================================================================

section "5. Governance Services"

# Test BoundaryEnforcer
if curl -s -X POST "${APP_URL}/api/demo/boundary-check" \
    -H "Content-Type: application/json" \
    -d '{"scenario":"privacy-decision"}' | grep -q "allowed"; then
    pass "BoundaryEnforcer service responding"
else
    warn "BoundaryEnforcer service not responding (may not be implemented yet)"
fi

# Test Classification
if curl -s -X POST "${APP_URL}/api/demo/classify" \
    -H "Content-Type: application/json" \
    -d '{"instruction":"Test instruction"}' | grep -q "quadrant"; then
    pass "InstructionPersistenceClassifier service responding"
else
    warn "InstructionPersistenceClassifier service not responding"
fi

# Test Context Pressure
if curl -s -X POST "${APP_URL}/api/demo/pressure-check" \
    -H "Content-Type: application/json" \
    -d '{"tokens":50000,"messages":10,"errors":0}' | grep -q "level"; then
    pass "ContextPressureMonitor service responding"
else
    warn "ContextPressureMonitor service not responding"
fi

#=============================================================================
# 6. Security Headers
#=============================================================================

section "6. Security Headers"

HEADERS=$(curl -s -I "${APP_URL}/")

if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
    pass "X-Frame-Options header present"
else
    warn "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
    pass "X-Content-Type-Options header present"
else
    warn "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
    pass "Content-Security-Policy header present"
else
    warn "Content-Security-Policy header missing"
fi

#=============================================================================
# 7. File Permissions
#=============================================================================

section "7. File Permissions & Directories"

REQUIRED_DIRS=("logs" "uploads" "audit-reports")

for dir in "${REQUIRED_DIRS[@]}"; do
    if docker exec tractatus-app test -d "$dir" 2>/dev/null; then
        pass "Directory '$dir' exists"
    else
        fail "Directory '$dir' missing"
    fi
done

#=============================================================================
# Results Summary
#=============================================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Verification Results                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED tests"
echo -e "  ${RED}Failed:${NC}   $FAILED tests"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS tests"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed! Deployment is ready.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    exit 1
fi
