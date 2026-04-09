# API Document

## Overview

Intelli-Mock exposes three categories of endpoints:
1. **Admin/Config API** — Manage mock endpoints, samples, scripts, traffic
2. **Runtime Endpoints** — Serve mock requests (`/_it/mock/*`, `/_it/auto/*`)
3. **Documentation** — Swagger/OpenAPI

All Admin API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Authentication

- JWT token passed via `Authorization: Bearer <token>`
- Token is issued by upstream proxy (IdP)
- `tenant` claim maps to `tenants.slug` — auto-provisions tenant if not exists
- `sub` claim maps to `users.sub` — auto-provisions user if not exists
- Missing or invalid JWT → `401 Unauthorized`
- Unrecognized tenant → `403 Tenant not found`

---

## Admin/Config API

### POST /api/mocks

**Description**: Create a new mock endpoint.

**Request**:
```json
{
  "pathPattern": "/test/:id",
  "method": "GET",
  "proxyUrl": "https://api.example.com/test",
  "promptExtra": "Return a user with the given ID",
  "priority": 0
}
```

**Response**:
```json
{
  "id": "uuid",
  "pathPattern": "/test/:id",
  "method": "GET",
  "proxyUrl": "https://api.example.com/test",
  "status": "draft",
  "promptExtra": "Return a user with the given ID",
  "priority": 0,
  "createdAt": "2026-04-06T12:00:00Z",
  "updatedAt": "2026-04-06T12:00:00Z"
}
```

---

### GET /api/mocks

**Description**: List all mock endpoints (tenant-scoped).

**Query Parameters**:
| Param | Type | Description |
|---|---|---|
| `status` | `string` | Filter by status: `draft`, `ready`, `active`, `deactivated` |
| `method` | `string` | Filter by HTTP method |

**Response**:
```json
[
  {
    "id": "uuid",
    "pathPattern": "/test/:id",
    "method": "GET",
    "status": "active",
    "sampleCount": 10,
    "hasActiveScript": true,
    "createdAt": "2026-04-06T12:00:00Z"
  }
]
```

---

### GET /api/mocks/:id

**Description**: Get mock endpoint details including samples.

**Response**:
```json
{
  "id": "uuid",
  "pathPattern": "/test/:id",
  "method": "GET",
  "proxyUrl": "https://api.example.com/test",
  "status": "active",
  "promptExtra": "Return a user with the given ID",
  "priority": 0,
  "samples": [
    {
      "id": "uuid",
      "source": "manual",
      "request": { "method": "GET", "path": "/test/42" },
      "response": { "status": 200, "body": { "id": 42, "name": "Test" } },
      "createdAt": "2026-04-06T12:00:00Z"
    }
  ],
  "activeScript": {
    "version": 3,
    "aiModel": "gpt-4o",
    "createdAt": "2026-04-06T12:00:00Z"
  },
  "createdAt": "2026-04-06T12:00:00Z",
  "updatedAt": "2026-04-06T12:00:00Z"
}
```

---

### PUT /api/mocks/:id

**Description**: Update mock endpoint configuration.

**Request**:
```json
{
  "pathPattern": "/test/:id",
  "proxyUrl": "https://api.example.com/v2/test",
  "promptExtra": "Updated guidance"
}
```

**Response**: Updated mock endpoint object (same as GET).

---

### DELETE /api/mocks/:id

**Description**: Delete a mock endpoint. CASCADE deletes samples and scripts; SET NULL on traffic logs.

**Response**: `204 No Content`

---

### POST /api/mocks/:id/samples

**Description**: Add a sample request/response pair.

**Request**:
```json
{
  "request": {
    "method": "GET",
    "path": "/test/42",
    "params": { "id": "42" },
    "headers": { "Accept": "application/json" }
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": { "id": 42, "name": "Test User" },
    "latency": 150
  }
}
```

**Response**: Created sample object.

---

### DELETE /api/mocks/:id/samples/:sampleId

**Description**: Remove a sample.

**Response**: `204 No Content`

---

### POST /api/mocks/:id/generate

**Description**: Generate a mock script via AI. Requires minimum 5 samples.

**Request**: `{}` (empty body — uses existing samples + promptExtra)

**Response**:
```json
{
  "version": 1,
  "code": "const { id } = req.params;\nreturn { status: 200, body: { id: parseInt(id) } };",
  "aiModel": "gpt-4o"
}
```

