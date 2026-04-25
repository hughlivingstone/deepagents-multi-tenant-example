import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import {
  CompositeBackend,
  StateBackend,
  StoreBackend,
  createDeepAgent,
} from "deepagents";

import { ReadOnlyBackend } from "./readOnlyBackend.js";

const SYSTEM_PROMPT = `You are a concise assistant for a multi-tenant Deep Agents demo.

Global shared memory and skills live under /global/ and are read-only.
User-specific memory and skills live under /user/ and are writable for the current user only.
When the user asks you to remember a stable preference, profile fact, or reusable instruction, write it to /user/memories/preferences.md.
When the user asks what you remember, inspect /global/memories/ and /user/memories/ before answering.
Do not try to write or edit files under /global/.
Keep responses brief and mention the memory file only when relevant.`;

type Agent = ReturnType<typeof createDeepAgent>;

const agents = new Map<string, Agent>();

export function getAgent(
  userId: string,
  model: BaseChatModel,
  store: PostgresStore,
  checkpointer: PostgresSaver,
): Agent {
  const cached = agents.get(userId);
  if (cached) return cached;

  const agent = createDeepAgent({
    name: `tenant-${userId}`,
    model,
    store,
    checkpointer,
    systemPrompt: SYSTEM_PROMPT,
    memory: ["/global/memories/", "/user/memories/"],
    skills: ["/global/skills/", "/user/skills/"],
    backend: new CompositeBackend(new StateBackend(), {
      "/global/memories/": new ReadOnlyBackend(
        new StoreBackend({ namespace: ["global", "memories"] }),
        "Global memories",
      ),
      "/user/memories/": new StoreBackend({
        namespace: ["users", userId, "memories"],
      }),
      "/global/skills/": new ReadOnlyBackend(
        new StoreBackend({ namespace: ["global", "skills"] }),
        "Global skills",
      ),
      "/user/skills/": new StoreBackend({
        namespace: ["users", userId, "skills"],
      }),
    }),
  });

  agents.set(userId, agent);
  return agent;
}

export async function invokeAgent(
  userId: string,
  threadId: string,
  message: string,
  model: BaseChatModel,
  store: PostgresStore,
  checkpointer: PostgresSaver,
): Promise<string> {
  const agent = getAgent(userId, model, store, checkpointer);

  const result = await agent.invoke(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id: `${userId}:${threadId}` } },
  );

  const last = result.messages.at(-1);
  return typeof last?.content === "string" ? last.content : "";
}
