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
import { UserScopedStoreBackend } from "./userScopedStoreBackend.js";

const SYSTEM_PROMPT = `Save user-specific notes to /memories/AGENTS.md so they persist across conversations.`;

type Agent = ReturnType<typeof createDeepAgent>;

let agent: Agent | null = null;

export function initAgent(
  model: BaseChatModel,
  store: PostgresStore,
  checkpointer: PostgresSaver,
): Agent {
  if (agent) return agent;

  agent = createDeepAgent({
    name: "multi-tenant",
    model,
    store,
    checkpointer,
    systemPrompt: SYSTEM_PROMPT,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
    backend: new CompositeBackend(new StateBackend(), {
      "/memories/": new UserScopedStoreBackend(["memories"]),
      "/skills/": new ReadOnlyBackend(
        new StoreBackend({ namespace: ["skills"] }),
        "Skills",
      ),
    }),
  });

  return agent;
}

export async function invokeAgent(
  userId: string,
  threadId: string,
  message: string,
): Promise<string> {
  if (!agent) throw new Error("Agent not initialised. Call initAgent() first.");

  const result = await agent.invoke(
    { messages: [{ role: "user", content: message }] },
    { configurable: { userId, thread_id: `${userId}:${threadId}` } },
  );

  // Extract the agent's final reply as a string; content can also be a
  // structured ContentBlock[] (multimodal/tool output), which we don't surface here.
  const last = result.messages.at(-1);
  return typeof last?.content === "string" ? last.content : "";
}
