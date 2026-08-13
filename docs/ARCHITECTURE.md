# Architecture

Agent Workspace OS combines a local-first desktop assistant model with a capability-secured cloud app runtime. The MVP is intentionally a frontend reference implementation: the policy engine and runtime interfaces are real, while external model calls, credential brokering, process isolation, and durable collaboration are represented by safe in-browser simulations.

The optional Enterprise Gateway adds a real server-side trust boundary for signed identity assertions, RBAC, tenant/group-scoped knowledge lookup, and run preflight. It does not yet turn the simulated runner into a production executor.

## Core model

```text
Workspace
 ├── Agent App
 │    ├── prompt
 │    ├── runtime: local | cloud
 │    └── capabilities[]
 ├── Run
 │    ├── optional workflow match
 │    └── optional approval checkpoint
 ├── Workflow Memory
 │    ├── fingerprint + reusable steps
 │    └── outcome + reuse counters
 └── Audit Event
```

An Agent App is the reusable unit. A conversation may produce an app, but execution always happens from an explicit manifest. Every capability names its resource, scope, mode, risk level, and approval policy.

## Workflow templates and run trace

Templates package a repeatable goal, expected output, workflow steps, runtime, and Capability IDs. Creating from a template produces a normal `AgentApp`; it does not create a privileged execution path. All bundled templates pass the same policy validation as custom apps.

Every new run exposes five domain phases: Recall, Policy, Gate, Execute, and Reflect. This trace is product state rather than decorative UI: approval denial marks downstream phases blocked, while successful completion closes the phases before writing workflow memory. The separation makes failure location and responsibility visible to users and auditors.

Apps may request multiple protected Capabilities. The run stores pending and approved Capability IDs and advances them sequentially; approving local file access does not implicitly approve a later GitHub write. Completion and reflection occur only after the final protected Capability is approved.

Workflow edits create immutable version snapshots of the goal, runtime, schedule, steps, and Capability IDs. Restoring a snapshot creates another version instead of mutating history, so every run remains explainable against the configuration that produced it.

Before entering a runtime, preflight performs the same fail-closed compatibility check and previews the exact workflow version, plan completeness, protected Capability count, and memory boundary. An incompatible runtime/resource combination is blocked before any memory lookup or execution begins.

## Workflow memory plane

Repeated work follows a recall–rank–gate–reflect loop:

```text
Agent App
   │
   ├─ Recall: Letta semantic search or local candidate scan
   ├─ Rank: goal tokens + runtime + Capability + workflow fingerprint
   ├─ Gate: current request is re-authorized by AWOS
   └─ Reflect: successful steps and outcome are merged into memory
```

`WorkflowMemoryProvider` separates memory from the run engine. `LocalWorkflowMemoryProvider` is the always-available fallback. `LettaWorkflowMemoryProvider` calls a trusted Node bridge, which stores typed `[AWOS_WORKFLOW_V1]` envelopes in an Agent's archival-memory Passages. The bridge keeps `LETTA_API_KEY` server-side and uses Letta semantic search to retrieve candidates.

Letta does not become the authorization or execution plane. Memory can propose context and reusable steps, but every Capability is checked again for the current run. This prevents a previously successful write operation from silently becoming permanently authorized.

## Execution planes

### Local Runner

For private context and explicitly-bound workspace resources. A production implementation should run commands in a constrained child process or VM, enforce canonical filesystem roots, filter the environment, and require approval outside the worker process.

### Cloud Sandbox

For generated apps, shared workflows, and schedules. A production implementation should provide per-run isolation, deny outbound networking by default, and route network or SaaS access through Gatekeeper.

Both runtimes implement the same `AgentRuntime` interface. This keeps the app and policy layer portable across local process sandboxes, Cloudflare Workers, containers, or Kubernetes jobs.

## Trust boundaries

```text
User / Organization policy
           |
      Gatekeeper
       /       \
 Local Runner  Cloud Sandbox
       \       /
       MCP / External resources

Letta Memory (context only) ---> Run Orchestrator
```

- Prompts and generated code are untrusted.
- Credentials never enter prompts or app manifests.
- An app cannot lower its own policy.
- L3 writes require per-operation approval.
- L4 destructive or production actions require two-person approval.
- Local filesystem capability is invalid in the cloud runtime.
- Every policy decision produces an append-only audit event.
- A memory match never carries approval forward from a previous run.

## Enterprise control plane

The browser may use `VITE_ENTERPRISE_API_URL`, but it never receives enterprise search credentials or the identity signing secret. In proxy mode an upstream SSO/IAP injects a short-lived identity assertion. The gateway verifies its HMAC signature, time window, tenant, roles, and groups before serving status, knowledge search, or server-side run preflight.

The knowledge adapter forwards only `query`, `limit`, `tenantId`, and authorized groups to an existing internal search/RAG endpoint. The downstream knowledge system must still apply its native document ACLs; AWOS group filtering is an additional enforcement layer, not a replacement.

Letta passages are tagged with `tenant:<id>`. Semantic search requires that tag, list results are filtered by it, and deletion verifies ownership before calling Letta. Production deployments should provision separate Agents or Archives per tenant as the primary isolation boundary.

## Letta boundary

The browser calls only `VITE_MEMORY_API_URL`. The bridge reads `LETTA_AGENT_ID`, `LETTA_API_KEY`, or `LETTA_BASE_URL` and exposes four narrow operations: status, list/search Passages, create Passage, and delete Passage. If the bridge or Letta is unavailable, reads and writes fall back to the local mirror so the workspace remains usable.

For production, the bridge should add authenticated workspace identity, tenant-scoped agent/archive mapping, rate limits, structured logging, and durable sync reconciliation. A per-user or per-workspace namespace is required to avoid cross-tenant recall.

## Production roadmap

1. Add a server-side policy decision point and signed capability grants.
2. Implement OAuth credential brokering with encrypted token storage.
3. Implement an isolated local runner and a deny-by-default cloud worker runtime.
4. Add OIDC, organizations, RBAC, and two-person approval workflows.
5. Add Postgres event storage and Letta workspace/agent provisioning with tenant isolation.
6. Add MCP registry signing, provenance checks, and granular tool schemas.
7. Add memory quality evaluation, expiry, contradiction handling, and promotion from observations to stable workflows.
8. Add model gateway adapters and organization-level routing policies.
