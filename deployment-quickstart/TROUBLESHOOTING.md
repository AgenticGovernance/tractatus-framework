# Tractatus Deployment Troubleshooting Guide

This guide covers common issues when deploying the Tractatus Framework.

## Table of Contents

1. [Docker Issues](#docker-issues)
2. [Database Connection Problems](#database-connection-problems)
3. [Application Won't Start](#application-wont-start)
4. [Governance Services Not Working](#governance-services-not-working)
5. [Performance Issues](#performance-issues)
6. [Security & Access Issues](#security--access-issues)

---

## Docker Issues

### Container Won't Start

**Symptom:** `docker compose up` fails or container exits immediately

**Solutions:**

1. **Check Docker daemon is running:**
   ```bash
   docker info
   ```

2. **Check for port conflicts:**
   ```bash
   lsof -i :9000  # Check if port 9000 is in use
   lsof -i :27017 # Check if MongoDB port is in use
   ```

3. **View container logs:**
   ```bash
   docker compose logs tractatus-app
   docker compose logs mongodb
   ```

4. **Remove and rebuild:**
   ```bash
   docker compose down -v
   docker compose build --no-cache
   docker compose up
   ```

---

### Permission Denied Errors

**Symptom:** Container logs show "EACCES: permission denied"

**Solution:**

1. **Fix directory permissions:**
   ```bash
   chmod -R 755 deployment-quickstart/
   chown -R 1001:1001 logs uploads audit-reports
   ```

2. **Check Docker user mapping:**
   - Container runs as user ID 1001 (nodejs)
   - Ensure host directories are accessible

---

## Database Connection Problems

### Cannot Connect to MongoDB

**Symptom:** Application logs show "MongoServerError" or "ECONNREFUSED"

**Solutions:**

1. **Check MongoDB is running:**
   ```bash
   docker compose ps mongodb
   docker compose logs mongodb
   ```

2. **Verify MongoDB health:**
   ```bash
   docker exec tractatus-mongodb mongosh --eval "db.runCommand({ ping: 1 })"
   ```

3. **Check connection string in .env:**
   ```bash
   # Ensure MONGODB_URI format is correct:
   mongodb://tractatus:YOUR_PASSWORD@mongodb:27017/tractatus_prod?authSource=admin
   ```

4. **Reset MongoDB:**
   ```bash
   docker compose down
   docker volume rm tractatus_mongodb_data
   docker compose up -d mongodb
   # Wait 30 seconds for initialization
   docker compose up tractatus-app
   ```

---

### Authentication Failed

**Symptom:** "Authentication failed" in logs

**Solution:**

1. **Check credentials in .env:**
   ```bash
   grep MONGODB_ .env
   ```

2. **Ensure username/password match in docker-compose.yml and .env**

3. **Reset MongoDB authentication:**
   ```bash
   docker compose down
   docker volume rm tractatus_mongodb_data tractatus_mongodb_config
   docker compose up -d
   ```

---

## Application Won't Start

### Port Already in Use

**Symptom:** "Error: listen EADDRINUSE: address already in use :::9000"

**Solution:**

1. **Find process using port 9000:**
   ```bash
   lsof -i :9000
   kill -9 <PID>
   ```

2. **Or change port in .env:**
   ```bash
   APP_PORT=9001
   ```

   Update docker-compose.yml ports section:
   ```yaml
   ports:
     - "9001:9000"
   ```

---

### Missing Environment Variables

**Symptom:** Application starts but features don't work

**Solution:**

1. **Verify all required .env variables are set:**
   ```bash
   ./verify-deployment.sh
   ```

2. **Check for default/placeholder values:**
   ```bash
   grep "CHANGE THIS" .env
   grep "YOUR_" .env
   ```

3. **Generate secure secrets:**
   ```bash
   # JWT Secret
   openssl rand -base64 32

   # Session Secret
   openssl rand -base64 32
   ```

---

## Governance Services Not Working

### BoundaryEnforcer Not Blocking

**Symptom:** Values decisions not being blocked

**Solutions:**

1. **Check service is enabled in .env:**
   ```bash
   grep BOUNDARY_ENFORCER_ENABLED .env
   # Should be: BOUNDARY_ENFORCER_ENABLED=true
   ```

2. **Test endpoint directly:**
   ```bash
   curl -X POST http://localhost:9000/api/demo/boundary-check \
     -H "Content-Type: application/json" \
     -d '{"scenario":"privacy-decision"}'
   ```

3. **Check application logs:**
   ```bash
   docker compose logs tractatus-app | grep BoundaryEnforcer
   ```

---

### Classification Not Working

**Symptom:** Instructions not being classified

**Solutions:**

1. **Check InstructionPersistenceClassifier is enabled:**
   ```bash
   grep PERSISTENCE_CLASSIFIER_ENABLED .env
   ```

2. **Verify instruction history file exists:**
   ```bash
   docker exec tractatus-app ls -la .claude/instruction-history.json
   ```

3. **Test classification endpoint:**
   ```bash
   curl -X POST http://localhost:9000/api/demo/classify \
     -H "Content-Type: application/json" \
     -d '{"instruction":"Use MongoDB port 27027"}'
   ```

---

### Context Pressure Not Monitoring

**Symptom:** No pressure warnings even under load

**Solutions:**

1. **Verify ContextPressureMonitor is enabled:**
   ```bash
   grep CONTEXT_PRESSURE_ENABLED .env
   ```

2. **Check token tracking:**
   ```bash
   docker compose logs tractatus-app | grep "Context Pressure"
   ```

3. **Test pressure check:**
   ```bash
   curl -X POST http://localhost:9000/api/demo/pressure-check \
     -H "Content-Type: application/json" \
     -d '{"tokens":150000,"messages":50,"errors":5}'
   ```

---

## Performance Issues

### Slow Response Times

**Symptom:** API requests taking >2 seconds

**Solutions:**

1. **Check MongoDB indexes:**
   ```bash
   docker exec tractatus-mongodb mongosh tractatus_prod --eval "db.getCollectionNames().forEach(function(col) { print(col); db[col].getIndexes(); })"
   ```

2. **Monitor container resources:**
   ```bash
   docker stats tractatus-app tractatus-mongodb
   ```

3. **Increase container memory limits in docker-compose.yml:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
       reservations:
         memory: 1G
   ```

4. **Check for query bottlenecks:**
   ```bash
   docker compose logs tractatus-app | grep "slow query"
   ```

---

### High Memory Usage

**Symptom:** Container using excessive memory

**Solutions:**

1. **Check for memory leaks:**
   ```bash
   docker stats --no-stream tractatus-app
   ```

2. **Restart container periodically:**
   ```bash
   docker compose restart tractatus-app
   ```

3. **Reduce rate limit max requests in .env:**
   ```bash
   RATE_LIMIT_MAX_REQUESTS=50
   ```

---

## Security & Access Issues

### CORS Errors

**Symptom:** Browser console shows "blocked by CORS policy"

**Solution:**

1. **Update CORS_ORIGIN in .env:**
   ```bash
   CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
   ```

2. **For development, allow localhost:**
   ```bash
   CORS_ORIGIN=http://localhost:9000,http://127.0.0.1:9000
   ```

---

### CSP Violations

**Symptom:** Browser console shows "Content Security Policy" errors

**Solution:**

1. **Check CSP configuration:**
   ```bash
   curl -I http://localhost:9000 | grep Content-Security-Policy
   ```

2. **Temporarily disable CSP for debugging:**
   ```bash
   CSP_ENABLED=false
   ```

3. **Fix inline styles/scripts in HTML files** (don't disable CSP in production!)

---

### Admin Login Not Working

**Symptom:** Cannot log in to /admin

**Solutions:**

1. **Verify admin account exists:**
   ```bash
   docker exec tractatus-mongodb mongosh tractatus_prod --eval "db.users.findOne({role:'admin'})"
   ```

2. **Reset admin password:**
   ```bash
   docker compose run --rm tractatus-app node scripts/seed-admin.js
   ```

3. **Check JWT_SECRET is set:**
   ```bash
   grep JWT_SECRET .env
   ```

---

## Still Having Issues?

### Collect Diagnostic Information

```bash
# Create diagnostic report
cat > diagnostic-report.txt <<EOF
=== System Info ===
$(uname -a)

=== Docker Version ===
$(docker --version)
$(docker compose version)

=== Container Status ===
$(docker compose ps)

=== Application Logs (last 100 lines) ===
$(docker compose logs --tail=100 tractatus-app)

=== MongoDB Logs (last 50 lines) ===
$(docker compose logs --tail=50 mongodb)

=== Environment Check ===
$(./verify-deployment.sh)
EOF

echo "Diagnostic report saved to diagnostic-report.txt"
```

### Get Help

1. **Check documentation:** https://agenticgovernance.digital/docs
2. **Review case studies:** https://agenticgovernance.digital/docs/case-studies
3. **Submit issue:** https://github.com/AgenticGovernance/tractatus-framework/issues
4. **Email:** research@agenticgovernance.digital

---

## Quick Reference Commands

```bash
# Start deployment
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f tractatus-app

# Run verification
./verify-deployment.sh

# Restart services
docker compose restart

# Stop all services
docker compose down

# Full reset (⚠️ destroys data)
docker compose down -v
docker compose up -d
```

---

**Last Updated:** October 12, 2025
**Version:** 1.0.0
