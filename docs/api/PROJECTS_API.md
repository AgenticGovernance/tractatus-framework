# Projects & Variables API Documentation

**Version:** 1.0
**Base URL:** `/api/admin`
**Authentication:** Required (Bearer token)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Projects API](#projects-api)
4. [Variables API](#variables-api)
5. [Variable Substitution](#variable-substitution)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

---

## Overview

The Projects & Variables API provides multi-project governance capabilities, allowing administrators to:

- Manage multiple projects with project-specific configurations
- Define and manage variable values per project
- Substitute variables in governance rules with project-specific values
- Support context-aware rule rendering

**Key Concepts:**

- **Project**: A codebase or application with its own configuration (e.g., `tractatus`, `family-history`)
- **Variable**: A placeholder in governance rules (e.g., `${DB_NAME}`, `${API_PORT}`)
- **Variable Value**: The actual value of a variable for a specific project
- **Variable Substitution**: Replacing `${VAR_NAME}` in rule text with actual values

---

## Authentication

All endpoints require admin authentication.

**Headers:**
```http
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

---

## Projects API

### GET /api/admin/projects

Get all projects with optional filtering.

**Query Parameters:**
- `active` (string, optional): Filter by active status (`"true"`, `"false"`, or omit for all)
- `database` (string, optional): Filter by database type (e.g., `"MongoDB"`, `"PostgreSQL"`)

**Response (200):**
```json
{
  "success": true,
  "projects": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "id": "tractatus",
      "name": "Tractatus AI Safety Framework",
      "description": "The Tractatus website...",
      "techStack": {
        "framework": "Express.js",
        "database": "MongoDB",
        "frontend": "Vanilla JavaScript"
      },
      "repositoryUrl": "https://github.com/example/tractatus",
      "metadata": {
        "environment": "production"
      },
      "active": true,
      "variableCount": 7,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### GET /api/admin/projects/:id

Get a single project by ID.

**URL Parameters:**
- `id` (string, required): Project ID (e.g., `tractatus`)

**Response (200):**
```json
{
  "success": true,
  "project": {
    "_id": "507f1f77bcf86cd799439011",
    "id": "tractatus",
    "name": "Tractatus AI Safety Framework",
    "description": "...",
    "techStack": { ... },
    "repositoryUrl": "...",
    "metadata": { ... },
    "active": true,
    "variableCount": 7,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Project not found"
}
```

---

### POST /api/admin/projects

Create a new project.

**Request Body:**
```json
{
  "id": "new-project",
  "name": "New Project Name",
  "description": "Optional description",
  "techStack": {
    "framework": "Express.js",
    "database": "MongoDB"
  },
  "repositoryUrl": "https://github.com/...",
  "metadata": {
    "environment": "development"
  },
  "active": true
}
```

**Required Fields:**
- `id` (string): Unique project identifier (kebab-case recommended)
- `name` (string): Project display name

**Response (201):**
```json
{
  "success": true,
  "project": { ... },
  "message": "Project created successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Project with this ID already exists"
}
```

---

### PUT /api/admin/projects/:id

Update an existing project.

**URL Parameters:**
- `id` (string, required): Project ID

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "techStack": {
    "framework": "Next.js",
    "database": "PostgreSQL"
  },
  "repositoryUrl": "https://github.com/...",
  "metadata": {
    "version": "2.0"
  },
  "active": true
}
```

**Response (200):**
```json
{
  "success": true,
  "project": { ... },
  "message": "Project updated successfully"
}
```

---

### DELETE /api/admin/projects/:id

Delete a project (soft delete by default).

**URL Parameters:**
- `id` (string, required): Project ID

**Query Parameters:**
- `hard` (string, optional): Set to `"true"` for permanent deletion

**Behavior:**
- **Soft Delete (default)**: Sets `active: false` on project and all its variables
- **Hard Delete**: Permanently removes project and all associated variables from database

**Response (200):**
```json
{
  "success": true,
  "message": "Project deleted successfully (soft delete)",
  "deletedCount": 1,
  "variablesDeactivated": 7
}
```

**Hard Delete Response:**
```json
{
  "success": true,
  "message": "Project permanently deleted",
  "deletedCount": 1,
  "variablesDeleted": 7
}
```

---

### GET /api/admin/projects/stats

Get project statistics.

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total": 4,
    "active": 3,
    "inactive": 1,
    "byDatabase": {
      "MongoDB": 2,
      "PostgreSQL": 1,
      "MySQL": 1
    },
    "totalVariables": 26
  }
}
```

---

## Variables API

### GET /api/admin/projects/:projectId/variables

Get all variables for a specific project.

**URL Parameters:**
- `projectId` (string, required): Project ID

**Response (200):**
```json
{
  "success": true,
  "variables": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "projectId": "tractatus",
      "variableName": "DB_NAME",
      "value": "tractatus_prod",
      "description": "Production database name",
      "category": "database",
      "dataType": "string",
      "active": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 7
}
```

---

### GET /api/admin/projects/variables/global

Get all variables across all projects.

**Query Parameters:**
- `active` (string, optional): Filter by active status

**Response (200):**
```json
{
  "success": true,
  "variables": [
    {
      "_id": "...",
      "projectId": "tractatus",
      "variableName": "DB_NAME",
      "value": "tractatus_prod",
      "projectName": "Tractatus AI Safety Framework",
      ...
    }
  ],
  "total": 26
}
```

---

### POST /api/admin/projects/:projectId/variables

Create or update a variable (upsert).

**URL Parameters:**
- `projectId` (string, required): Project ID

**Request Body:**
```json
{
  "variableName": "DB_NAME",
  "value": "tractatus_prod",
  "description": "Production database name",
  "category": "database",
  "dataType": "string"
}
```

**Required Fields:**
- `variableName` (string): Variable name in UPPER_SNAKE_CASE (e.g., `DB_NAME`, `API_KEY_2`)
- `value` (string): Variable value

**Variable Name Validation:**
- Must match pattern: `/^[A-Z][A-Z0-9_]*$/`
- Must start with uppercase letter
- Can only contain uppercase letters, numbers, and underscores

**Categories:**
- `database` - Database configuration
- `config` - Application configuration
- `url` - URLs and endpoints
- `path` - File paths and directories
- `security` - Security credentials (use with caution)
- `feature_flag` - Feature flags
- `other` - Miscellaneous

**Data Types:**
- `string` (default)
- `number`
- `boolean`
- `json`

**Response (201 for create, 200 for update):**
```json
{
  "success": true,
  "variable": { ... },
  "message": "Variable created successfully",
  "isNew": true
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid variable name",
  "message": "Variable name must be UPPER_SNAKE_CASE (e.g., DB_NAME, API_KEY_2)"
}
```

---

### PUT /api/admin/projects/:projectId/variables/:variableName

Update an existing variable.

**URL Parameters:**
- `projectId` (string, required): Project ID
- `variableName` (string, required): Variable name

**Request Body (all fields optional):**
```json
{
  "value": "new_value",
  "description": "Updated description",
  "category": "config",
  "dataType": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "variable": { ... },
  "message": "Variable updated successfully"
}
```

---

### DELETE /api/admin/projects/:projectId/variables/:variableName

Delete a variable (soft delete by default).

**URL Parameters:**
- `projectId` (string, required): Project ID
- `variableName` (string, required): Variable name

**Query Parameters:**
- `hard` (string, optional): Set to `"true"` for permanent deletion

**Response (200):**
```json
{
  "success": true,
  "message": "Variable deleted successfully"
}
```

---

### POST /api/admin/projects/:projectId/variables/validate

Validate variables against governance rules.

**URL Parameters:**
- `projectId` (string, required): Project ID

**Request Body:**
```json
{
  "variables": ["DB_NAME", "API_PORT", "LOG_LEVEL"]
}
```

**Response (200):**
```json
{
  "success": true,
  "validation": {
    "projectId": "tractatus",
    "totalVariables": 3,
    "found": ["DB_NAME", "API_PORT"],
    "missing": ["LOG_LEVEL"],
    "missingCount": 1
  }
}
```

---

### POST /api/admin/projects/:projectId/variables/batch

Batch create/update variables.

**URL Parameters:**
- `projectId` (string, required): Project ID

**Request Body:**
```json
{
  "variables": [
    {
      "variableName": "DB_NAME",
      "value": "tractatus_prod",
      "description": "Database name",
      "category": "database"
    },
    {
      "variableName": "DB_PORT",
      "value": "27017",
      "description": "Database port",
      "category": "database",
      "dataType": "number"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "results": {
    "created": 1,
    "updated": 1,
    "failed": 0,
    "total": 2
  },
  "variables": [ ... ],
  "message": "Batch operation completed: 1 created, 1 updated"
}
```

---

## Variable Substitution

### GET /api/admin/rules?projectId={projectId}

Get rules with variable substitution.

**Query Parameters:**
- `projectId` (string, optional): Project ID for variable substitution
- All standard rule filters (scope, quadrant, etc.)

**Behavior:**
- When `projectId` is **not** provided: Returns rules with template text only
- When `projectId` **is** provided: Returns rules with both template and rendered text

**Response WITHOUT projectId:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "inst_001",
      "text": "Connect to database ${DB_NAME} on port ${DB_PORT}",
      "scope": "UNIVERSAL",
      ...
    }
  ]
}
```

**Response WITH projectId:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "inst_001",
      "text": "Connect to database ${DB_NAME} on port ${DB_PORT}",
      "renderedText": "Connect to database tractatus_prod on port 27017",
      "projectContext": "tractatus",
      "substitutions": {
        "DB_NAME": "tractatus_prod",
        "DB_PORT": "27017"
      },
      "scope": "UNIVERSAL",
      ...
    }
  ]
}
```

