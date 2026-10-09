# Logging Contract

One log shape across TypeScript, Go, Python and Rust, so one query works in any backend and logs join traces.
Field names follow OpenTelemetry where OTel defines one. The OTel Logs signal is stable in the specification, but **Development** in the JavaScript SDK as of 2026-10-09 (per opentelemetry.io/docs/languages/js, checked that day). So the contract is built on JSON to stdout first; shipping to OTLP is an addition, not a dependency.

## Rule: Structured JSON, one object per line, to stdout
**Why:** The platform (container runtime, Vercel, systemd) already collects stdout. JSON lines parse without regexes and cost nothing to add. A log file written by the app is a second thing to rotate and ship.
**How to apply:** Production: JSON. Development: a pretty printer on the same fields (`pino-pretty`, `slog` text handler, `structlog` console renderer, `tracing-subscriber` fmt). Never `console.log` / `print` / `println!` in application code.
**When to deviate:** CLIs that print for humans: logs go to stderr, human output to stdout. Use the same field names when `--log-format json` is on.

## Rule: Fixed field names
**Why:** Dashboards and alerts break when `msg`, `message` and `text` all exist. Fixed names make logs queryable across services.
**How to apply:**

| Field | Type | Meaning | OTel mapping |
|---|---|---|---|
| `timestamp` | RFC 3339 UTC string with ms | event time | LogRecord `Timestamp` |
| `level` | `debug` `info` `warn` `error` `fatal` (lowercase) | severity | `SeverityText` |
| `message` | string, constant per event, no interpolated variables | what happened | LogRecord `Body` |
| `service.name` | string | emitting service | resource `service.name` |
| `deployment.environment.name` | `development`, `staging`, `production` | environment | resource attribute of the same name (replaces the deprecated `deployment.environment`) |
| `trace_id` | 32 hex chars | active trace | LogRecord `TraceId` |
| `span_id` | 16 hex chars | active span | LogRecord `SpanId` |
| `event` | dotted lowercase string, e.g. `order.created` | stable machine key for the event | custom attribute |
| `error.type` | string | exception class or error code | OTel `error.type` |
| `exception.type` / `exception.message` / `exception.stacktrace` | strings | recorded error | OTel exception attributes (stable in the logs convention) |
| `http.request.method`, `http.response.status_code`, `url.path` | | request context | OTel HTTP conventions |
| `user.id` | opaque id | actor, never email or name | OTel `user.id` |
| other domain data | flat `snake_case` keys under their own names | `order_id`, `duration_ms` | custom |

Rules for the names: dotted OTel names stay dotted (nested objects are a second shape). Resource fields (`service.name`, `deployment.environment.name`) are set once in logger config, not per call. Re-verify names against the current semantic-conventions release (v1.44.0 verified 2026-10-09 via GitHub releases) before adding new ones.
**When to deviate:** A backend that forces other names (a legacy aggregator): map at the exporter, never in application code.

## Rule: Levels have a policy
**Why:** If everything is `error`, nothing pages. Levels are an alerting contract.
**How to apply:**

| Level | Use | Alerts? |
|---|---|---|
| `fatal` | the process cannot continue; logged then exit | page |
| `error` | an operation failed and a human may need to act; the error is not handled | alert on rate |
| `warn` | handled or recoverable, but unexpected (retry used, fallback taken, deprecated call) | review in aggregate |
| `info` | business or lifecycle event worth seeing in production (startup, order created, job finished) | no |
| `debug` | diagnosis detail; off in production by default, switchable at runtime | no |

An expected client error (400, 404, validation failure) is `info` or `warn` on the server, never `error`. Log each error **once**, at the boundary that handles it; rethrow without logging in between.
**When to deviate:** Security events (auth failures, access denied) are always logged at `warn` or above regardless of "expected".

## Rule: Correlate with trace_id and span_id
**Why:** The link from a log line to its trace turns a search into a walk. Without it, you grep by timestamp and guess.
**How to apply:** The logger adds `trace_id` and `span_id` from the active span automatically (language table below). Never pass them by hand. Propagate incoming W3C `traceparent` headers; return the trace id in error responses so a user can quote it. Background jobs start a new trace and link to the enqueuer's span.
**When to deviate:** None. If OTel is off (`observability.otel: false`), generate a request id and log it as `request_id`.

## Rule: Redact by default, log nothing you would not publish
**Why:** Logs outlive access reviews. A token in a log is a leaked token. (see [security-baseline.md](security-baseline.md) rule 11)
**How to apply:** Configure the logger's redaction list once at the seam: `authorization`, `cookie`, `set-cookie`, `password`, `token`, `secret`, `api_key`, `*.access_token`, `*.refresh_token`, `card.*`, `email`, `phone`, `ip` (when personal). Log ids, not bodies. Never log: credentials, tokens, session ids, full request or response bodies, payment data, health or biometric data, full personal records, `process.env`. When you must correlate on a person, log the opaque `user.id`.
**Anti-example:** `logger.info({ req }, 'incoming')` — dumps headers and cookies.
**When to deviate:** A debug session on a non-production system with synthetic data, behind a flag that defaults off and is not shippable to production.

