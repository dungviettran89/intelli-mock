# Intelli-Mock — Database Schema

> TypeORM entities for sql.js (dev) / MariaDB (prod) — Multi-tenant JWT-isolated

---

## 1. Overview

| Aspect | Detail |
|---|---|
| **ORM** | TypeORM (decorator-based) |
| **Dev Driver** | `sql.js` (SQLite in-memory) |
| **Prod Driver** | `mariadb` (MariaDB 10.5+) |
| **Sync Strategy** | Migrations (never `synchronize: true` in prod) |
| **Naming Convention** | `snake_case` for columns, `PascalCase` for entities |
| **Timestamps** | `createdAt`, `updatedAt` on all entities (auto-managed by TypeORM) |
| **Soft Deletes** | Not used (except TrafficLog retention cron). CASCADE deletes on parent removal |
| **Tenant Isolation** | All queries scoped by `tenant_id` at service level + JWT claim resolution |

### Multi-Tenant JWT Isolation Model

All data access flows through a strict tenant resolution pipeline:

```
JWT Token (Bearer header)
    │
    ├── Extract claims: { tenant: "<slug>", sub: "<user-id>", email?, roles? }
    │
    ▼
TenantResolver Service
    │
    ├── 1. Lookup Tenant by slug (upsert if not exists)
    │    └── Auto-provisions Tenant record on first encounter
    │
    ├── 2. Upsert User record (tenantId + sub)
    │    └── Updates lastSeenAt on every request
    │
    └── 3. Return { tenantId, userId, roles }
         └── All subsequent queries MUST include tenantId
```

**Tenant Scoping Enforcement:**

| Layer | Responsibility |
|---|---|
| **JWT Middleware** | Extracts and validates token, attaches claims to `req.context` |
| **TenantResolver** | Resolves `claims.tenant` → `Tenant.id` (upsert), upserts `User` |
| **Service Layer** | All repository queries include `where: { tenantId }` — no exceptions |
| **Repository Level** | No global scopes; tenant filtering is explicit in every query |
| **Route Matching** | Longest-match filter scoped to tenant — no cross-tenant route leakage |

**JWT Claim Schema:**

| Claim | Type | Required | Description |
|---|---|---|---|
| `tenant` | `string` | ✅ | Tenant slug — maps to `tenants.slug` |
| `sub` | `string` | ✅ | User identity — maps to `users.sub` |
| `email` | `string` | ❌ | User email — maps to `users.email` |
| `roles` | `string[]` | ❌ | User roles — defaults to `["user"]` |
| `iat` | `number` | ✅ | Issued-at timestamp |
| `iss` | `string` | ✅ | Issuer — must match `JWT_ISSUER` env |
| `exp` | `number` | ✅ | Expiration timestamp |

**Auto-Provisioning Edge Cases:**

| Scenario | Behavior |
|---|---|
| Tenant slug not found | Creates new `Tenant` record with `name = slug`, `slug = slug` |
| User `sub` not found in tenant | Creates new `User` with default roles `["user"]` |
| Tenant exists but User doesn't | Upserts `User` record (normal first-login) |
| JWT `tenant` claim missing | Returns `403 Tenant not found` — no auto-provisioning |
| Concurrent first requests | Race condition handled by `slug` UNIQUE constraint — one wins, other gets existing record |

---

## 2. Entity Schemas

### 2.1 Tenant

A team/workspace namespace. All mock endpoints belong to exactly one tenant.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `name` | `VARCHAR(255)` | ❌ | — | Display name |
| `slug` | `VARCHAR(100)` | ❌ | — | URL-safe unique identifier |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |
| `updatedAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP ON UPDATE` | Auto-updated |

**Indexes:**
- `UNIQUE` on `slug`
- `INDEX` on `name`

**Constraints:**
- `slug` must match `^[a-z0-9]+(-[a-z0-9]+)*$` (validated at application layer)
- `slug` should be unique per instance (enforced by UNIQUE index)
- Tenants are created automatically on first JWT encounter if not exists (upsert by slug)

**TypeORM Entity:**

```ts
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MockEndpoint, (e) => e.tenant)
  mockEndpoints: MockEndpoint[];

  @OneToMany(() => User, (u) => u.tenant)
  users: User[];
}
```

---

### 2.2 MockEndpoint

