# Multi-Tenant Deep Agents Node Demo

Runnable TypeScript demo for a multi-tenant Deep Agents setup. Each request passes a `userId`; the server uses that ID to build user-scoped `StoreBackend` namespaces while also mounting shared global memory and skills.

The important bit:

```ts
new CompositeBackend(new StateBackend(), {
  "/global/memories/": new ReadOnlyBackend(
    new StoreBackend({ namespace: ["global", "memories"] }),
    "Global memories",
  ),
  "/user/memories/": new StoreBackend({
    namespace: ["users", safeUserId, "memories"],
  }),
  "/global/skills/": new ReadOnlyBackend(
    new StoreBackend({ namespace: ["global", "skills"] }),
    "Global skills",
  ),
  "/user/skills/": new StoreBackend({
    namespace: ["users", safeUserId, "skills"],
  }),
});
```

Everything outside the routed global/user paths stays ephemeral in `StateBackend`. Global memory and skills are readable by every tenant but write-protected in the backend. User memory and skills persist in Postgres under per-user namespaces through LangGraph's `PostgresStore`.

## Requirements

- Node.js 20+
- Docker
- An LLM provider with tool/function calling support

Local OpenAI-compatible models must support tool calling well enough for Deep Agents filesystem tools.

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

The API starts on `http://localhost:3000` by default.

You can also run the compiled server:

```bash
npm run build
npm start
```

If you already have Postgres on port `5432`, use another host port and update
`DATABASE_URL` to match:

```bash
POSTGRES_PORT=5433 docker compose up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/deepagents_demo npm run dev
```

## Provider Config

Pick one provider in `.env`.

OpenAI:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4.1-mini
```

Anthropic:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=4096
```

OpenAI-compatible local or proxy endpoint:

```bash
LLM_PROVIDER=openai-compatible
OPENAI_COMPAT_BASE_URL=http://localhost:1234/v1
OPENAI_COMPAT_API_KEY=local
OPENAI_COMPAT_MODEL=local-model
```

For LM Studio or Ollama-compatible servers, set `OPENAI_COMPAT_BASE_URL` to the server's `/v1` base URL.

## API

Health:

```bash
curl http://localhost:3000/health
```

Chat:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId": "alice",
    "threadId": "demo",
    "message": "Remember that I prefer short technical answers. Save that in /user/memories/preferences.md."
  }'
```

Debug persistent store rows for the global and user scopes:

```bash
curl -s 'http://localhost:3000/debug/store?userId=alice'
```

## Prove Tenant Isolation

1. Store a memory for Alice:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId": "alice",
    "threadId": "demo",
    "message": "Remember that my favorite database is Postgres. Save it in /user/memories/preferences.md."
  }'
```

2. Ask Bob what he remembers. Bob should not see Alice's memory:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId": "bob",
    "threadId": "demo",
    "message": "What do you remember about my favorite database? Check /global/memories/ and /user/memories/ first."
  }'
```

3. Ask Alice the same question. Alice should see her Postgres memory:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId": "alice",
    "threadId": "demo",
    "message": "What do you remember about my favorite database? Check /global/memories/ and /user/memories/ first."
  }'
```

4. Inspect each namespace directly:

```bash
curl -s 'http://localhost:3000/debug/store?userId=alice'
curl -s 'http://localhost:3000/debug/store?userId=bob'
```

Alice and Bob use the same external `threadId`, but the server prefixes the internal checkpoint thread with the sanitized user ID. Their durable user namespaces are separate, while global namespaces are shared and read-only:

```text
global:memories          # shared, read-only to the agent
global:skills            # shared, read-only to the agent
users:alice:memories     # Alice only, writable
users:alice:skills       # Alice only, writable
users:bob:memories       # Bob only, writable
users:bob:skills         # Bob only, writable
```

## Notes

- This is demo multi-tenancy, not authentication. In a real app, derive `userId` from trusted auth middleware, not request JSON.
- The `safeUserId` in responses is the sanitized namespace component used for Postgres.
- The debug endpoint is intentionally read-only and for local proof only.
- The Python Deep Agents permissions docs show declarative `FilesystemPermission` rules for read-only global memory. The current TypeScript package does not expose that API, so this demo enforces the same rule by wrapping global `StoreBackend`s with `ReadOnlyBackend`.

## Verification

```bash
npm run typecheck
npm run build
```