**Variable Detection:**
- Variables are detected using pattern: `/\$\{([A-Z][A-Z0-9_]*)\}/g`
- Only UPPER_SNAKE_CASE variables are recognized
- Missing variables are left as `${MISSING_VAR}` in rendered text
- Warning included in response if variables are missing

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate ID |
| 500 | Internal Server Error | Server-side error |

### Common Error Scenarios

**Duplicate Project ID:**
```json
{
  "success": false,
  "message": "Project with ID 'tractatus' already exists"
}
```

**Invalid Variable Name:**
```json
{
  "success": false,
  "error": "Invalid variable name",
  "message": "Variable name must be UPPER_SNAKE_CASE (e.g., DB_NAME, API_KEY_2)"
}
```

**Project Not Found:**
```json
{
  "success": false,
  "message": "Project 'invalid-id' not found"
}
```

---

## Usage Examples

### Example 1: Create a New Project with Variables

```javascript
// Step 1: Create project
const projectResponse = await fetch('/api/admin/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'my-app',
    name: 'My Application',
    description: 'A new application',
    techStack: {
      framework: 'Express.js',
      database: 'MongoDB'
    },
    active: true
  })
});

const project = await projectResponse.json();
console.log(project.project.id); // 'my-app'

// Step 2: Add variables using batch operation
const variablesResponse = await fetch('/api/admin/projects/my-app/variables/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    variables: [
      {
        variableName: 'DB_NAME',
        value: 'my_app_db',
        category: 'database'
      },
      {
        variableName: 'APP_PORT',
        value: '3000',
        category: 'config',
        dataType: 'number'
      }
    ]
  })
});

const result = await variablesResponse.json();
console.log(result.results); // { created: 2, updated: 0, failed: 0, total: 2 }
```