Configuration for a single mock API endpoint.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `tenantId` | `VARCHAR(36)` / `UUID` | ❌ | — | FK → `tenants.id` |
| `pathPattern` | `VARCHAR(500)` | ❌ | — | Express-style route pattern (`:id`, `*`) |
| `method` | `ENUM` | ❌ | `'ANY'` | HTTP method |
| `proxyUrl` | `VARCHAR(2048)` | ✅ | `NULL` | Upstream URL for proxy mode |
| `proxyTimeoutMs` | `INT` | ✅ | `NULL` | Proxy timeout in ms (default from env, typically 30000) |
| `status` | `ENUM` | ❌ | `'draft'` | `draft` \| `ready` \| `active` \| `deactivated` |
| `promptExtra` | `TEXT` | ✅ | `NULL` | User-supplied AI guidance |
| `priority` | `INT` | ❌ | `0` | Override for longest-match tiebreaker |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |
| `updatedAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP ON UPDATE` | Auto-updated |

**Enums:**

```ts
// method enum values
enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  ANY = 'ANY',  // Matches all methods
}

// status enum values
enum MockEndpointStatus {
  DRAFT = 'draft',
  READY = 'ready',
  ACTIVE = 'active',
  DEACTIVATED = 'deactivated',
}
```

**Indexes:**
- `INDEX(tenantId, status, method)` — primary route lookup filter (WHERE tenant_id = ? AND status = 'active' AND method IN (?, 'ANY'))
- `INDEX(tenantId, status)` — list filtering (dashboard, mock list)
- `INDEX(tenantId, status, createdAt)` — dashboard queries (active mocks by creation date)

**Constraints:**
- `FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE`
- `pathPattern` must not be empty — enforced via `CHECK (CHAR_LENGTH(path_pattern) > 0)` in MariaDB 10.5+
- `priority` bounded: `CHECK (priority BETWEEN -999999 AND 999999)` — prevents accidental extreme values
- `proxyUrl` must be valid URL when set (validated at application layer)
- `proxyTimeoutMs` must be positive when set: `CHECK (proxyTimeoutMs IS NULL OR proxyTimeoutMs > 0)`

**Cascade Rules:**
- On delete: CASCADE → `SamplePair`, `MockScript`
- On delete: SET NULL → `TrafficLog` (preserves traffic history)

**TypeORM Entity:**

```ts
@Entity('mock_endpoints')
@Index(['tenantId', 'status', 'method'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'status', 'createdAt'])
export class MockEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'path_pattern', length: 500 })
  pathPattern: string;

  @Column({
    type: 'enum',
    enum: HttpMethod,
    default: HttpMethod.ANY,
  })
  method: HttpMethod;

  @Column({ name: 'proxy_url', length: 2048, nullable: true })
  proxyUrl: string | null;

  @Column({ name: 'proxy_timeout_ms', type: 'int', nullable: true })
  proxyTimeoutMs: number | null;

  @Column({
    type: 'enum',
    enum: MockEndpointStatus,
    default: MockEndpointStatus.DRAFT,
  })
  status: MockEndpointStatus;

  @Column({ name: 'prompt_extra', type: 'text', nullable: true })
  promptExtra: string | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SamplePair, (s) => s.endpoint)
  samplePairs: SamplePair[];

  @OneToMany(() => MockScript, (s) => s.endpoint)
  mockScripts: MockScript[];

  @OneToMany(() => TrafficLog, (l) => l.endpoint)
  trafficLogs: TrafficLog[];
}
```

**Status State Machine:**

```
draft → ready → active → deactivated
  └─────────────────────────────→ (delete)
```

- `draft`: Initial state, not yet routable
- `ready`: Has 5+ samples, can be activated
- `active`: Live, serving requests on `/_it/mock/*` and `/_it/auto/*`
- `deactivated`: Previously active, now disabled but not deleted

---

### 2.3 SamplePair

Request/response example pairs for AI script generation.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `endpointId` | `VARCHAR(36)` / `UUID` | ❌ | — | FK → `mock_endpoints.id` |
| `source` | `ENUM` | ❌ | `'manual'` | How sample was captured |
| `request` | `JSON` | ❌ | — | Captured request data |
| `response` | `JSON` | ❌ | — | Captured response data |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |

**Enums:**

```ts
enum SampleSource {
  MANUAL = 'manual',     // User-provided via UI/API
  PROXY = 'proxy',       // Auto-captured from proxy mode
}
```

**Request JSON Schema:**

```ts
interface SampleRequest {
  method: string;           // HTTP method used
  path: string;             // Actual request path
  params?: Record<string, any>;    // Route params
  query?: Record<string, any>;     // Query string params
  headers?: Record<string, string>; // Request headers
  body?: any;               // Parsed request body
}
```

**Response JSON Schema:**

```ts
interface SampleResponse {
  status: number;           // HTTP status code
  headers?: Record<string, string>; // Response headers
  body: any;                // Response body
  latency?: number;         // Response time in ms
}
```

**Indexes:**
- `INDEX(endpointId)` — lookup by endpoint
- `INDEX(source)` — filter by capture method

**Constraints:**
- `FOREIGN KEY (endpointId) REFERENCES mock_endpoints(id) ON DELETE CASCADE`
- `request` and `response` must be valid JSON (validated at application layer)

