# Security model

This repository is an MVP and reference architecture, not a production security boundary. The browser demo does not execute shell commands, hold OAuth tokens, or call external services.

## Enterprise identity and tenancy

The Enterprise Gateway supports a demo identity only for local evaluation. Production mode requires a trusted identity-aware proxy and a short-lived signed assertion. The gateway verifies signature, expiry, tenant, roles, and groups on every request. The signing secret and enterprise connector tokens are server-only variables and must never use a `VITE_` prefix.

Knowledge access is deny-by-default across tenants and user groups. The gateway sends tenant and group context to the enterprise knowledge adapter and removes ACL metadata from responses. The downstream source remains responsible for native document permissions.

Letta workflow passages use a tenant tag for search, list, create, and delete. This is suitable for the reference implementation; production should also use a distinct Agent or Archive per tenant.

## Invariants

- Deny capabilities that do not match the selected runtime.
- Treat all generated code and model output as untrusted input.
- Keep credentials in Gatekeeper, outside the model and generated app.
- Bind filesystem grants to canonical workspace roots.
- Require explicit approval for writes and stronger approval for destructive actions.
- Record allow, block, approve, and deny decisions.

## Before production use

- Move policy evaluation and audit storage to trusted server-side processes.
- Sign grants and use short-lived, audience-bound credentials.
- Isolate local execution with OS sandboxing or VMs.
- Disable direct outbound network access from generated-code workers.
- Add CSRF, CSP, origin validation, rate limiting, and secret scanning.
- Add threat modeling, dependency review, external penetration testing, and incident response procedures.

## Letta memory boundary

- `LETTA_API_KEY` is read only by the Node Memory Bridge and must never use a `VITE_*` name.
- The browser can call only the narrow memory bridge API; it cannot call Letta Cloud with a long-lived key.
- Workflow memories are untrusted context. A retrieved memory never grants a Capability or carries a previous approval forward.
- Every recalled workflow is revalidated against the current runtime, resource scope, risk, and approval policy.
- Production deployments must map Letta agents or archives to authenticated workspace/tenant identities and prevent cross-tenant retrieval.
- Memory deletion and retention need durable reconciliation; the MVP provides immediate local deletion and best-effort Passage deletion.

Report vulnerabilities privately through GitHub Security Advisories after the repository is published.
