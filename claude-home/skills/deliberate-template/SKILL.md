---
name: deliberate-template
description: >
  Start a /deliberate session from a pre-built template for common technical
  decisions. Use when the user wants to deliberate on a standard decision type
  (REST vs GraphQL, monolith vs microservices, build vs buy, SQL vs NoSQL,
  cloud provider, frontend framework) and wants a structured starting point.
  Triggers on "/deliberate-template", "deliberate from template",
  "use a template to deliberate", "template for debating".
allowed-tools: Agent, mcp__codex__codex, mcp__codex__codex-reply, Bash(mkdir -p:*), Write, Read
---

# /deliberate-template — Template-Driven Deliberation

Start a structured deliberation using a pre-built template. Templates provide
a focused topic and pre-loaded context so the deliberation immediately digs
into what matters for that decision type.

---

## STEP 1: Show the Template Menu

Present the template categories:

```
================================================================
  Deliberation Templates
================================================================

API Design
  [1] REST vs GraphQL
  [2] REST vs gRPC (internal services)
  [3] Synchronous vs Event-Driven API

Architecture
  [4] Monolith vs Microservices
  [5] Serverless vs Containerized
  [6] Multi-repo vs Monorepo

Data
  [7] SQL vs NoSQL (document store)
  [8] SQL vs NoSQL (key-value / cache)
  [9] Self-hosted DB vs Managed (RDS, Atlas, etc.)

Tooling & Process
  [10] Build vs Buy
  [11] Framework A vs B (fill in your own)
  [12] CI/CD platform choice

Type a number to select, or describe your own topic to skip templates.
```

---

## STEP 2: Collect Context

After the user picks a template number, ask 2-3 targeted questions to
personalize it. Use the question sets below. Ask all questions in a single
message to avoid back-and-forth.

---

### Template [1]: REST vs GraphQL

**Questions to ask:**
```
A few quick questions to tailor the deliberation:

1. What kind of app? (e.g., mobile + web frontend, internal microservices,
   public developer API, or something else)
2. Approximate read/write ratio and data shape complexity?
   (e.g., "mostly reads, simple flat data" vs "complex nested queries")
3. Team's current experience with each? (e.g., "strong REST background,
   no GraphQL experience")
4. Any hard constraints? (e.g., must work with existing API gateway,
   specific client platforms)
```

**Topic template:**
```
Should we use REST or GraphQL for {app_description}? The app has
{read_write_ratio} with {data_complexity}. Team has {team_experience}.
Constraints: {constraints}.
```

---

### Template [2]: REST vs gRPC

**Questions to ask:**
```
1. Internal service-to-service or external-facing?
2. Performance requirements? (latency targets, requests/sec)
3. Client languages? (gRPC has strong Go/Java/Python support, weaker browser)
4. Existing infrastructure? (load balancers, API gateways, service mesh)
```

**Topic template:**
```
Should we use REST or gRPC for {service_description}? It's
{internal/external} with {perf_requirements}. Clients are {languages}.
Infrastructure: {infra_notes}.
```

---

### Template [3]: Synchronous vs Event-Driven API

**Questions to ask:**
```
1. What's the operation? (user-facing action, background processing, etc.)
2. Acceptable latency for the caller? (ms? seconds? async ok?)
3. Failure handling requirements? (retry, dead-letter, at-least-once?)
4. Current messaging infrastructure? (Kafka, SQS, RabbitMQ, none)
```

**Topic template:**
```
Should we handle {operation} synchronously or via events/queues?
Caller latency tolerance: {latency}. Failure needs: {failure_handling}.
Current infra: {messaging_infra}.
```

---

### Template [4]: Monolith vs Microservices

**Questions to ask:**
```
1. Team size and structure? (# of engineers, independent squads?)
2. Current deployment complexity and pain points?
3. Scale requirements? (rough DAU, peak RPS, data volume)
4. Stage of product? (early/growing/mature, rewrite or greenfield)
```

**Topic template:**
```
Should we use a monolith or microservices for {product_description}?
Team: {team_size_structure}. Scale: {scale_requirements}.
Stage: {product_stage}. Current pain: {pain_points}.
```

---

### Template [5]: Serverless vs Containerized