**TypeORM Entity:**

```ts
@Entity('sample_pairs')
@Index(['endpointId'])
@Index(['source'])
export class SamplePair {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MockEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint: MockEndpoint;

  @Column({ name: 'endpoint_id' })
  endpointId: string;

  @Column({
    type: 'enum',
    enum: SampleSource,
    default: SampleSource.MANUAL,
  })
  source: SampleSource;

  @Column({ type: 'json' })
  request: SampleRequest;

  @Column({ type: 'json' })
  response: SampleResponse;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

### 2.4 MockScript

AI-generated JavaScript code for mock execution. Versioned, one active at a time.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `endpointId` | `VARCHAR(36)` / `UUID` | ❌ | — | FK → `mock_endpoints.id` |
| `version` | `INT` | ❌ | — | Auto-incrementing version number |
| `code` | `TEXT` | ❌ | — | JavaScript source code |
| `aiModel` | `VARCHAR(100)` | ❌ | — | Model used for generation (e.g., `gpt-4o`) |
| `aiPrompt` | `TEXT` | ✅ | `NULL` | Prompt used (for debugging/reproducibility) |
| `isActive` | `BOOLEAN` | ❌ | `false` | Whether this version is currently executed |
| `validationError` | `TEXT` | ✅ | `NULL` | Syntax error if validation failed |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |

**Indexes:**
- `UNIQUE(endpointId, version)` — version uniqueness per endpoint
- `INDEX(endpointId, isActive)` — find active script quickly

**Constraints:**
- `FOREIGN KEY (endpointId) REFERENCES mock_endpoints(id) ON DELETE CASCADE`
- Only ONE row per endpoint may have `isActive = true`
- Enforced at **application level**: Deactivate old script, then activate new one within a single transaction
- `version` starts at 1 and increments monotonically
- Version gap detection (e.g., 1, 2, 5) indicates deleted intermediate versions — this is acceptable

**TypeORM Entity:**

```ts
@Entity('mock_scripts')
@Index(['endpointId', 'version'], { unique: true })
@Index(['endpointId', 'isActive'])
export class MockScript {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MockEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint: MockEndpoint;

  @Column({ name: 'endpoint_id' })
  endpointId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  code: string;

  @Column({ name: 'ai_model', length: 100 })
  aiModel: string;

  @Column({ name: 'ai_prompt', type: 'text', nullable: true })
  aiPrompt: string | null;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'validation_error', type: 'text', nullable: true })
  validationError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Versioning Strategy:**

- Each `generate` or `regenerate` call creates a new version
- New version gets `isActive = true`, previous active script set to `false`
- Version numbers are sequential (1, 2, 3...) per endpoint
- Scripts are never physically deleted (except CASCADE on endpoint delete)
- Future: rollback to any previous version

---

### 2.5 TrafficLog

Captured request/response with configurable retention period. **Every log entry is explicitly tenant-scoped**, even when no mock endpoint matches.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `tenantId` | `VARCHAR(36)` / `UUID` | ✅ | `NULL` | FK → `tenants.id` (set from JWT, null for unmatched unknown tenants) |
| `endpointId` | `VARCHAR(36)` / `UUID` | ✅ | `NULL` | FK → `mock_endpoints.id` (null for unmatched) |
| `route` | `VARCHAR(255)` | ❌ | — | Matched route pattern (or raw path) |
| `method` | `VARCHAR(10)` | ❌ | — | HTTP method |
| `path` | `VARCHAR(2048)` | ❌ | — | Full request path |
| `request` | `JSON` | ❌ | — | Request data |
| `response` | `JSON` | ❌ | — | Response data |
| `source` | `ENUM` | ❌ | `'mock'` | How this log was generated |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |

**Enums:**

```ts
enum TrafficSource {
  MOCK = 'mock',     // Direct mock (/_it/mock/*)
  PROXY = 'proxy',   // Proxy pass-through (/_it/auto/* → upstream)
  FALLBACK = 'fallback', // Auto-endpoint fallback to mock
}
```

**Request JSON Schema:**

```ts
interface TrafficRequest {
  params?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}
```

**Response JSON Schema:**

```ts
interface TrafficResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  latency: number;  // ms
}
```

**Indexes:**
- `INDEX(tenantId, endpointId, createdAt)` — paginated log browsing (tenant + endpoint-scoped)
- `INDEX(tenantId, createdAt)` — tenant-scoped retention cron purge, orphan queries
- `INDEX(tenantId, route, createdAt)` — tenant-scoped route-based filtering
- `INDEX(tenantId, method)` — tenant-scoped HTTP method filter
- `INDEX(tenantId, source)` — tenant-scoped mock vs proxy filter
- `INDEX(tenantId, source, endpointId, createdAt)` — common filter pattern (e.g., all proxy logs for tenant)

