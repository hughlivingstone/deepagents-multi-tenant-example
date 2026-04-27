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

const SYSTEM_PROMPT = `Files under /global/ are read-only shared resources. Files under /user/ are writable and scoped to the current user. Save user-specific notes under /user/memories/.`;

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