**Error Responses**:
| Status | Error Code | Description |
|--------|------------|-------------|
| 503 | INSUFFICIENT_SAMPLES | Need 5+ samples, currently have N |
| 502 | AI_GENERATION_FAILED | AI generation failed with details |

---

### POST /api/mocks/:id/regenerate

**Description**: Regenerate an improved version of the active script.

**Request**: `{}` (empty body — includes previous script as context)

**Response**: Same as generate — new version with updated code.

---

### POST /api/mocks/:id/try

**Description**: Test the active mock script without persistence.

**Request**:
```json
{
  "method": "GET",
  "path": "/test/42",
  "params": { "id": "42" },
  "headers": {},
  "body": null
}
```

**Response**:
```json
{
  "status": 200,
  "headers": { "Content-Type": "application/json" },
  "body": { "id": 42, "name": "Test User" }
}
```

---

### GET /api/mocks/:id/scripts

**Description**: List all script versions for a mock endpoint.

**Response**:
```json
[
  {
    "id": "uuid",
    "version": 1,
    "aiModel": "gpt-4o",
    "isActive": false,
    "validationError": null,
    "createdAt": "2026-04-06T12:00:00Z"
  },
  {
    "id": "uuid",
    "version": 2,
    "aiModel": "gpt-4o",
    "isActive": true,
    "validationError": null,
    "createdAt": "2026-04-06T13:00:00Z"
  }
]
```

---

### GET /api/mocks/:id/traffic

**Description**: View traffic logs for a mock endpoint.

**Query Parameters**:
| Param | Type | Description |
|---|---|---|
| `page` | `number` | Page number (default: 1) |
| `pageSize` | `number` | Items per page (default: 50) |
| `source` | `string` | Filter by source: `mock`, `proxy`, `fallback` |

**Response**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "route": "/test/:id",
      "method": "GET",
      "path": "/test/42",
      "request": { "params": { "id": "42" } },
      "response": { "status": 200, "body": { "id": 42 }, "latency": 150 },
      "source": "mock",
      "createdAt": "2026-04-06T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 50
}
```

---

### POST /api/auth/verify

**Description**: Verify and refresh JWT token.

**Request**:
```json
{ "token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response**:
```json
{
  "valid": true,
  "tenant": "my-team",
  "sub": "user-123",
  "roles": ["user"],
  "expiresAt": "2026-04-06T13:00:00Z"
}
```

---

### GET /api/health

**Description**: Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected"
}
```

---

### GET /api/stats

**Description**: Tenant statistics.

**Response**:
```json
{
  "mockCount": 15,
  "activeMockCount": 8,
  "trafficCount": 12500,
  "sampleCount": 87
}
```

---

## Runtime Endpoints

These endpoints do NOT require the Admin API — they serve actual mock requests.

### `/_it/mock/**`

**Handler**: MockHandler (100% AI mock)

- Finds longest matching MockEndpoint for the tenant
- Executes active MockScript in vm2 sandbox
- Logs request/response to TrafficLog
- Returns mock response

**Error**: Returns `503` if no active script, `404` if no matching endpoint.

---

### `/_it/auto/**`

**Handler**: AutoHandler (proxy → fallback to mock)

- Finds longest matching MockEndpoint
- If `proxyUrl` configured, forwards to upstream
  - Success → logs and returns upstream response
  - Failure → falls back to mock script
- If no `proxyUrl`, directly uses mock script

**Error**: Returns `502` if fallback mock unavailable.

---

## Documentation

| Path | Content |
|------|---------|
| `/api-docs` | Swagger UI |
| `/swagger.json` | OpenAPI 3.0 spec |

---

## Error Responses

| Scenario | Status | Response |
|---|---|---|
| Mock endpoint not found | 404 | `{ "error": "Mock not found" }` |
| Not enough samples | 503 | `{ "error": "Need 5+ samples", "current": 2 }` |
| AI generation failed | 502 | `{ "error": "AI generation failed", "details": "..." }` |
| Proxy upstream down (auto mode) | — | Falls back to mock (transparent) |
| Fallback mock missing | 502 | `{ "error": "Mock unavailable" }` |
| vm2 execution error | 500 | `{ "error": "Script error", "details": "..." }` |
| JWT missing/invalid | 401 | `{ "error": "Unauthorized" }` |
| Tenant not recognized | 403 | `{ "error": "Tenant not found" }` |
