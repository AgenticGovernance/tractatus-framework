# Multi-stage build for production deployment
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs ../src ./src
COPY --chown=nodejs:nodejs ../public ./public
COPY --chown=nodejs:nodejs ../scripts ./scripts
COPY --chown=nodejs:nodejs ../docs ./docs
COPY --chown=nodejs:nodejs ../package*.json ./
COPY --chown=nodejs:nodejs ../.claude ./.claude

# Create necessary directories
RUN mkdir -p logs uploads audit-reports && \
    chown -R nodejs:nodejs logs uploads audit-reports

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9000/api/health || exit 1

# Start application
CMD ["node", "src/server.js"]