**Questions to ask:**
```
1. Workload pattern? (spiky/bursty vs steady-state)
2. Max acceptable cold-start latency?
3. Required runtime duration? (sub-1s functions vs long-running processes)
4. Cloud vendor preference or constraint?
```

**Topic template:**
```
Should we run {workload_description} serverless (Lambda/Cloud Functions)
or containerized (ECS/GKE/K8s)? Pattern: {workload_pattern}.
Cold start tolerance: {latency}. Duration: {runtime}. Cloud: {vendor}.
```

---

### Template [6]: Multi-repo vs Monorepo

**Questions to ask:**
```
1. How many packages/services involved?
2. How much code is shared across them?
3. Team structure — do different teams own different packages?
4. Current CI/CD setup and pain points with it?
```

**Topic template:**
```
Should we use a monorepo or multi-repo for {project_description}?
{N} packages with {sharing_level} shared code. Team: {team_structure}.
CI/CD: {cicd_setup}. Current pain: {pain_points}.
```

---

### Template [7]: SQL vs NoSQL (document store)

**Questions to ask:**
```
1. Data model — how relational is it? (joins needed? schema fixed or flexible?)
2. Query patterns? (by ID, full-text, complex filters, aggregations)
3. Scale? (rows/docs, writes/sec, read latency requirements)
4. Team's DB experience?
```

**Topic template:**
```
Should we use a relational DB (PostgreSQL) or document store (MongoDB)
for {data_description}? Schema: {schema_flexibility}. Queries:
{query_patterns}. Scale: {scale}. Team DB experience: {experience}.
```

---

### Template [8]: SQL vs NoSQL (key-value / cache)

**Questions to ask:**
```
1. Primary access pattern? (get by key, range scans, TTL-based expiry)
2. Data size per entry and total dataset size?
3. Consistency requirements? (strong, eventual, best-effort)
4. Existing infrastructure? (Redis already in stack? DynamoDB budget?)
```

**Topic template:**
```
Should we use Redis, DynamoDB, or a relational DB for {use_case}?
Access pattern: {access_pattern}. Entry size: {data_size}.
Consistency: {consistency_needs}. Existing infra: {infra}.
```

---

### Template [9]: Self-hosted DB vs Managed

**Questions to ask:**
```
1. DB type and current setup?
2. Team's ops capacity (SRE headcount, on-call coverage)?
3. Compliance/data residency requirements?
4. Rough cost sensitivity? (managed is usually 2-3x self-hosted cost)
```

**Topic template:**
```
Should we self-host {db_type} or use a managed service ({managed_option})?
Ops capacity: {ops_team}. Compliance: {compliance}. Budget: {cost_sensitivity}.
```

---

### Template [10]: Build vs Buy

**Questions to ask:**
```
1. What capability are you considering? (auth, search, notifications, etc.)
2. How core is this to your product differentiation?
3. Engineering cost estimate to build? (rough person-weeks)
4. Vendor options being considered and their pricing?
```

**Topic template:**
```
Should we build or buy {capability}? It's {core/peripheral} to our
product. Build cost: ~{person_weeks}. Vendor options: {vendors_and_pricing}.
```

---

### Template [11]: Framework Comparison

**Questions to ask:**
```
1. What two (or three) options are you comparing?
2. Use case? (web frontend, mobile, backend, CLI, etc.)
3. Key decision criteria for your team? (performance, ecosystem, DX, hiring)
4. Team's existing experience with each?
```

**Topic template:**
```
Should we use {framework_a} or {framework_b} for {use_case}?
Key criteria: {criteria}. Team experience: {experience}.
```

---

### Template [12]: CI/CD Platform Choice

**Questions to ask:**
```
1. Current pain with existing CI/CD (if any)?
2. Platforms being considered?
3. Monorepo or multi-repo? (affects caching and trigger strategies)
4. Key requirements? (speed, cost, self-hosted vs cloud, GitHub integration)
```

**Topic template:**
```
Should we use {platform_a} or {platform_b} for CI/CD?
{repo_structure}. Key needs: {requirements}. Current pain: {pain_points}.
```

---

## STEP 3: Launch the Deliberation

Once you have the user's answers, construct the final focused topic string
from the relevant template above.

Invoke the `/deliberate` skill directly with the constructed topic string.
Templates always produce a specific enough topic — skip the vagueness check
and proceed straight to Phase 1 step 3 (project context injection).