## Rule: One logger seam per process
**Why:** (see [engineering-principles.md](engineering-principles.md): one seam per vendor.) Swapping the logger, adding redaction or changing the output format is a one-file change.
**How to apply:** One module builds the logger — in a service the `platform` seam per [service-layout.md](../../backend/_shared/service-layout.md) (`src/platform/logger.ts`, `internal/platform/logging/logging.go`, `src/<pkg>/platform/logging.py`), in a frontend `src/libs/logger.ts`, in Rust `src/telemetry.rs`; code imports `logger` or takes a child logger with bound context (`logger.child({ module: 'billing' })`).

## Per-language default

Verified 2026-10-09 against the registries; re-verify per [version-protocol.md](version-protocol.md).

| Language | Default | How trace ids get in | Notes |
|---|---|---|---|
| TypeScript (Node) | **pino** (10.4.0) JSON to stdout | The logger seam adds `trace_id` and `span_id` from the active span with pino's `mixin` (see `set-up-observability`). `@opentelemetry/instrumentation-pino` does not patch an ESM `import pino` (verified 2026-10-09), so keep it disabled | OTel Logs for JS is Development stability; keep pino's stdout JSON as the source of truth and treat the OTLP log bridge as optional. Create the logger after the SDK starts. For `level`, use a `formatters.level` returning the label. |
| Go | **`log/slog`** (stdlib) with `JSONHandler` | `slog` + the `otelslog` bridge from `go.opentelemetry.io/contrib/bridges/otelslog`, or a handler wrapper that reads `trace.SpanContextFromContext(ctx)`; always use `slog.InfoContext(ctx, …)` | Rename `time`→`timestamp`, `msg`→`message` via `ReplaceAttr`. |
| Python | **structlog** (26.1.0) with `JSONRenderer`, on top of stdlib `logging` | OTel `opentelemetry-instrumentation-logging` adds trace fields to stdlib records; or a structlog processor reading the current span | If the project uses only stdlib, use `python-json-logger` style formatting: no second logger for one app. |
| Rust | **`tracing`** (0.1.x) + `tracing-subscriber` JSON layer | `tracing-opentelemetry` ties spans to OTel; JSON layer includes span fields | Use `#[instrument]` on boundaries; events are logs, spans are traces. |

Browser code: do not ship a logger. Errors go to the error tracker (Sentry via `captureError` seam in the frontend skills); product events to analytics.

## Minimal examples

The tested TypeScript logger is `createLogger` in the Hono scaffold ([hono-files.md](../../backend/scaffold-hono-service/hono-files.md)), plus the `mixin()` that `set-up-observability` adds ([otel-tracks.md](../../backend/set-up-observability/otel-tracks.md)). Its shape:

```ts
// src/platform/logger.ts (config injected, never read from process.env here)
import { trace } from '@opentelemetry/api';
import { type Logger, pino } from 'pino';

export function createLogger(config: { LOG_LEVEL: string; OTEL_SERVICE_NAME: string; DEPLOYMENT_ENVIRONMENT: string }): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { 'service.name': config.OTEL_SERVICE_NAME, 'deployment.environment.name': config.DEPLOYMENT_ENVIRONMENT },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    messageKey: 'message',
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.api_key'], censor: '[redacted]' },
    mixin() {
      const ctx = trace.getActiveSpan()?.spanContext();
      return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
    },
  });
}
```

```go
// internal/platform/logging/logging.go
package logging

import (
	"log/slog"
	"os"
	"strings"
)

func New(service, environment string, level slog.Level) *slog.Logger {
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			switch a.Key {
			case slog.TimeKey:
				a.Key = "timestamp"
			case slog.MessageKey:
				a.Key = "message"
			case slog.LevelKey:
				a.Value = slog.StringValue(strings.ToLower(a.Value.String()))
			}
			return a
		},
	})
	return slog.New(h).With("service.name", service, "deployment.environment.name", environment)
}
```

```python
# src/<pkg>/platform/logging.py
import logging
import structlog

def configure(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", level=level)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
            structlog.processors.EventRenamer("message"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level)),
    )
```

```rust
// src/telemetry.rs
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init() {
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(fmt::layer().json().with_current_span(true).with_span_list(false))
        .init();
}
```

The Python and Rust snippets show the shape; the exact processor and feature names are checked against structlog and `tracing-subscriber` docs in the stack skill that installs them, per [version-protocol.md](version-protocol.md).

## When to deviate

- A platform that ingests a fixed schema (Cloud Logging severity fields, Datadog reserved attributes): map at the exporter or the handler's `ReplaceAttr`.
- Very high-volume paths: sample `debug` and `info` at the logger; never sample `warn`+.
- Serverless with a vendor log drain: keep the contract, drop the pretty printer.
