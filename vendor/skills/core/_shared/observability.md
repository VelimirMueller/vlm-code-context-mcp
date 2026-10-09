# Observability

OpenTelemetry is the one seam. Code emits OTel traces, metrics and logs; the backend is an exporter setting. Swapping SigNoz for Grafana or adding Sentry changes environment variables, not application code.
Companion: [logging-contract.md](logging-contract.md). Status checked 2026-10-09: traces and metrics are stable in the JS SDK, logs are Development there (opentelemetry.io/docs/languages/js); semantic conventions release v1.44.0; collector-releases v0.162.0; `@opentelemetry/api` 1.9.1, `@opentelemetry/sdk-node` 0.223.0 (the experimental SDK packages version as 0.x; re-verify per [version-protocol.md](version-protocol.md)).

## Rule: One seam — the OTel SDK, configured by environment
**Why:** Vendor SDKs in application code lock you in and fragment trace context. OTLP is accepted by every backend named below.
**How to apply:** One bootstrap module per process (`src/instrumentation.ts`, `internal/telemetry`, `app/telemetry.py`, `src/telemetry.rs`) starts the SDK **before** the app code loads. Configure only through the standard variables: `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`. Business code uses the API only (`@opentelemetry/api`, `go.opentelemetry.io/otel`, `opentelemetry-api`, `tracing`).
**When to deviate:** A platform with its own agent and no OTLP (some serverless vendors): use the vendor agent at the edge and keep the API calls in code.

## Rule: Resource attributes identify every signal
**Why:** Without `service.name`, a trace belongs to `unknown_service`. Without an environment, staging noise pages production.
**How to apply:** Set on every signal:

| Attribute | Value | Note |
|---|---|---|
| `service.name` | stable lowercase kebab name | required; one per deployable |
| `service.version` | git tag or short SHA | lets you tie a regression to a release |
| `service.instance.id` | generated per process | the SDK or platform detector sets it |
| `deployment.environment.name` | `development` / `staging` / `production` | replaces deprecated `deployment.environment` |
| `service.namespace` | team or product | optional |
| `cloud.*`, `host.*`, `k8s.*`, `container.*` | from resource detectors | enable detectors, do not hand-set |

**When to deviate:** None for the first four.

## Rule: Auto-instrument first, add spans at business boundaries
**Why:** Auto-instrumentation covers HTTP, DB and queue calls for free. Hand-written spans on every function are noise.
**How to apply:** Enable the language's HTTP server/client, DB driver and framework instrumentations. Add manual spans only around a business operation (`checkout.place_order`) and put identifiers in attributes, not names. Record errors with `span.recordException` / `SetStatus(Error)` once, at the boundary. Never put secrets or personal data in span attributes.
**When to deviate:** Hot loops: do not span them; use a metric.

## Rule: Head-sample in the SDK, tail-sample in the collector
**Why:** Keeping every trace is costly; dropping at random loses the failures you need.
**How to apply:**

- Default SDK sampler: `parentbased_traceidratio`. Set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=1.0` in dev and staging, `0.1` in production at low volume, lower when volume grows. `parentbased` keeps whole traces consistent across services.
- When running a collector, use the `tail_sampling` processor (keep all errors, all slow traces above the SLO threshold, and a percentage of the rest).
- Metrics are never sampled.
**When to deviate:** Very low traffic (under about 1 request per second): sample 100%.

## Rule: Measure with RED for services, USE for resources
**Why:** Two small sets cover most incidents. RED answers "are users hurting?"; USE answers "why?".
**How to apply:**

- **RED** per endpoint or operation: **R**ate (requests/s), **E**rrors (failed/s or ratio), **D**uration (histogram, p50/p95/p99). The OTel HTTP instrumentation emits `http.server.request.duration`; derive rate and errors from it.
- **USE** per resource (CPU, memory, disk, connection pool, queue): **U**tilisation, **S**aturation, **E**rrors. Pool wait time and queue depth are the saturation signals.
- Keep attribute cardinality bounded: route templates (`/users/:id`), never raw paths, user ids or request ids as metric attributes.
**When to deviate:** Batch and stream jobs: use throughput, lag, and oldest-message age instead of request RED.

## Rule: SLOs and alerts on symptoms
**Why:** A CPU alert wakes someone without telling them whether users are affected. A symptom alert (errors, latency) maps to user harm; causes go on dashboards.
**How to apply:** Define 1–3 SLOs per user-facing service: availability (non-5xx ratio) and latency (share of requests under a threshold), over a 28-day window. Alert on **error-budget burn rate** with two windows (fast burn: 14.4x over 1 h, slow burn: 6x over 6 h, the Google SRE workbook defaults). Every alert links a runbook and a dashboard. Page for burn, ticket for slow trends, no alert without an action.
**When to deviate:** Early-stage product with no traffic baseline: alert on "any 5xx in production" and a heartbeat until you have data.

## Backends are exporters only

| Backend | Use for | Wiring | Choose when |
|---|---|---|---|
| **SigNoz** | traces, metrics, logs in one OTel-native UI | OTLP to SigNoz Cloud or self-hosted collector | default for a product team that wants one tool |
| **grafana/otel-lgtm** | local and small-team stack (Loki, Grafana, Tempo, Mimir with an OTel collector in one container) | OTLP to the container, port 4317 gRPC / 4318 HTTP | local development; a quick shared environment |
| **Sentry** | error grouping, release health, source-mapped frontend errors | Sentry SDK in the browser; Sentry can ingest OTLP in some setups, verify current docs | frontend errors and alerting on exceptions; complements, does not replace, OTel |

The profile key `observability.backend` records the choice. Skills read it to generate the exporter env example only.

## Local development

Run `grafana/otel-lgtm` (or a SigNoz dev stack) and point `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` with `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`. Verify the image tag live before pinning it.

## Verify

1. Start the service; make one request.
2. The backend shows a trace with the expected `service.name` and `deployment.environment.name`.
3. A log line from that request carries the same `trace_id`.
4. A forced error shows as an error span and a `warn`/`error` log with the same `trace_id`.

## When to deviate

- Static sites and one-off scripts: skip tracing; keep error tracking.
- Edge runtimes (Workers, Vercel Edge) where the Node SDK does not run: use the platform's OTel integration and verify what it supports.
- Cost limits: lower the trace sampling ratio before dropping signals.
