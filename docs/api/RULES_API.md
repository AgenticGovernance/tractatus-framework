# Rules Management API

**Version:** 1.0.0
**Base URL:** `http://localhost:9000/api/admin/rules`
**Authentication:** Bearer Token (JWT) required for all endpoints

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [List Rules](#list-rules)
  - [Get Rule Statistics](#get-rule-statistics)
  - [Get Single Rule](#get-single-rule)
  - [Create Rule](#create-rule)
  - [Update Rule](#update-rule)
  - [Delete Rule](#delete-rule)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```http
Authorization: Bearer <your-jwt-token>
```

To obtain a token, use the login endpoint:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@tractatus.local",
  "password": "your_password"
}
```

---

## Endpoints

### List Rules

Retrieve a paginated list of governance rules with optional filtering and sorting.

**Endpoint:** `GET /api/admin/rules`

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `scope` | string | No | Filter by scope | `UNIVERSAL`, `PROJECT_SPECIFIC` |
| `quadrant` | string | No | Filter by quadrant | `STRATEGIC`, `OPERATIONAL`, `TACTICAL`, `SYSTEM`, `STORAGE` |
| `persistence` | string | No | Filter by persistence | `HIGH`, `MEDIUM`, `LOW` |
| `category` | string | No | Filter by category | `content`, `security`, `privacy`, `technical`, `process`, `values`, `other` |
| `active` | boolean | No | Filter by active status | `true`, `false` |
| `validationStatus` | string | No | Filter by validation status | `PASSED`, `FAILED`, `NEEDS_REVIEW`, `NOT_VALIDATED` |
| `projectId` | string | No | Filter by applicable project | `tractatus`, `family-history` |
| `search` | string | No | Full-text search in rule text | `MongoDB port` |
| `sort` | string | No | Sort field (default: `priority`) | `priority`, `clarity`, `id`, `updatedAt` |
| `order` | string | No | Sort order (default: `desc`) | `asc`, `desc` |
| `page` | number | No | Page number (default: `1`) | `1`, `2`, `3` |
| `limit` | number | No | Items per page (default: `20`) | `10`, `20`, `50` |

**Response:**

```json
{
  "success": true,
  "rules": [
    {
      "_id": "68e8c3a6499d095048311f03",
      "id": "inst_001",
      "text": "MongoDB runs on port 27017 for tractatus_dev database",
      "scope": "PROJECT_SPECIFIC",
      "quadrant": "SYSTEM",
      "persistence": "HIGH",
      "category": "other",
      "priority": 50,
      "temporalScope": "PROJECT",
      "active": true,
      "variables": [],
      "clarityScore": 90,
      "validationStatus": "NOT_VALIDATED",
      "usageStats": {
        "referencedInProjects": [],
        "timesEnforced": 0,
        "conflictsDetected": 0
      },
      "createdAt": "2025-10-10T08:28:22.921Z",
      "updatedAt": "2025-10-10T13:05:36.924Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 18,
    "pages": 1
  }
}
```

**Example Request:**

```bash
curl -X GET "http://localhost:9000/api/admin/rules?quadrant=SYSTEM&active=true&sort=priority&order=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Get Rule Statistics

Get dashboard statistics including counts by scope, quadrant, persistence, validation status, and average quality scores.

**Endpoint:** `GET /api/admin/rules/stats`

**Response:**

```json
{
  "success": true,
  "stats": {
    "total": 18,
    "byScope": {
      "UNIVERSAL": 0,
      "PROJECT_SPECIFIC": 18
    },
    "byQuadrant": [
      { "quadrant": "SYSTEM", "count": 7 },
      { "quadrant": "STRATEGIC", "count": 6 },
      { "quadrant": "OPERATIONAL", "count": 4 },
      { "quadrant": "TACTICAL": "count": 1 }
    ],
    "byPersistence": [
      { "persistence": "HIGH", "count": 17 },
      { "persistence": "MEDIUM", "count": 1 }
    ],
    "byValidationStatus": {
      "NOT_VALIDATED": 18,
      "PASSED": 0,
      "FAILED": 0,
      "NEEDS_REVIEW": 0
    },
    "averageScores": {
      "clarity": 85.5,
      "specificity": null,
      "actionability": null
    },
    "totalChecks": 0,
    "totalViolations": 0
  }
}
```

**Example Request:**

```bash
curl -X GET "http://localhost:9000/api/admin/rules/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Get Single Rule

Retrieve a single rule with full details including validation results, usage statistics, and optimization history.

**Endpoint:** `GET /api/admin/rules/:id`

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Rule ID (inst_xxx) or MongoDB ObjectId |

**Response:**

```json
{
  "success": true,
  "rule": {
    "_id": "68e8c3a6499d095048311f03",
    "id": "inst_001",
    "text": "MongoDB runs on port 27017 for tractatus_dev database",
    "scope": "PROJECT_SPECIFIC",
    "applicableProjects": ["*"],
    "variables": [],
    "quadrant": "SYSTEM",
    "persistence": "HIGH",
    "category": "other",
    "priority": 50,
    "temporalScope": "PROJECT",
    "expiresAt": null,
    "active": true,
    "clarityScore": 90,
    "specificityScore": null,
    "actionabilityScore": null,
    "lastOptimized": null,
    "optimizationHistory": [],
    "validationStatus": "NOT_VALIDATED",
    "lastValidated": null,
    "validationResults": null,
    "usageStats": {
      "referencedInProjects": [],
      "timesEnforced": 0,
      "conflictsDetected": 0,
      "lastEnforced": null
    },
    "source": "migration",
    "createdBy": "migration",
    "examples": [],
    "relatedRules": [],
    "notes": "Infrastructure decision from project initialization",
    "createdAt": "2025-10-10T08:28:22.921Z",
    "updatedAt": "2025-10-10T13:05:36.924Z"
  }
}
```

**Example Request:**

```bash
# By rule ID
curl -X GET "http://localhost:9000/api/admin/rules/inst_001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# By MongoDB ObjectId
curl -X GET "http://localhost:9000/api/admin/rules/68e8c3a6499d095048311f03" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Create Rule

Create a new governance rule with automatic variable detection and clarity scoring.

**Endpoint:** `POST /api/admin/rules`

**Request Body:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique rule ID | `inst_019` |
| `text` | string | Yes | Rule text (may contain ${VARIABLE} placeholders) | `Database MUST use ${DB_TYPE}` |
| `scope` | string | No | Default: `PROJECT_SPECIFIC` | `UNIVERSAL`, `PROJECT_SPECIFIC` |
| `applicableProjects` | string[] | No | Default: `['*']` | `['tractatus']`, `['*']` |
| `quadrant` | string | Yes | Tractatus quadrant | `STRATEGIC`, `OPERATIONAL`, `TACTICAL`, `SYSTEM`, `STORAGE` |
| `persistence` | string | Yes | Persistence level | `HIGH`, `MEDIUM`, `LOW` |
| `category` | string | No | Default: `other` | `content`, `security`, `privacy`, `technical`, `process`, `values`, `other` |
| `priority` | number | No | Default: `50` | `0-100` |
| `temporalScope` | string | No | Default: `PERMANENT` | `IMMEDIATE`, `SESSION`, `PROJECT`, `PERMANENT` |
| `active` | boolean | No | Default: `true` | `true`, `false` |
| `examples` | string[] | No | Example scenarios | `["When deploying...", "During development..."]` |
| `relatedRules` | string[] | No | IDs of related rules | `["inst_001", "inst_002"]` |
| `notes` | string | No | Additional notes | `"Critical for database connectivity"` |

**Automatic Processing:**

- Variables are automatically detected from `${VAR_NAME}` patterns
- Clarity score is calculated using heuristics:
  - Deducts points for weak language (try, maybe, consider, might, etc.)
  - Deducts points for missing strong imperatives (MUST, SHALL, REQUIRED, etc.)
  - Bonus for specificity (numbers, variables)
- Validation status is set to `NOT_VALIDATED`

**Response:**

```json
{
  "success": true,
  "rule": {
    "_id": "68e9abcd123456789",
    "id": "inst_019",
    "text": "Database MUST use ${DB_TYPE} on port ${DB_PORT}",
    "scope": "UNIVERSAL",
    "variables": ["DB_TYPE", "DB_PORT"],
    "quadrant": "SYSTEM",
    "persistence": "HIGH",
    "clarityScore": 92,
    "validationStatus": "NOT_VALIDATED",
    "...": "..."
  },
  "message": "Rule created successfully"
}
```

**Example Request:**

```bash
curl -X POST "http://localhost:9000/api/admin/rules" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "inst_019",
    "text": "Database MUST use ${DB_TYPE} on port ${DB_PORT}",
    "scope": "UNIVERSAL",
    "quadrant": "SYSTEM",
    "persistence": "HIGH",
    "priority": 90,
    "category": "technical",
    "notes": "Core database configuration rule"
  }'
```

---

### Update Rule

Update an existing rule with automatic variable re-detection, clarity re-scoring, and optimization history tracking.

**Endpoint:** `PUT /api/admin/rules/:id`

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Rule ID (inst_xxx) or MongoDB ObjectId |

**Request Body:**

Partial update is supported. Only include fields you want to update. See [Create Rule](#create-rule) for field descriptions.

**Automatic Processing:**

- If `text` changes:
  - Variables are re-detected
  - Clarity score is recalculated
  - Entry is added to `optimizationHistory`
  - Validation status is reset to `NOT_VALIDATED`

**Response:**

```json
{
  "success": true,
  "rule": {
    "_id": "68e8c3a6499d095048311f03",
    "id": "inst_001",
    "text": "MongoDB MUST run on port 27017 for ${PROJECT_NAME} database",
    "variables": ["PROJECT_NAME"],
    "clarityScore": 95,
    "optimizationHistory": [
      {
        "timestamp": "2025-10-11T10:30:00.000Z",
        "before": "MongoDB runs on port 27017 for tractatus_dev database",
        "after": "MongoDB MUST run on port 27017 for ${PROJECT_NAME} database",
        "reason": "Manual edit by user",
        "scores": {
          "clarity": 95,
          "specificity": null,
          "actionability": null
        }
      }
    ],
    "...": "..."
  },
  "message": "Rule updated successfully"
}
```

**Example Request:**

```bash
curl -X PUT "http://localhost:9000/api/admin/rules/inst_001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "MongoDB MUST run on port 27017 for ${PROJECT_NAME} database",
    "priority": 95
  }'
```

---

### Delete Rule

Soft delete (deactivate) or permanently delete a rule.

**Endpoint:** `DELETE /api/admin/rules/:id`

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Rule ID (inst_xxx) or MongoDB ObjectId |

**Query Parameters:**

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `permanent` | boolean | No | If `true`, hard delete; otherwise soft delete | `false` |

**Behavior:**

- **Soft Delete (default):** Sets `active=false`, preserves all data
- **Hard Delete (`permanent=true`):** Permanently removes rule from database
- **Protection:** Prevents deletion of UNIVERSAL rules that are in use by projects

**Response (Soft Delete):**

```json
{
  "success": true,
  "rule": {
    "_id": "68e8c3a6499d095048311f03",
    "id": "inst_001",
    "active": false,
    "...": "..."
  },
  "message": "Rule deactivated successfully"
}
```

**Response (Hard Delete):**

```json
{
  "success": true,
  "message": "Rule permanently deleted"
}
```

**Error Response (Rule In Use):**

```json
{
  "error": "Conflict",
  "message": "Rule is used by 3 projects. Cannot delete.",
  "projects": ["tractatus", "family-history", "sydigital"]
}
```

**Example Requests:**

```bash
# Soft delete (recommended)
curl -X DELETE "http://localhost:9000/api/admin/rules/inst_001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Permanent delete (use with caution!)
curl -X DELETE "http://localhost:9000/api/admin/rules/inst_001?permanent=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Data Models

### GovernanceRule Model

```typescript
{
  _id: ObjectId,              // MongoDB ObjectId
  id: string,                 // Unique rule ID (inst_xxx)
  text: string,               // Rule text

  // Multi-project governance
  scope: 'UNIVERSAL' | 'PROJECT_SPECIFIC',
  applicableProjects: string[],  // Project IDs or ['*'] for all
  variables: string[],           // Detected variables (e.g., ["DB_TYPE", "DB_PORT"])

  // Classification
  quadrant: 'STRATEGIC' | 'OPERATIONAL' | 'TACTICAL' | 'SYSTEM' | 'STORAGE',
  persistence: 'HIGH' | 'MEDIUM' | 'LOW',
  category: 'content' | 'security' | 'privacy' | 'technical' | 'process' | 'values' | 'other',
  priority: number,           // 0-100
  temporalScope: 'IMMEDIATE' | 'SESSION' | 'PROJECT' | 'PERMANENT',
  expiresAt: Date | null,

  // AI Optimization Scores
  clarityScore: number | null,       // 0-100
  specificityScore: number | null,   // 0-100
  actionabilityScore: number | null, // 0-100
  lastOptimized: Date | null,
  optimizationHistory: [{
    timestamp: Date,
    before: string,
    after: string,
    reason: string,
    scores: {
      clarity: number,
      specificity: number,
      actionability: number
    }
  }],

  // Validation Results
  validationStatus: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' | 'NOT_VALIDATED',
  lastValidated: Date | null,
  validationResults: {
    classification: {
      passed: boolean,
      expected: object,
      actual: object
    },
    parameterExtraction: {
      passed: boolean,
      params: object
    },
    conflictDetection: {
      passed: boolean,
      conflicts: string[]
    },
    boundaryCheck: {
      passed: boolean,
      allowed: boolean
    },
    overallScore: number
  } | null,

  // Usage Statistics
  usageStats: {
    referencedInProjects: string[],
    timesEnforced: number,
    conflictsDetected: number,
    lastEnforced: Date | null
  },

  // Status
  active: boolean,
  source: 'user_instruction' | 'framework_default' | 'automated' | 'migration' | 'test',
  createdBy: string,

  // Additional context
  examples: string[],
  relatedRules: string[],
  notes: string,

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or failed
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists or cannot be deleted
- `500 Internal Server Error` - Server-side error

**Common Errors:**

```json
// Missing authentication
{
  "error": "Authentication required",
  "message": "No token provided"
}

// Invalid token
{
  "error": "Authentication failed",
  "message": "Invalid token: invalid signature"
}

// Missing required fields
{
  "error": "Bad Request",
  "message": "Missing required fields: id, text, quadrant, persistence"
}

// Duplicate rule ID
{
  "error": "Conflict",
  "message": "Rule with ID inst_019 already exists"
}

// Rule not found
{
  "error": "Not Found",
  "message": "Rule not found"
}
```

---

## Examples

### Complete Workflow: Create, Edit, View, Delete

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tractatus.local","password":"your_password"}' \
  | jq -r '.token')

# 2. Create a new rule
curl -X POST "http://localhost:9000/api/admin/rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "inst_025",
    "text": "All API endpoints MUST require authentication via JWT tokens",
    "scope": "UNIVERSAL",
    "quadrant": "SYSTEM",
    "persistence": "HIGH",
    "priority": 95,
    "category": "security",
    "notes": "Critical security requirement"
  }'

# 3. View the rule
curl -X GET "http://localhost:9000/api/admin/rules/inst_025" \
  -H "Authorization: Bearer $TOKEN"

# 4. Update the rule
curl -X PUT "http://localhost:9000/api/admin/rules/inst_025" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "All API endpoints MUST require authentication via JWT tokens with ${TOKEN_EXPIRY} expiration",
    "priority": 98
  }'

# 5. List all SYSTEM rules
curl -X GET "http://localhost:9000/api/admin/rules?quadrant=SYSTEM&active=true" \
  -H "Authorization: Bearer $TOKEN"

# 6. Get statistics
curl -X GET "http://localhost:9000/api/admin/rules/stats" \
  -H "Authorization: Bearer $TOKEN"

# 7. Soft delete the rule
curl -X DELETE "http://localhost:9000/api/admin/rules/inst_025" \
  -H "Authorization: Bearer $TOKEN"
```

### Search and Filter Examples

```bash
# Find all universal rules with high persistence
curl -X GET "http://localhost:9000/api/admin/rules?scope=UNIVERSAL&persistence=HIGH" \
  -H "Authorization: Bearer $TOKEN"

# Search for rules containing "database"
curl -X GET "http://localhost:9000/api/admin/rules?search=database" \
  -H "Authorization: Bearer $TOKEN"

# Get top priority strategic rules
curl -X GET "http://localhost:9000/api/admin/rules?quadrant=STRATEGIC&sort=priority&order=desc&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get rules needing validation
curl -X GET "http://localhost:9000/api/admin/rules?validationStatus=NOT_VALIDATED" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Window:** 15 minutes
- **Max Requests:** 100 per IP address

If you exceed the rate limit, you'll receive:

```json
{
  "error": "Too Many Requests",
  "message": "Too many requests from this IP, please try again later"
}
```

---

## Support

For API issues or questions:
- **GitHub Issues:** https://github.com/yourorg/tractatus/issues
- **Documentation:** See `docs/USER_GUIDE_RULE_MANAGER.md`
- **API Version:** Check `package.json` for current version

---

**Last Updated:** 2025-10-11
**API Version:** 1.0.0
