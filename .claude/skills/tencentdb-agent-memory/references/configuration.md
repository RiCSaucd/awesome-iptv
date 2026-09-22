# TDAI global-images configuration reference

Everything here lives in `deploy/global-images/`. `.env` is created from
`.env.example` on the first `start-all.sh` run; `_lib.sh` holds the shared
helpers (`require_vars`, `check_ports`, `wait_healthy`, `interactive_llm_setup`,
the LLM prechecks).

## Contents

- [Required variables](#required-variables)
- [Images and ports](#images-and-ports)
- [Internal credentials](#internal-credentials)
- [Volumes and persisted state](#volumes-and-persisted-state)
- [Running components individually](#running-components-individually)
- [Proxy behavior](#proxy-behavior)
- [LLM connectivity precheck details](#llm-connectivity-precheck-details)

## Required variables

`start-all.sh` validates all of these up front in one pass and exits before
starting anything if any are missing — so a missing proxy variable is caught
before memory-core boots, not after.

### memory group — used by memory-core and memory-hub

| Variable | Meaning | Example |
|---|---|---|
| `MEMORY_LLM_BASE_URL` | OpenAI-compatible base URL | `https://api.deepseek.com/v1` |
| `MEMORY_LLM_API_KEY` | API key for that endpoint | `sk-…` |
| `MEMORY_LLM_MODEL` | Model id | `deepseek-chat` |
| `MEMORY_LLM_PROTOCOL` | `openai` or `anthropic` (default `openai`) | `openai` |

### proxy group — used by the proxy

| Variable | Meaning | Example |
|---|---|---|
| `PROXY_UPSTREAM_URL` | Forwarding target base URL | `https://api.deepseek.com/v1` |
| `PROXY_UPSTREAM_API_KEY` | Key for the forwarding target | `sk-…` |
| `PROXY_UPSTREAM_MODEL` | Model id exposed to clients | `deepseek-chat` |

The two groups are deliberately independent. A common split is a cheap model for
memory embedding/summarization and a strong one for the proxied coding session.

## Images and ports

```
MEMORY_CORE_IMAGE=agentmemory/memory-core:latest
MEMORY_HUB_IMAGE=agentmemory/memory-hub:latest
PROXY_IMAGE=agentmemory/memory-proxy:latest

MEMORY_CORE_PORT=8420
PANEL_PORT=8125
KNOWLEDGE_PORT=8424
PROXY_PORT=8096
KNOWLEDGE_PUBLIC_BASE_URL=http://host.docker.internal:8424/v3
```

Pin a release instead of `latest` by swapping the tag (e.g.
`agentmemory/memory-core:1.0.0-beta.1`) — worth doing for anything a team
depends on, since `latest` moves under you.

Changing ports: `KNOWLEDGE_PUBLIC_BASE_URL` must track `KNOWLEDGE_PORT`, and it
must keep the `/v3` suffix or the Panel errors out.

```
MEMORY_CORE_PORT=18420
PANEL_PORT=18125
KNOWLEDGE_PORT=18424
PROXY_PORT=18096
KNOWLEDGE_PUBLIC_BASE_URL=http://host.docker.internal:18424/v3
```

All containers get `--add-host=host.docker.internal:host-gateway`, so reaching
other services on the host (Ollama, Langfuse, a local vLLM) is just
`http://host.docker.internal:<port>` from inside a container.

`MEMORY_HUB_PROXY_PUBLIC_URL` controls the endpoint the Panel advertises to
teammates. Unset, the script probes the LAN IP (`hostname -I`, or
`ipconfig getifaddr en0` on macOS) and falls back to `localhost`. Set it
explicitly behind a reverse proxy or with multiple NICs; set it to the empty
string to fall back to the gateway endpoint instead. It does not affect
Panel → kernel forwarding, which always uses `REMOTE_INSTANCE_URL`.

## Internal credentials

The three components authenticate to each other with
`MEMORY_CORE_GATEWAY_API_KEY`, and the first boot creates a `system_admin`
account via `init-admin`.

| Variable | Default | Purpose |
|---|---|---|
| `MEMORY_CORE_GATEWAY_API_KEY` | `local` | Bearer for memory-hub / proxy → memory-core |
| `MEMORY_CORE_ADMIN_USERNAME` | `admin` | Initial `system_admin` username |
| `MEMORY_CORE_ADMIN_USER_KEY` | `admin` | That account's login key |

These have fallback defaults so `require_vars` won't stop a first-time local run;
the script only emits a `[warn]`. Anyone who can reach the ports with these
defaults has `system_admin`. Override all three with long random values in `.env`
before any deployment that isn't a localhost-only laptop.

The admin `user_key` actually used at runtime is generated randomly on first
`init-admin` and written to `deploy/global-images/.admin-key`
(`MEMORY_CORE_ADMIN_KEY_FILE` relocates it). It is bound to the memory-core
volume: if the volume is wiped but the file survives, auth fails against the
fresh volume. `stop-all.sh --purge` deletes both together for exactly this
reason. Re-running `start-memory-core.sh` reuses an existing `.admin-key` rather
than rotating it.

## Volumes and persisted state

| Volume | Default name | Contents |
|---|---|---|
| `MEMORY_CORE_VOLUME` | `tdai-memory-core-data` | memory-core SQLite + memory data |
| `PANEL_VOLUME` | `tdai-panel-data` | knowledge SQLite, git clones, wiki files |

Also on the host side: `.admin-key`, `.proxy-config/`, `.memory-core-config/`.
All are removed by `--purge`. Docker network: `tdai-memory-stack`.

## Running components individually

```bash
./start-memory-core.sh   # kernel gateway only (8420)
./start-memory-hub.sh    # panel + knowledge (8125 + 8424); needs MEMORY_LLM_*
./start-proxy.sh         # proxy only (8096); needs PROXY_UPSTREAM_*
```

Dependency order and what degrades when something is missing:

- **memory-core** — no external dependencies, always safe to start alone.
- **memory-hub** — starts standalone (`LLM_MODE=custom`, talking to the LLM
  directly), but its knowledge service calls memory-core for RAG, so those calls
  fail without it. Start memory-core first.
- **proxy** — starts standalone and silently degrades to passthrough forwarding
  when cost-guard is unavailable; auth, TDAI memory injection, and skill
  injection all need memory-core to do anything.

Missing dependencies produce warnings, not hard failures. That is convenient for
debugging and misleading if you forget it — a "working" proxy with no memory-core
is just a plain forwarder, and memory silently does nothing.

Each start script removes and recreates its container on re-run; volumes (and
therefore data and the admin key) survive.

## Proxy behavior

`start-all.sh` runs the proxy with `PROXY_FULL_STACK=1`, enabling auth +
session-init + TDAI context injection. `PROXY_FULL_STACK=0` reverts to bare
forwarding, and the three switches can also be overridden individually in `.env`.
Called directly, `start-proxy.sh` defaults to the lighter pipeline: pure
forwarding plus the `tdai-memory` injector (an injector name, not a container).
The full pipeline configuration lives in `context_proxy/config.example.yaml`
upstream.

## LLM connectivity precheck details

Run inside `interactive_llm_setup` (on every `start-all.sh`) and by `verify.sh`:

- **openai protocol** — `GET {base}/models`. Validates key and URL, consumes no
  tokens. The base URL is normalized: trailing `/`, `/messages`, and
  `/chat/completions` are stripped. If the model id appears in the response it is
  confirmed; a missing id is only a warning, since plenty of gateways don't list
  every model.
- **anthropic protocol** — `POST {base}/v1/messages` with `max_tokens=1`,
  costing ≤10 tokens.
- Both groups are checked independently; identical configs skip the duplicate.
- When containers are already running, an extra `docker exec` curl runs from
  inside them, which is what catches "the host can reach the LLM but the
  container can't" (corporate proxies, split DNS).

`./verify.sh --skip-llm` skips all of it for offline or no-outbound-request runs.
`verify.sh` exits non-zero on errors, zero when only warnings were raised.
