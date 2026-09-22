---
name: tencentdb-agent-memory
description: Deploy, verify, operate, and troubleshoot the TencentDB-Agent-Memory (TDAI) self-hosted stack — the memory-core / memory-hub / proxy trio launched by `deploy/global-images/start-all.sh`. Use this whenever someone wants to stand up agent memory locally, mentions TencentDB-Agent-Memory, TDAI, `agentmemory/*` Docker images, `start-all.sh`, `verify.sh`, the Memory Panel on port 8125, or containers named `tdai-memory-core` / `tdai-memory-hub` / `tdai-proxy`. Also use it when they want to point Claude Code, CodeBuddy, or any OpenAI/Anthropic-compatible client at a local memory proxy so their agent remembers across sessions, when a TDAI container is unhealthy or stuck, when the LLM connectivity precheck fails with 401/404, or when they need to stop, reset, or wipe the stack.
---

# TencentDB-Agent-Memory: local stack deployment

## What this stack is

TencentDB-Agent-Memory (TDAI) gives coding agents persistent memory. Three
containers, each independently runnable, all published publicly on Docker Hub
under the `agentmemory` namespace (multi-arch amd64 + arm64, no login needed):

| Component | Container | Image | Host port | Role |
|---|---|---|---|---|
| memory-core | `tdai-memory-core` | `agentmemory/memory-core` | 8420 | Kernel gateway: memory read/write, auth, skill/RAG data plane |
| memory-hub | `tdai-memory-hub` | `agentmemory/memory-hub` | 8125 (Panel), 8424 (Knowledge) | Admin panel + knowledge service, one combined image |
| proxy | `tdai-proxy` | `agentmemory/memory-proxy` | 8096 | LLM forwarding proxy — the API endpoint your coding agent points at |

The proxy is the whole point of the integration story: you change nothing in the
agent except its base URL, and the proxy injects memory context into requests on
the way through. No plugin, no hook, no MCP server.

## The two LLM credential groups

This is the part people get wrong, so settle it before touching anything else.
The stack needs **two independent sets of LLM credentials**, and they may point
at completely different providers:

- **memory group** (`MEMORY_LLM_*`) — used by memory-core and memory-hub for
  embedding, summarization, and wiki ingest. Often a cheap model.
- **proxy group** (`PROXY_UPSTREAM_*`) — where the proxy forwards the user's
  actual agent traffic. Often the strong model they code with.

They can be identical; the interactive setup offers "reuse the memory group" as a
default. When someone hasn't said which they want, ask — guessing wrong means
either burning premium tokens on embeddings or doing their real work on a weak
model.

## Deploying

### Step 1 — check the ground before you dig

Run these first; each failure here costs a lot more time if discovered mid-boot:

```bash
docker info >/dev/null 2>&1 || echo "Docker daemon not reachable"
for p in 8420 8125 8424 8096; do
  (command -v lsof >/dev/null && lsof -nP -iTCP:$p -sTCP:LISTEN) \
    || (command -v ss >/dev/null && ss -ltn "sport = :$p" | tail -n +2)
done
```

macOS/Linux with Docker (Desktop, colima, or OrbStack) and bash are the only
requirements — macOS's stock bash 3.2 is fine. Any of those four ports occupied
means either free it or override the port in `.env` (see
`references/configuration.md`).

### Step 2 — fetch the scripts

```bash
git clone https://github.com/TencentCloud/TencentDB-Agent-Memory.git
cd TencentDB-Agent-Memory/deploy/global-images
```

(`github.com/Tencent/TencentDB-Agent-Memory` is the same project under the other
org name; either clone URL works.)

### Step 3 — boot

`start-all.sh` is interactive. It copies `.env.example` → `.env` if needed, walks
through both LLM groups (empty input keeps the current value), **checks each
group's connectivity before starting anything**, writes the answers back to
`.env`, prechecks ports, then brings up memory-core → memory-hub → proxy in
order, waiting for each to report healthy.

```bash
./start-all.sh          # interactive
PULL=1 ./start-all.sh   # pull the three images first (upgrade to latest)
```

**Who types the API keys matters.** If a human is at the terminal, hand them the
command and let them run it — API keys typed into an interactive prompt never
land in your transcript or in shell history. Only fill credentials in yourself
when the user has explicitly given them to you or pointed you at where they live.

**Running it unattended.** The prompts read from stdin and fall back to the
current `.env` value on empty input or EOF, so a fully pre-filled `.env` boots
without any typing:

```bash
cp .env.example .env
# set MEMORY_LLM_BASE_URL / _API_KEY / _MODEL and PROXY_UPSTREAM_URL / _API_KEY / _MODEL
./start-all.sh < /dev/null
```

