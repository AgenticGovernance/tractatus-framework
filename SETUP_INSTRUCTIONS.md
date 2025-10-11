# Tractatus Infrastructure Setup - Terminal Commands

**Run these commands in a separate terminal window**
**Current directory:** `/home/theflow/projects/tractatus`

---

## Step 1: Install Node.js Dependencies

```bash
cd /home/theflow/projects/tractatus
npm install
```

**Expected output:** Installation of ~20 packages (express, mongodb, jwt, etc.)
**Time:** ~30-60 seconds

---

## Step 2: Create Environment Configuration

```bash
cp .env.example .env
```

**Optional:** Edit .env if you need custom settings (defaults are fine for development)

```bash
nano .env  # or use your preferred editor
```

The defaults are:
- `PORT=9000`
- `MONGODB_URI=mongodb://localhost:27017/tractatus_dev`
- `NODE_ENV=development`

**Press Ctrl+X to exit nano if you opened it**

---

## Step 3: Install MongoDB Systemd Service

```bash
cd /home/theflow/projects/tractatus/scripts
sudo ./install-mongodb-service.sh
```

**Expected output:**
```
Installing MongoDB Tractatus systemd service...
Copying service file to /etc/systemd/system...
Reloading systemd daemon...
Enabling service to start on boot...
MongoDB Tractatus service installed successfully!
```

**You will be prompted for your sudo password**

---

## Step 4: Start MongoDB Service

```bash
sudo systemctl start mongodb-tractatus
```

**Verify it's running:**

```bash
sudo systemctl status mongodb-tractatus
```

**Expected output:** `Active: active (running)` in green

**Check the logs:**

```bash
tail -f /home/theflow/projects/tractatus/logs/mongodb.log
```

**You should see:** MongoDB startup messages
**Press Ctrl+C to exit tail**

---

## Step 5: Verify MongoDB Port

```bash
lsof -i :27017
```

**Expected output:**
```
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
mongod    xxxxx   theflow   xx   IPv4 xxxxxx      0t0  TCP localhost:27017 (LISTEN)
```

**Verify it's on port 27017, NOT 27027 (family-history)**

---

## Step 6: Initialize Database

```bash
cd /home/theflow/projects/tractatus
npm run init:db
```

**Expected output:**
```
🚀 Starting Tractatus database initialization...
✅ Connected to MongoDB
📦 Processing collection: documents
   ✓ Created collection
   ✓ Created index: slug_1
   ...
✨ Database initialization complete!
```

**This creates 10 collections with indexes**

---

## Step 7: Verify Database Setup

```bash
mongosh mongodb://localhost:27017/tractatus_dev --eval "db.getCollectionNames()"
```

**Expected output:** Array of 10 collection names

**Alternative verification:**

```bash
mongosh mongodb://localhost:27017/tractatus_dev
```

Then in the MongoDB shell:
```javascript
show collections
db.documents.getIndexes()
exit
```

---

## Step 8: Check Application Readiness

```bash
cd /home/theflow/projects/tractatus
npm run dev
```

**Expected:** Server will fail because we haven't built `src/server.js` yet
**This is normal!** Claude Code is building it now.

**Press Ctrl+C to stop if it started**

---

## Troubleshooting

### MongoDB won't start?

**Check if port 27017 is already in use:**
```bash
lsof -i :27017
```

**If something else is using it, we'll use port 27029 instead:**
```bash
# Edit the service file
sudo nano /etc/systemd/system/mongodb-tractatus.service
# Change all instances of 27017 to 27029
# Save and exit

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart mongodb-tractatus
```

### Permission errors?

**Ensure MongoDB data directory is owned by your user:**
```bash
sudo chown -R theflow:theflow /home/theflow/projects/tractatus/data/mongodb
sudo chown -R theflow:theflow /home/theflow/projects/tractatus/logs
```

### npm install fails?

**Check Node.js version (must be 18+):**
```bash
node --version
```

**If < 18, update Node.js first**

---

## Infrastructure Status Checklist

After completing steps above, verify:

- [ ] `npm install` completed successfully
- [ ] `.env` file created
- [ ] MongoDB systemd service installed
- [ ] MongoDB service running on port 27017
- [ ] Database initialized (10 collections created)
- [ ] No port conflicts with family-history (27027)

---

## What Claude Code is Building Now

While you run these commands, Claude Code is:

1. ✅ Adapting governance documents (TRA-VAL-0001 from STR-VAL-0001)
2. ✅ Building database utilities and models
3. ✅ Creating Express server foundation
4. ✅ Implementing Tractatus governance services
5. ✅ Building core API routes
6. ⏳ Will continue with features...

---

## When Setup is Complete

**Run this to verify everything:**

```bash
cd /home/theflow/projects/tractatus
npm run dev
```

**Expected output:**
```
🚀 Tractatus server starting...
✅ Connected to MongoDB: tractatus_dev
✅ Server listening on port 9000
✨ Ready for development
```

**Open browser:** http://localhost:9000 (will show basic response)

---

## Service Management Commands

**Start MongoDB:**
```bash
sudo systemctl start mongodb-tractatus
```

**Stop MongoDB:**
```bash
sudo systemctl stop mongodb-tractatus
```

**Restart MongoDB:**
```bash
sudo systemctl restart mongodb-tractatus
```

**Check status:**
```bash
sudo systemctl status mongodb-tractatus
```

**View logs:**
```bash
sudo journalctl -u mongodb-tractatus -f
```

---

**Questions?** Check CLAUDE.md or ask during next session.
