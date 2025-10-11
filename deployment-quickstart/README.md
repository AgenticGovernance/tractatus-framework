# Tractatus Framework - Deployment Quickstart Kit

**Deploy Tractatus in 30 minutes** - Production-ready Docker deployment with all 5 governance services.

## 🎯 What You Get

- **MongoDB 7.0** - Database for governance rules and audit logs
- **Node.js Application** - Web interface and API
- **5 Core Governance Services:**
  - BoundaryEnforcer - Prevents automation of values decisions
  - InstructionPersistenceClassifier - Classifies and stores instructions
  - CrossReferenceValidator - Prevents pattern bias override
  - ContextPressureMonitor - Detects degraded operating conditions
  - MetacognitiveVerifier - Self-checks complex reasoning
- **Sample Governance Rules** - 10 example rules to get started
- **Verification Script** - Automated deployment testing
- **Troubleshooting Guide** - Common issues and solutions

---

## 📋 Prerequisites

### Required

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- **2GB RAM minimum** (4GB recommended)
- **10GB disk space**

### Recommended

- **Domain name** with DNS configured
- **SSL certificate** (Let's Encrypt recommended)
- **Anthropic API key** (for AI-assisted features)

### Check Your System

```bash
docker --version          # Should be 20.10+
docker compose version    # Should be 2.0+
```

---

## 🚀 Quick Start (30 Minutes)

### Step 1: Download and Extract (2 minutes)

```bash
# Download deployment package
wget https://agenticgovernance.digital/downloads/tractatus-quickstart.tar.gz

# Extract
tar -xzf tractatus-quickstart.tar.gz
cd tractatus-quickstart
```

### Step 2: Configure Environment (5 minutes)

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # or vi, emacs, code, etc.
```

**⚠️ CRITICAL: Update these values in .env:**

```bash
# Generate secure secrets:
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for SESSION_SECRET
openssl rand -base64 32  # Use for MONGODB_PASSWORD

# Required changes:
MONGODB_PASSWORD=<paste-first-secret>
JWT_SECRET=<paste-second-secret>
SESSION_SECRET=<paste-third-secret>
ADMIN_PASSWORD=<choose-strong-password>
ADMIN_EMAIL=admin@your-domain.com
BASE_URL=https://your-domain.com
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Get from console.anthropic.com
```

### Step 3: Build and Start (10 minutes)

```bash
# Build containers
docker compose build

# Start services
docker compose up -d

# Watch logs (Ctrl+C to exit, containers keep running)
docker compose logs -f
```

**Wait for:** `Server started on port 9000` and `MongoDB connected successfully`

### Step 4: Initialize Database (3 minutes)

```bash
# Create admin account and seed initial data
docker compose exec tractatus-app node scripts/seed-admin.js
docker compose exec tractatus-app node scripts/init-db.js

# Optional: Load sample governance rules
docker compose exec tractatus-app node scripts/load-governance-rules.js sample-governance-rules.json
```

### Step 5: Verify Deployment (5 minutes)

```bash
# Run automated verification
chmod +x verify-deployment.sh
./verify-deployment.sh
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════════════╗
║                     Verification Results                           ║
╚════════════════════════════════════════════════════════════════════╝

  Passed:   20 tests
  Failed:   0 tests
  Warnings: 2 tests

✓ All critical tests passed! Deployment is ready.
```

### Step 6: Access Your Deployment (5 minutes)

1. **Homepage:** http://localhost:9000 (or your domain)
2. **Admin Panel:** http://localhost:9000/admin
   - Email: (from .env)
   - Password: (from .env)
3. **API Health:** http://localhost:9000/api/health
4. **Interactive Demos:** http://localhost:9000/demos/tractatus-demo.html

---

## 🔧 Configuration Guide

### Basic Configuration

**Minimal .env for local development:**

```bash
NODE_ENV=development
MONGODB_PASSWORD=dev_password_123
JWT_SECRET=dev_jwt_secret_456
SESSION_SECRET=dev_session_secret_789
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@localhost
ANTHROPIC_API_KEY=sk-ant-your-key
```

### Production Configuration

**Recommended .env for production:**

```bash
NODE_ENV=production
BASE_URL=https://your-domain.com

# Secrets (use openssl rand -base64 32)
MONGODB_PASSWORD=<strong-random-password>
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>

# Admin
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=<strong-password>

# API
ANTHROPIC_API_KEY=sk-ant-your-production-key

# Security
HELMET_ENABLED=true
CSP_ENABLED=true
CORS_ORIGIN=https://your-domain.com

# Performance
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Features
BLOG_ENABLED=true
KOHA_ENABLED=true
DEMOS_ENABLED=true
ANALYTICS_ENABLED=false  # Set to true after configuring Plausible
```

### Governance Service Configuration

Enable/disable individual services:

```bash
BOUNDARY_ENFORCER_ENABLED=true         # Blocks values decisions
CONTEXT_PRESSURE_ENABLED=true         # Monitors session degradation
CROSS_REF_VALIDATOR_ENABLED=true      # Prevents pattern bias
PERSISTENCE_CLASSIFIER_ENABLED=true   # Classifies instructions
METACOGNITIVE_VERIFIER_ENABLED=true   # Self-verification
```

---

## 📊 Governance Rules

### Loading Sample Rules

The deployment includes 10 sample governance rules covering:

- **Strategic:** Values decisions, Te Tiriti commitments
- **Operational:** Classification, context pressure
- **System:** Database configuration, project isolation
- **Security:** Content Security Policy enforcement
- **Quality:** World-class standards

**Load rules:**

```bash
docker compose exec tractatus-app node scripts/load-governance-rules.js sample-governance-rules.json
```

### Creating Custom Rules

See `sample-governance-rules.json` for the schema. Each rule includes:

```json
{
  "rule_id": "CUSTOM-001",
  "quadrant": "STRATEGIC|OPERATIONAL|TACTICAL|SYSTEM|STOCHASTIC",
  "persistence": "HIGH|MEDIUM|LOW|VARIABLE",
  "title": "Rule Title",
  "content": "What the rule enforces",
  "enforced_by": "BoundaryEnforcer|CrossReferenceValidator|...",
  "violation_action": "BLOCK_AND_ESCALATE|WARN|LOG",
  "examples": ["Example 1", "Example 2"],
  "rationale": "Why this rule exists"
}
```

---

## 🧪 Testing Your Deployment

### Manual Tests

**1. Test Homepage:**
```bash
curl http://localhost:9000/
# Should return HTML homepage
```

**2. Test API Health:**
```bash
curl http://localhost:9000/api/health
# Should return: {"status":"ok","database":"connected"}
```

**3. Test BoundaryEnforcer:**
```bash
curl -X POST http://localhost:9000/api/demo/boundary-check \
  -H "Content-Type: application/json" \
  -d '{"scenario":"privacy-decision"}'
# Should return: {"allowed":false,"reason":"Values decision requires human approval"}
```

**4. Test Classification:**
```bash
curl -X POST http://localhost:9000/api/demo/classify \
  -H "Content-Type: application/json" \
  -d '{"instruction":"Use MongoDB port 27027"}'
# Should return classification with quadrant and persistence
```

### Automated Test Suite

```bash
# Run all tests
docker compose exec tractatus-app npm test

# Run specific test suites
docker compose exec tractatus-app npm run test:unit
docker compose exec tractatus-app npm run test:integration
docker compose exec tractatus-app npm run test:security
```

---

## 📈 Monitoring & Maintenance

### View Logs

```bash
# All logs
docker compose logs -f

# Application only
docker compose logs -f tractatus-app

# MongoDB only
docker compose logs -f mongodb

# Last 100 lines
docker compose logs --tail=100 tractatus-app
```

### Check Resource Usage

```bash
docker stats
```

### Backup Database

```bash
# Create backup
docker exec tractatus-mongodb mongodump \
  --db tractatus_prod \
  --out /tmp/backup

# Copy backup to host
docker cp tractatus-mongodb:/tmp/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Restore Database

```bash
# Copy backup to container
docker cp ./mongodb-backup-20251012 tractatus-mongodb:/tmp/restore

# Restore
docker exec tractatus-mongodb mongorestore \
  --db tractatus_prod \
  /tmp/restore/tractatus_prod
```

---

## 🔄 Updating

### Update Application Code

```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker compose build

# Restart with zero downtime
docker compose up -d
```

### Update Dependencies

```bash
# Update package.json
docker compose exec tractatus-app npm update

# Rebuild
docker compose build
docker compose up -d
```

---

## 🛑 Stopping & Restarting

### Stop Services

```bash
# Stop all services (data persists)
docker compose down

# Stop and remove volumes (⚠️ destroys data)
docker compose down -v
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart tractatus-app
```

---

## 🚨 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions to common issues:

- Docker container won't start
- Database connection failures
- Port conflicts
- Governance services not responding
- Performance issues
- Security errors

**Quick diagnostic:**

```bash
./verify-deployment.sh
```

---

## 📚 Next Steps

1. **Customize Governance Rules** - Edit `sample-governance-rules.json` for your use case
2. **Configure SSL** - Set up HTTPS with Let's Encrypt
3. **Set Up Monitoring** - Configure Plausible Analytics (privacy-preserving)
4. **Create Admin Users** - Add team members to admin panel
5. **Review Documentation** - https://agenticgovernance.digital/docs
6. **Join Community** - Submit case studies, contribute rules

---

## 🤝 Support

- **Documentation:** https://agenticgovernance.digital/docs
- **Interactive Demos:** https://agenticgovernance.digital/demos
- **Case Studies:** https://agenticgovernance.digital/docs/case-studies
- **GitHub Issues:** https://github.com/AgenticGovernance/tractatus-framework/issues
- **Email:** research@agenticgovernance.digital

---

## 📄 License

Apache License 2.0 - See LICENSE file for details

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                                                             │
│  ┌──────────────────┐           ┌────────────────────────┐ │
│  │   MongoDB 7.0    │           │   Tractatus App        │ │
│  │   Port: 27017    │◄──────────┤   Port: 9000           │ │
│  │                  │           │                        │ │
│  │  - tractatus_prod│           │  ┌──────────────────┐  │ │
│  │  - Governance    │           │  │  5 Core Services  │  │ │
│  │    Rules         │           │  ├──────────────────┤  │ │
│  │  - Audit Logs    │           │  │ • Boundary       │  │ │
│  └──────────────────┘           │  │ • Classifier     │  │ │
│                                 │  │ • Validator      │  │ │
│                                 │  │ • Pressure       │  │ │
│                                 │  │ • Verifier       │  │ │
│                                 │  └──────────────────┘  │ │
│                                 └────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
                         [Your Users]
```

---

**Version:** 1.0.0
**Last Updated:** October 12, 2025
**Maintainer:** Tractatus Framework Team

**Ready to deploy? Run:** `docker compose up -d`