**Constraints:**
- `FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE`
  - When a tenant is deleted, all their traffic logs are deleted too
- `FOREIGN KEY (endpointId) REFERENCES mock_endpoints(id) ON DELETE SET NULL`
  - Uses `SET NULL` instead of CASCADE so traffic history is preserved for analysis even after endpoint deletion
  - Even when `endpointId` is NULL, `tenantId` is always set (for authenticated requests)
- `route` stores the matched pattern (e.g., `/test/:id`) for post-delete reference

**Orphan Log Handling:**

TrafficLog entries with `endpointId = NULL` are created when:
- No mock endpoint matches the request path
- The matched endpoint was deleted after the log was created (rare, since FK is set at insert time)

Orphan logs are still tenant-scoped via `tenantId` (set from JWT on every authenticated request). They remain queryable by tenant even after the endpoint is gone:

```ts
// Find all orphan logs for a tenant (no matched endpoint)
const orphans = await trafficLogRepo.find({
  where: { tenantId, endpointId: IsNull() },
  order: { createdAt: 'DESC' },
  take: 100,
});
```

**TypeORM Entity:**

```ts
@Entity('traffic_logs')
@Index(['tenantId', 'endpointId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'route', 'createdAt'])
@Index(['tenantId', 'method'])
@Index(['tenantId', 'source'])
@Index(['tenantId', 'source', 'endpointId', 'createdAt'])
export class TrafficLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => MockEndpoint, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint: MockEndpoint | null;

  @Column({ name: 'endpoint_id', nullable: true })
  endpointId: string | null;

  @Column({ length: 255 })
  route: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 2048 })
  path: string;

  @Column({ type: 'json' })
  request: TrafficRequest;

  @Column({ type: 'json' })
  response: TrafficResponse;

  @Column({
    type: 'enum',
    enum: TrafficSource,
    default: TrafficSource.MOCK,
  })
  source: TrafficSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Tenant ID Population:**

| Scenario | tenantId | endpointId |
|---|---|---|
| Authenticated request, endpoint matched | Set from JWT | Set to matched endpoint |
| Authenticated request, no endpoint match | Set from JWT | NULL |
| Unauthenticated request (should be rejected) | NULL | NULL |
| Endpoint deleted after log created | Set from JWT (preserved) | NULL (SET NULL) |

**Retention Policy:**

- Configurable via `TRAFFIC_RETENTION_DAYS` env var (default: 30)
- Cron job runs daily at 02:00 UTC
- Deletes all records where `createdAt < NOW() - INTERVAL <N> DAYS`
- Implemented at service layer, not DB-level (for driver compatibility)

**Source Enum Usage:**

| Source | When Used | endpointId Required? | tenantId |
|---|---|---|---|
| `mock` | Request to `/_it/mock/*` handled by AI script | Set if endpoint matched, NULL otherwise | Always set (from JWT) |
| `proxy` | Request to `/_it/auto/*` forwarded to upstream successfully | Set if endpoint matched, NULL otherwise | Always set (from JWT) |
| `fallback` | Request to `/_it/auto/*` failed upstream, fell back to mock | Set if endpoint matched, NULL otherwise | Always set (from JWT) |

**Important:** TrafficLog entries are created even when no mock endpoint matches (unmatched requests). In these cases, `endpointId` is `NULL` but `tenantId` is always set from the JWT. This ensures all logs are tenant-queryable and prevents cross-tenant data leakage.

---

### 2.6 User

Minimal identity record from JWT claims.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | ❌ | `uuid()` | Primary key |
| `tenantId` | `VARCHAR(36)` / `UUID` | ❌ | — | FK → `tenants.id` |
| `sub` | `VARCHAR(255)` | ❌ | — | JWT `sub` claim (upstream identity) |
| `email` | `VARCHAR(255)` | ✅ | `NULL` | Email from JWT (if available) |
| `roles` | `JSON` | ❌ | `'["user"]'` | Role array |
| `lastSeenAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Last request timestamp |
| `createdAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP` | Auto-set on insert |
| `updatedAt` | `DATETIME` | ❌ | `CURRENT_TIMESTAMP ON UPDATE` | Auto-updated |

**Indexes:**
- `UNIQUE(tenantId, sub)` — one user per tenant per identity
- `INDEX(tenantId)` — tenant user listing
- `INDEX(tenantId, lastSeenAt)` — inactive user detection (users who haven't been seen in N days)

**Constraints:**
- `FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE`
- `sub` must be present in JWT (required claim)
- `roles` defaults to `["user"]` at application layer (not DB-level, to avoid fragile string escaping)

**TypeORM Entity:**

```ts
@Entity('users')
@Index(['tenantId', 'sub'], { unique: true })
@Index(['tenantId'])
@Index(['tenantId', 'lastSeenAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ length: 255 })
  sub: string;

  @Column({ length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'simple-json' })
  roles: string[];  // Application-level default: () => ['user']

  @Column({ name: 'last_seen_at', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Auto-Creation Behavior:**

- On first JWT encounter for a tenant, User record is upserted by `sub`
- `lastSeenAt` is updated on every authenticated request
- Roles default to `["user"]`, can be overridden by admin

---

## 3. Relationships Diagram

```
Tenant (1) ────< (N) MockEndpoint
                            │
                            ├──< (N) SamplePair        (CASCADE delete)
                            ├──< (N) MockScript        (CASCADE delete)
                            └──< (N) TrafficLog        (SET NULL on delete)

Tenant (1) ────< (N) User                             (CASCADE delete)
```

### Deletion Behavior Summary

| Parent Deleted | Child | Behavior | Rationale |
|---|---|---|---|
| Tenant | MockEndpoint | CASCADE | All mocks belong to tenant |
| Tenant | User | CASCADE | Users are tenant-scoped |
| Tenant | TrafficLog | CASCADE | All traffic belongs to tenant |
| MockEndpoint | SamplePair | CASCADE | Samples are endpoint-specific |
| MockEndpoint | MockScript | CASCADE | Scripts are endpoint-specific |
| MockEndpoint | TrafficLog | SET NULL | Preserve traffic history; tenantId still links to owner |

### Foreign Key Summary

| FK Column | References | On Delete | On Update |
|---|---|---|---|
| `mock_endpoints.tenant_id` | `tenants.id` | CASCADE | CASCADE |
| `sample_pairs.endpoint_id` | `mock_endpoints.id` | CASCADE | CASCADE |
| `mock_scripts.endpoint_id` | `mock_endpoints.id` | CASCADE | CASCADE |
| `traffic_logs.tenant_id` | `tenants.id` | CASCADE | CASCADE |
| `traffic_logs.endpoint_id` | `mock_endpoints.id` | SET NULL | CASCADE |
| `users.tenant_id` | `tenants.id` | CASCADE | CASCADE |

---

## 4. SQL Definitions

### 4.1 MariaDB (Production)

```sql
-- Tenants
CREATE TABLE tenants (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenants_slug (slug),
  INDEX idx_tenants_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mock Endpoints
CREATE TABLE mock_endpoints (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  tenant_id CHAR(36) NOT NULL,
  path_pattern VARCHAR(500) NOT NULL,
  method ENUM('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','ANY') NOT NULL DEFAULT 'ANY',
  proxy_url VARCHAR(2048) DEFAULT NULL,
  proxy_timeout_ms INT DEFAULT NULL,
  status ENUM('draft','ready','active','deactivated') NOT NULL DEFAULT 'draft',
  prompt_extra TEXT DEFAULT NULL,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_me_path_pattern_not_empty CHECK (CHAR_LENGTH(path_pattern) > 0),
  CONSTRAINT chk_me_priority_range CHECK (priority BETWEEN -999999 AND 999999),
  CONSTRAINT chk_me_proxy_timeout_positive CHECK (proxy_timeout_ms IS NULL OR proxy_timeout_ms > 0),
  INDEX idx_me_tenant_status_method (tenant_id, status, method),
  INDEX idx_me_tenant_status (tenant_id, status),
  INDEX idx_me_tenant_status_created (tenant_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample Pairs
CREATE TABLE sample_pairs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  endpoint_id CHAR(36) NOT NULL,
  source ENUM('manual','proxy') NOT NULL DEFAULT 'manual',
  request JSON NOT NULL,
  response JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_sp_endpoint (endpoint_id),
  INDEX idx_sp_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mock Scripts
CREATE TABLE mock_scripts (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  endpoint_id CHAR(36) NOT NULL,
  version INT NOT NULL,
  code TEXT NOT NULL,
  ai_model VARCHAR(100) NOT NULL,
  ai_prompt TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  validation_error TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uk_ms_endpoint_version (endpoint_id, version),
  INDEX idx_ms_endpoint_active (endpoint_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Traffic Logs
CREATE TABLE traffic_logs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  tenant_id CHAR(36) DEFAULT NULL,
  endpoint_id CHAR(36) DEFAULT NULL,
  route VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  request JSON NOT NULL,
  response JSON NOT NULL,
  source ENUM('mock','proxy','fallback') NOT NULL DEFAULT 'mock',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_tl_tenant_endpoint_created (tenant_id, endpoint_id, created_at),
  INDEX idx_tl_tenant_created (tenant_id, created_at),
  INDEX idx_tl_tenant_route_created (tenant_id, route, created_at),
  INDEX idx_tl_tenant_method (tenant_id, method),
  INDEX idx_tl_tenant_source (tenant_id, source),
  INDEX idx_tl_tenant_source_endpoint_created (tenant_id, source, endpoint_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users
CREATE TABLE users (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  tenant_id CHAR(36) NOT NULL,
  sub VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  roles JSON NOT NULL DEFAULT ('["user"]'),
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uk_users_tenant_sub (tenant_id, sub),
  INDEX idx_users_tenant (tenant_id),
  INDEX idx_users_tenant_last_seen (tenant_id, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4.2 sql.js (Development)

TypeORM generates tables automatically from entity decorators in development. The equivalent SQL for reference:

```sql
-- sql.js uses INTEGER PRIMARY KEY for auto-increment and stores JSON as TEXT
-- TypeORM entity decorators handle the type mapping automatically:
--   uuid → TEXT (with application-level validation)
--   JSON → TEXT
--   enum → TEXT
--   boolean → INTEGER (0/1)
--   datetime → TEXT (ISO 8601)
--   CURRENT_TIMESTAMP → TEXT (ISO 8601 string)
```

**Important:** sql.js does NOT support foreign key constraints by default. TypeORM will create the tables but FK enforcement must be validated at the application layer. For development, this is acceptable. For integration tests that rely on FK behavior, use MariaDB.

### 4.3 Cross-Driver Compatibility Notes

| Feature | MariaDB | sql.js | Mitigation |
|---|---|---|---|
| **Foreign Keys** | Enforced | Not enforced by default | Application-level validation, integration tests on MariaDB |
| **ENUM constraints** | Native ENUM | TEXT (no constraint) | Application-level enum validation, TypeScript types |
| **JSON columns** | Native JSON | TEXT (manual parse/stringify) | Use `type: 'simple-json'` for sql.js, `type: 'json'` for MariaDB |
| **Composite Indexes** | Full support | Ignored silently | Indexes defined in TypeORM decorators work for MariaDB; sql.js performance is acceptable for dev |
| **Partial Indexes** | Not supported | Not supported | Enforce `isActive` single-active constraint at application level only (transactional update) |
| **`@UpdateDateColumn`** | Auto-updates | **Does NOT auto-update** (SQLite limitation) | Application must manually set `updatedAt` on update, or use TypeORM subscriber |
| **UUID generation** | `DEFAULT (UUID())` | Not supported | Application generates UUIDs via `crypto.randomUUID()` |
| **`DEFAULT` expressions** | Full support | Limited | Avoid complex defaults; use application-level fallbacks |

**Recommended TypeORM Column Definitions for Dual-Driver:**

```ts
// JSON columns - use simple-json for sql.js compatibility
@Column({ type: process.env.DB_TYPE === 'sqljs' ? 'simple-json' : 'json' })
request: SampleRequest;

// Enum columns - TEXT for sql.js, ENUM for MariaDB
@Column({
  type: process.env.DB_TYPE === 'sqljs' ? 'text' : 'enum',
  enum: HttpMethod,
  default: HttpMethod.ANY,
})
method: HttpMethod;

// Boolean columns - INTEGER for sql.js, TINYINT for MariaDB
@Column({
  type: process.env.DB_TYPE === 'sqljs' ? 'simple-enum' : 'boolean',
  default: false,
})
isActive: boolean;
```

**TypeORM Subscriber for `updatedAt` (sql.js workaround):**

```ts
@EventSubscriber()
export class UpdatedAtSubscriber implements EntitySubscriberInterface {
  beforeUpdate(event: UpdateEvent<any>) {
    if (event.entity) {
      event.entity.updatedAt = new Date();
    }
  }
}
```

---

## 5. TypeORM Configuration

### 5.1 Data Source (Production — MariaDB)

```ts
import { DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { MockEndpoint } from './entities/mock-endpoint.entity';
import { SamplePair } from './entities/sample-pair.entity';
import { MockScript } from './entities/mock-script.entity';
import { TrafficLog } from './entities/traffic-log.entity';
import { User } from './entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'intelli_mock',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [Tenant, MockEndpoint, SamplePair, MockScript, TrafficLog, User],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: [],
  charset: 'utf8mb4',
});
```

### 5.2 Data Source (Development — sql.js)

```ts
export const AppDataSourceDev = new DataSource({
  type: 'sqljs',
  synchronize: true,       // OK for dev only
  logging: true,
  entities: [Tenant, MockEndpoint, SamplePair, MockScript, TrafficLog, User],
  migrations: ['src/database/migrations/*.ts'],
  autoSave: false,         // In-memory, no file persistence
});
```

### 5.3 Entity Registration

All entities must be registered in both data sources. The entity list:

```ts
export const ENTITIES = [
  Tenant,
  MockEndpoint,
  SamplePair,
  MockScript,
  TrafficLog,
  User,
];
```

---

## 6. Migration Strategy

### 6.1 Migration Naming

Format: `YYYYMMDDHHmmss-<description>.ts`

Example: `20260406120000-initial-schema.ts`

### 6.2 Initial Migration

The first migration creates all 6 tables with indexes and foreign keys.

### 6.3 Migration Commands

```bash
# Generate migration from entity changes
pnpm --filter @intelli-mock/core typeorm migration:generate -- -d src/database/data-source.ts src/database/migrations/<name>

# Run pending migrations
pnpm --filter @intelli-mock/core typeorm migration:run -- -d src/database/data-source.ts

# Revert last migration
pnpm --filter @intelli-mock/core typeorm migration:revert -- -d src/database/data-source.ts
```

### 6.4 Production Considerations

- Never use `synchronize: true` in production
- Always review auto-generated migrations before running
- Use `--transaction` flag for MariaDB (default in TypeORM)
- Test migrations on staging before production

---

## 7. Query Patterns

### 7.1 Tenant-Scoped Queries (all mandatory)

```ts
// Find active mock endpoints for a tenant
repository.find({
  where: { tenantId, status: MockEndpointStatus.ACTIVE },
  relations: ['samplePairs', 'mockScripts'],
  order: { pathPattern: 'DESC' },  // Longest match first
});

// Find active script for endpoint
scriptRepo.findOne({
  where: { endpointId, isActive: true },
});

// Count samples for endpoint
sampleRepo.count({ where: { endpointId } });
```

### 7.2 Longest-Match Route Matching

```ts
// Get all candidate routes for a tenant + method, sorted by path length descending
const candidates = await endpointRepo.find({
  where: [
    { tenantId, method: targetMethod, status: MockEndpointStatus.ACTIVE },
    { tenantId, method: HttpMethod.ANY, status: MockEndpointStatus.ACTIVE },
  ],
  order: {
    priority: 'DESC',     // User override takes precedence
    pathPattern: 'DESC',  // Alphabetical desc as proxy for length (longer paths tend to sort later)
  },
});
// Application layer then applies Express-style path matching
// For true longest-match, sort in-memory by CHAR_LENGTH(pathPattern):
candidates.sort((a, b) => {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.pathPattern.length - a.pathPattern.length;  // True longest-match
});
```

**Important:** `ORDER BY path_pattern DESC` in SQL sorts **alphabetically**, not by string length. `/test/z` sorts before `/test/abc` alphabetically (z > a), but `/test/abc` is longer. For correct longest-match behavior, the application MUST sort candidates by `pathPattern.length` in-memory after fetching. The database index supports the WHERE clause filtering; the final ordering is done in application code.

**Why not use `ORDER BY CHAR_LENGTH(path_pattern) DESC`?** MariaDB supports this, but TypeORM has no clean decorator for function-based ORDER BY. The in-memory sort is simpler and correct, and the candidate set is small (typically < 100 endpoints per tenant).

### 7.3 Traffic Log Pagination

```ts
const [logs, total] = await trafficLogRepo.findAndCount({
  where: { endpointId },
  order: { createdAt: 'DESC' },
  skip: (page - 1) * pageSize,
  take: pageSize,
});
```

### 7.4 Traffic Retention Cleanup

```ts
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

await trafficLogRepo
  .createQueryBuilder()
  .delete()
  .where('created_at < :cutoff', { cutoff: cutoffDate.toISOString() })
  .execute();
```

### 7.5 Sample Count Check (AI Generation Prerequisite)

```ts
const sampleCount = await sampleRepo.count({ where: { endpointId } });
if (sampleCount < 5) {
  throw new Error(`Need 5+ samples, currently have ${sampleCount}`);
}
```

### 7.6 User Upsert (JWT Auto-Creation)

```ts
await userRepo.upsert(
  { tenantId, sub, email, lastSeenAt: new Date() },
  ['tenantId', 'sub'], // conflict target
);
```

### 7.7 Script Activation (Application-Level Only)

Keep it simple — handle single-active-script entirely at the application layer using a transaction:

```ts
// Service layer: activate a new script
async function activateScript(endpointId: string, newScriptId: string) {
  await this.dataSource.transaction(async (manager) => {
    // Deactivate all scripts for this endpoint
    await manager.update(MockScript, { endpointId, isActive: true }, { isActive: false });
    // Activate new script
    await manager.update(MockScript, { id: newScriptId }, { isActive: true });
  });
}
```

For sql.js (dev), this works fine since development has no concurrent writes. In production, if concurrent writes are a concern, use a service-level lock (e.g., Redis distributed lock) rather than database tricks.

---

## 8. Database-Specific Notes

### 8.1 MariaDB

- Use `utf8mb4` charset for full Unicode support (including emojis)
- UUID stored as `CHAR(36)` (string format, not binary)
- JSON columns use native `JSON` type (MariaDB 10.5+)
- ENUM types are native MySQL enums
- Auto-increment version numbers handled at application layer

### 8.2 sql.js

- All stored in-memory, no persistence between restarts (dev only)
- `JSON` type maps to `TEXT` internally
- `ENUM` types map to `TEXT` (no native enum in SQLite)
- `BOOLEAN` maps to `INTEGER` (0/1)
- `UUID` maps to `TEXT`
- TypeORM `synchronize: true` auto-creates tables from entities

### 8.3 Type Mapping Reference

| TypeORM Type | MariaDB | sql.js |
|---|---|---|
| `uuid` | `CHAR(36)` | `TEXT` |
| `varchar(n)` | `VARCHAR(n)` | `TEXT` |
| `text` | `TEXT` | `TEXT` |
| `json` | `JSON` | `TEXT` |
| `int` | `INT` | `INTEGER` |
| `boolean` | `TINYINT(1)` | `INTEGER` |
| `enum` | `ENUM(...)` | `TEXT` |
| `datetime` | `TIMESTAMP` | `TEXT` |
| `CreateDateColumn` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TEXT` |
| `UpdateDateColumn` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | `TEXT` |

---

## 9. Security Considerations

- **No PII stored**: Email is optional and comes from JWT only
- **Tenant isolation**: All queries must include `tenantId` in WHERE clause
  - JWT middleware extracts tenant claim → TenantResolver resolves to `tenantId`
  - Service layer enforces `where: { tenantId }` on every query
  - No cross-tenant joins or subqueries allowed
- **Script code stored as TEXT**: Not executed during storage, only in vm2 sandbox
- **No SQL injection**: TypeORM parameterized queries throughout
- **JWT never stored**: Only `sub` claim extracted for User identity
- **Foreign key enforcement**: Application must validate FK relationships when using sql.js (dev driver)
- **`isActive` constraint**: Database trigger (MariaDB) + transactional application logic prevents race conditions

### Tenant Isolation Audit Checklist

Before any new query/service method is merged:

- [ ] Does the query include `tenantId` in the WHERE clause?
- [ ] Are any relations crossing tenant boundaries?
- [ ] Could a crafted request access another tenant's data?
- [ ] Is the `tenantId` extracted from a verified JWT (not user input)?

---

## 10. Performance Considerations

### Query Performance

| Query Pattern | Expected Latency | Index Used |
|---|---|---|
| Find active endpoint by path | < 5ms | `idx_me_tenant_path_method` |
| Find active script for endpoint | < 2ms | `idx_ms_endpoint_active` |
| Paginate traffic logs | < 20ms | `idx_tl_endpoint_created` |
| Count samples for endpoint | < 5ms | `idx_sp_endpoint` |
| Longest-match route sorting | < 10ms | Application sorts in-memory after `idx_me_tenant_path_method` fetch |

### Scaling Guidelines

| Metric | Guideline | Mitigation |
|---|---|---|
| Traffic logs per tenant | < 100K active records | Retention cron keeps table small; partition by month if needed |
| Mock endpoints per tenant | < 1K | No pagination needed; if exceeded, add pagination to mock list API |
| Scripts per endpoint | < 100 | Sequential versions; old scripts can be archived if needed |
| Sample pairs per endpoint | < 50 | No performance impact; samples only used for AI generation |

### Retention Cron Performance

The retention cron deletes records older than N days. For large tables:

```ts
// Batch delete to avoid locking the table
const batchSize = 1000;
let deleted = batchSize;
while (deleted === batchSize) {
  const result = await trafficLogRepo
    .createQueryBuilder()
    .delete()
    .where('created_at < :cutoff', { cutoff: cutoffDate.toISOString() })
    .limit(batchSize)
    .execute();
  deleted = result.affected || 0;
}
```

---

## 11. Future Schema Extensions (Not in Scope)

| Feature | Planned Change |
|---|---|
| Script rollback history | Add `previousActiveId` FK to `mock_scripts` self-reference |
| Mock endpoint templates | Add `isTemplate` boolean + `basedOnId` self-reference to `mock_endpoints` |
| Rate limiting | Add `RateLimitRule` entity linked to `mock_endpoints` |
| Webhook notifications | Add `WebhookConfig` entity per tenant |
| API key management | Add `ApiKey` entity for non-JWT auth |
| Audit log | Add `AuditLog` entity for config changes (who changed what, when) |
| Team member management | Add `TenantMember` junction table with roles (`admin`, `developer`, `viewer`) |
| Traffic log partitioning | Monthly partitioning on `traffic_logs` for high-volume tenants |
| Script execution metrics | Add `ScriptExecutionLog` for performance tracking (latency, error rate) |