Prefer writing those values with a script or editor over echoing them into the
terminal — a key pasted into a shell command ends up in history and in logs.

Expect a couple of minutes on a cold run: the images have to be pulled. If it
seems to hang at "waiting for healthy", that's usually still the pull —
`docker pull agentmemory/memory-core:latest` (and the other two) up front makes
the wait visible instead of mysterious.

### Step 4 — confirm and report back

On success the script prints the endpoint table and, if the admin user was
initialized, a ready-to-paste Claude Code block. Report these to the user:

- Panel UI — <http://localhost:8125/>
- Knowledge API — <http://localhost:8424/v3/>, Swagger at `/docs`
- Memory gateway — <http://localhost:8420/>
- Proxy — <http://localhost:8096/>

The generated admin `user_key` is persisted at `deploy/global-images/.admin-key`.
It is a real credential: tell the user where it is rather than pasting its value,
and never commit it.

`./verify.sh` is a dry run — environment, `.env` completeness, images, ports, and
both LLM paths, with no containers started. Use `./verify.sh --skip-llm` offline.
The OpenAI-protocol check is a `GET {base}/models` and costs no tokens; the
Anthropic check sends a `max_tokens=1` message (≤10 tokens).

## Wiring a coding agent through the proxy

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8096/claude-code/default
export ANTHROPIC_AUTH_TOKEN="$(cat deploy/global-images/.admin-key)"
claude --model <your PROXY_UPSTREAM_MODEL>
```

OpenAI-protocol clients use `OPENAI_BASE_URL=http://localhost:8096/v1`. For
sharing with teammates on the LAN, the Panel's "client endpoint" card advertises
the host's detected LAN IP; override it with `MEMORY_HUB_PROXY_PUBLIC_URL` when
the detection guesses wrong (multiple NICs, a reverse proxy, a public domain).

## Operating

```bash
docker logs -f tdai-memory-core     # or tdai-memory-hub / tdai-proxy
./stop-all.sh                       # stop containers, keep data volumes
./stop-all.sh --purge               # also delete volumes, network, .admin-key
```

Data lives in the named volumes `tdai-memory-core-data` and `tdai-panel-data` and
survives ordinary restarts. `--purge` is destructive and unrecoverable —
memories, ingested wikis, and the admin key all go. Confirm with the user before
running it, and reach for plain `stop-all.sh` when they just want the ports back.

Inside memory-hub two processes run side by side; their logs are at
`/data/knowledge/logs/panel.log` and `.../knowledge.log` in the container.

## When something fails

The failure modes are nearly all configuration, not bugs. Read the error before
reaching for a restart — these scripts fail loudly and specifically on purpose.

| Symptom | Cause and fix |
|---|---|
| `API key 无效（HTTP 401）` during the precheck | Wrong key or wrong base URL for that group. The message names which group (memory vs proxy) — fix that one. |
| 404 on the precheck | Base URL shape. It wants the OpenAI-compatible base (e.g. `https://api.deepseek.com/v1`), not a `/chat/completions` endpoint. |
| Host reaches the LLM but the container doesn't | Corporate proxy or split DNS. `verify.sh` exec's a curl inside running containers to catch exactly this. |
| Hangs at `wait_healthy` | Image still pulling. Pre-pull, then rerun. |
| Panel loads but errors out | `KNOWLEDGE_PUBLIC_BASE_URL` is missing its `/v3` suffix. |
| Proxy returns 401 | Bad `PROXY_UPSTREAM_API_KEY` / mismatched `PROXY_UPSTREAM_URL`. `docker logs tdai-proxy`. |
| Admin key rejected after a purge | `.admin-key` outlived its volume. Delete the file and restart memory-core so it re-initializes. |
| Port conflict | Free the port, or override it in `.env` — and move `KNOWLEDGE_PUBLIC_BASE_URL` along with `KNOWLEDGE_PORT`. |

Anything about credentials to change, individual component scripts, port
overrides, or dependency order between the three services is in
`references/configuration.md`. Read it before editing `.env` by hand.

## Security worth flagging unprompted

Three internal credentials ship with convenience defaults so a laptop demo works
with zero setup: `MEMORY_CORE_GATEWAY_API_KEY=local`, and `admin`/`admin` for the
initial `system_admin` account. The startup script warns about them, and the
warning is easy to scroll past.

They are fine on a laptop that binds only to localhost. They are not fine the
moment these ports are reachable by anyone else — whoever finds port 8420 gets
`system_admin`. If the user is deploying anywhere shared, staging, or
internet-facing, say so and have them set long random values in `.env` before the
first boot. Also keep `.env` and `.admin-key` out of version control; both hold
live secrets.
