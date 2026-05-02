# Multi-Tenant Deep Agents Node Demo

Runnable TypeScript demo for a multi-tenant Deep Agents setup. **One agent instance serves every user** — the per-user storage namespace is resolved from `configurable.userId` on every invocation.

## Requirements

- Node.js 20+
- Docker
- An LLM provider with tool/function calling support

Local OpenAI-compatible models must support tool calling well enough for Deep Agents filesystem tools, Qwen3.6-35b-a3b worked well.

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

Server starts on `http://localhost:3000`.

## Provider Config

Pick one provider in `.env`.

OpenAI:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-5.4-mini
```

Anthropic:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=4096
```

OpenAI-compatible (LM Studio, Ollama, vLLM, etc.):

```bash
LLM_PROVIDER=openai-compatible
OPENAI_COMPAT_BASE_URL=http://localhost:1234/v1
OPENAI_COMPAT_API_KEY=lm-studio
OPENAI_COMPAT_MODEL=qwen/qwen3.6-35b-a3b
```

For local models, allow at least 16K context — the deepagents system prompt + tool descriptions are ~8K tokens before the conversation starts.

## API

Chat:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"userId":"alice","threadId":"demo","message":"Remember my favourite colour is teal."}'
```

Inspect persistent store rows for a user:

```bash
curl -s 'http://localhost:3000/debug/store?userId=alice'
```

## Demo script

End-to-end isolation demo — two users save a memory, recall on a new conversation thread (so the answer can only come from Postgres, not in-process state), and triggers the read-only enforcement on `/skills/`:

```bash
npx tsx scripts/run-agent-demo.ts
```

Sample output:

```text
  Multi-tenant deepagent — per-user memory demo
  ────────────────────────────────────────────────────────────────
  alice  →  demo-alice-1777677202396
  bob    →  demo-bob-1777677202396

  WRITE
  ────────────────────────────────────────────────────────────────
  alice  ▸  Save a memory: my favourite colour is teal.
  agent  ◂  Saved.
  bob    ▸  Save a memory: my favourite colour is amber.
  agent  ◂  Saved.

  RECALL  (new thread → checkpointer state is empty)
  ────────────────────────────────────────────────────────────────
  alice  ▸  What is my favourite colour? Just the colour name.
  agent  ◂  teal
  bob    ▸  What is my favourite colour? Just the colour name.
  agent  ◂  amber

  READ-ONLY  (agent tries to write under /skills/)
  ────────────────────────────────────────────────────────────────
  alice  ▸  Save a new skill at /skills/test/SKILL.md.
  agent  ◂  I can't write to `/skills` here because it's read-only.

  STORAGE  (postgres store table)
  ────────────────────────────────────────────────────────────────
  users:demo-alice-1777677202396:memories/AGENTS.md
     └─ - User's favourite colour is teal.
  users:demo-bob-1777677202396:memories/AGENTS.md
     └─ - User's favourite colour is amber.
```

## Notes

- This demo's is to show multi tenancy with minimal code, in a real app the `userId` should come from a trusted source such as an IdP(Auth0, Cognito, whatver) - never the user request!
