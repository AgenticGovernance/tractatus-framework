# Tractatus Framework - Deployment Guide

> **Note**: This guide provides conceptual deployment architecture for research and educational purposes. For production implementation inquiries, contact john.stroh.nz@pm.me

---

## Architecture Overview

The Tractatus Framework is designed as a modular system with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         Frontend Layer                   │
│  (Static HTML/JS/CSS + Demos)           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         API Gateway                      │
│  (Express.js REST API)                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    Framework Services Layer             │
│  ┌────────────────────────────────┐    │
│  │ InstructionPersistenceClassifier│    │
│  │ CrossReferenceValidator         │    │
│  │ BoundaryEnforcer                │    │
│  │ ContextPressureMonitor          │    │
│  │ MetacognitiveVerifier           │    │
│  └────────────────────────────────┘    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Persistence Layer                  │
│  (MongoDB - Instruction History)        │
└──────────────────────────────────────────┘
```

---

## Core Components

### 1. Frontend Layer
- Static file serving (HTML, CSS, JavaScript)
- Interactive demos (27027 incident, boundary enforcement, etc.)
- Documentation viewer
- No server-side rendering required

### 2. API Gateway
- RESTful API endpoints
- JWT authentication for admin functions
- Rate limiting and request validation
- Content Security Policy enforcement

### 3. Framework Services
Five core services that implement architectural AI safety:

**InstructionPersistenceClassifier**
- Classifies instructions by quadrant (STRATEGIC/OPERATIONAL/TACTICAL/SYSTEM)
- Assigns persistence levels (HIGH/MEDIUM/LOW)
- Determines temporal scope (SESSION/PROJECT/PERMANENT)

**CrossReferenceValidator**
- Validates proposed actions against stored instructions
- Detects training pattern overrides (27027 failure mode)
- Enforces explicit instruction compliance

**BoundaryEnforcer**
- Identifies values decisions requiring human judgment
- Blocks AI-only decisions on privacy, ethics, strategic direction
- Maintains separation of technical vs. values domains

**ContextPressureMonitor**
- Tracks session health across multiple factors
- Monitors token usage, message count, error rates
- Triggers session handoffs before quality degradation

**MetacognitiveVerifier**
- AI self-checks for complex operations
- Detects scope creep and misalignment
- Provides confidence scoring for proposed actions

### 4. Persistence Layer
- MongoDB for instruction history
- Document-based storage for flexibility
- Indexes optimized for classification queries

---

## Deployment Patterns

### Pattern 1: Development Environment

**Recommended for**: Research, testing, local development

**Requirements**:
- Node.js 18+
- MongoDB 7.x
- 2GB RAM minimum

**Architecture**:
```
localhost:9000 → Express API
localhost:27017 → MongoDB
```

**Security**: Minimal (localhost only, development JWT secrets)

---

### Pattern 2: Single-Server Production

**Recommended for**: Small-scale deployments, proof of concept

**Requirements**:
- VPS or cloud instance (2-4GB RAM)
- Ubuntu 22.04 LTS or similar
- Nginx for reverse proxy
- SSL/TLS certificates

**Architecture**:
```
Internet → Nginx (443) → Express (9000)
                       → MongoDB (27017, localhost only)
```

**Security**:
- UFW firewall (allow 22, 80, 443 only)
- Nginx rate limiting
- MongoDB authentication enabled
- JWT secrets from environment variables
- Regular security updates

---

### Pattern 3: Containerized Deployment

**Recommended for**: Scalable deployments, cloud platforms

**Conceptual docker-compose structure**:
```yaml
services:
  app:
    # Express application
    ports: ["9000:9000"]
    environment:
      - MONGODB_URI=mongodb://db:27017/tractatus
      - NODE_ENV=production
    depends_on: [db]

  db:
    # MongoDB instance
    # Internal network only, not exposed to internet

  nginx:
    # Reverse proxy
    ports: ["80:80", "443:443"]
    depends_on: [app]
```

**Security**:
- Internal Docker network (db not externally accessible)
- Environment-based configuration (no secrets in images)
- Read-only root filesystem where possible
- Non-root user execution

---

## Configuration Considerations

### Environment Variables

Essential configuration (generic examples):

```bash
# Application
PORT=9000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/tractatus_prod

# Security
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>

# Optional: AI Integration
CLAUDE_API_KEY=<anthropic-api-key>
ENABLE_AI_CURATION=false
```

### MongoDB Indexes

Critical indexes for performance:

```javascript
// Instructions collection
db.instructions.createIndex({ "quadrant": 1, "persistence": 1 })
db.instructions.createIndex({ "active": 1, "timestamp": -1 })
db.instructions.createIndex({ "temporal_scope": 1 })