### Example 2: View Rules with Variable Substitution

```javascript
// Get rules with variable substitution for 'tractatus' project
const response = await fetch('/api/admin/rules?projectId=tractatus', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();

data.rules.forEach(rule => {
  console.log('Template:', rule.text);
  // "Connect to database ${DB_NAME} on port ${DB_PORT}"

  console.log('Rendered:', rule.renderedText);
  // "Connect to database tractatus_prod on port 27017"

  console.log('Substitutions:', rule.substitutions);
  // { DB_NAME: "tractatus_prod", DB_PORT: "27017" }
});
```

### Example 3: Update Variable Value

```javascript
// Update DB_PORT for tractatus project
const response = await fetch('/api/admin/projects/tractatus/variables/DB_PORT', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    value: '27018', // Updated port
    description: 'Updated MongoDB port'
  })
});

const result = await response.json();
console.log(result.message); // 'Variable updated successfully'
```

### Example 4: Validate Required Variables

```javascript
// Check if all required variables exist for a project
const response = await fetch('/api/admin/projects/my-app/variables/validate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    variables: ['DB_NAME', 'DB_PORT', 'API_KEY', 'SECRET_KEY']
  })
});

const validation = await response.json();

if (validation.validation.missingCount > 0) {
  console.error('Missing variables:', validation.validation.missing);
  // Create missing variables...
}
```

### Example 5: Soft Delete vs Hard Delete

```javascript
// Soft delete (default) - deactivates project and variables
const softDelete = await fetch('/api/admin/projects/old-project', {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

const result1 = await softDelete.json();
console.log(result1.message); // 'Project deleted successfully (soft delete)'

// Hard delete - permanently removes from database
const hardDelete = await fetch('/api/admin/projects/old-project?hard=true', {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

const result2 = await hardDelete.json();
console.log(result2.message); // 'Project permanently deleted'
```

---

## Best Practices

### Variable Naming
- ✅ Use UPPER_SNAKE_CASE: `DB_NAME`, `API_KEY_2`, `MAX_CONNECTIONS`
- ❌ Avoid lowercase or camelCase: `dbName`, `api_key`, `maxConnections`

### Security
- 🔒 Never commit sensitive variable values to version control
- 🔒 Use category `security` for credentials
- 🔒 Consider encrypting sensitive values in database
- 🔒 Rotate API keys regularly

### Organization
- 📁 Use categories to group related variables
- 📝 Provide clear descriptions for all variables
- 🏷️ Use consistent naming conventions across projects
- 🔄 Use batch operations for bulk updates

### Performance
- ⚡ Cache project data when possible
- ⚡ Use filters to reduce response payload
- ⚡ Batch variable operations instead of individual requests
- ⚡ Only request variable substitution when needed

---

## API Version History

**v1.0 (2025-01-15)**
- Initial release
- Projects CRUD operations
- Variables CRUD operations
- Variable substitution in rules
- Batch operations
- Validation endpoints

---

**Last Updated:** 2025-01-15
**Maintained By:** Tractatus Framework Team