// Validation logs
db.validation_logs.createIndex({ "timestamp": -1 })
db.validation_logs.createIndex({ "status": 1, "timestamp": -1 })
```

### Framework Initialization

Required setup on first deployment:

1. **Initialize database collections** (10 collections with indexes)
2. **Create admin user** (for dashboard access)
3. **Load base governance rules** (minimum 6 strategic instructions)
4. **Configure service parameters** (pressure thresholds, validation rules)

---

## Security Best Practices

### 1. Network Security
- **Firewall**: Only expose HTTP/HTTPS ports to internet
- **MongoDB**: Bind to localhost only, never expose directly
- **Nginx**: Configure rate limiting and DDoS protection
- **SSL/TLS**: Use Let's Encrypt or similar, enforce HTTPS

### 2. Application Security
- **CSP**: Content Security Policy with `script-src 'self'` (no inline scripts)
- **JWT**: Strong secrets, reasonable expiration times
- **Rate Limiting**: 100 requests per 15 minutes per IP (adjust as needed)
- **Input Validation**: All API endpoints validate input schemas

### 3. Framework Security
- **Instruction History**: Protect `.claude/instruction-history.json` from public access
- **Admin Endpoints**: Require authentication, separate from public API
- **Session State**: Clear sensitive data on logout/timeout

### 4. Operational Security
- **Updates**: Regular security patches for OS, Node.js, MongoDB
- **Backups**: Daily MongoDB dumps, 7-day retention minimum
- **Monitoring**: Track error rates, API response times, authentication failures
- **Logging**: Structured logs with rotation, avoid logging secrets

---

## Testing & Validation

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] MongoDB authentication enabled
- [ ] Firewall rules applied
- [ ] SSL/TLS certificates valid
- [ ] Framework services pass health checks
- [ ] Admin dashboard accessible
- [ ] Public API endpoints functional
- [ ] CSP policy enforced (no console errors)

### Health Check Endpoints

```bash
# Basic health check
curl https://your-domain.com/health
# Expected: {"status":"ok","timestamp":"..."}

# Framework status (requires authentication)
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/governance/status
# Expected: Component status, instruction counts, pressure metrics
```

### Load Testing Recommendations

- **Baseline**: 100 concurrent users, 1000 requests/minute
- **Target**: <500ms p95 response time
- **Monitoring**: Error rate <0.1%, uptime 99.9%+

---

## Scaling Considerations

### Vertical Scaling (Single Server)
- **2GB RAM**: Development/testing (10-50 users)
- **4GB RAM**: Small production (50-200 users)
- **8GB RAM**: Medium production (200-500 users)

### Horizontal Scaling (Multiple Servers)
- **Load Balancer**: Nginx or cloud load balancer
- **Stateless API**: JWT-based auth enables horizontal scaling
- **MongoDB Replica Set**: High availability for database layer
- **CDN**: Static assets (docs, images) via CDN

---

## Monitoring & Observability

### Key Metrics to Track

**Application Metrics**:
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx percentages)
- Active sessions

**Framework Metrics**:
- Instructions created/modified count
- Validation rejections per hour
- Boundary enforcer blocks per day
- Context pressure escalations

**Infrastructure Metrics**:
- CPU usage
- Memory usage
- Disk I/O
- MongoDB query performance

### Alerting Thresholds (Examples)

- **Critical**: API error rate >1%, downtime detected
- **Warning**: Response time p95 >2s, memory >85%
- **Info**: New instruction created, admin login

---

## Troubleshooting Common Issues

### Issue: High Context Pressure Warnings

**Symptom**: ContextPressureMonitor reporting ELEVATED or CRITICAL

**Causes**:
- Long-running sessions exceeding token budget
- Multiple concurrent complex operations
- High error rates indicating quality degradation

**Solutions**:
- Implement session handoff protocol
- Review token usage patterns
- Investigate error sources

---

### Issue: Validation Rejections

**Symptom**: CrossReferenceValidator blocking valid actions

**Causes**:
- Conflicting instructions in history
- Overly broad instruction patterns
- Training pattern overrides not properly detected

**Solutions**:
- Review instruction history for conflicts
- Refine instruction specificity
- Update validator rules if needed

---

### Issue: Boundary Enforcer False Positives

**Symptom**: BoundaryEnforcer blocking technical decisions

**Causes**:
- Keywords triggering values classification incorrectly
- Ambiguous decision framing

**Solutions**:
- Rephrase decisions to clarify technical vs. values
- Update boundary detection rules
- Review false positive patterns

---

## Further Resources

- **Live Demo**: [agenticgovernance.digital](https://agenticgovernance.digital)
- **Documentation**: [docs/](../docs/)
- **Case Studies**: [docs/case-studies/](../docs/case-studies/)
- **Research Papers**: [docs/research/](../docs/research/)
- **API Reference**: [docs/api/](../docs/api/)

---

## Implementation Support

This guide provides conceptual architecture and deployment patterns for research purposes. For:
- **Production implementation** assistance
- **Custom deployment** configurations
- **Integration** support
- **Enterprise licensing**

Contact: john.stroh.nz@pm.me

---

**Last Updated**: October 2025
**Status**: Conceptual guide for research and educational purposes
**License**: Apache 2.0 (see [LICENSE](../LICENSE))
