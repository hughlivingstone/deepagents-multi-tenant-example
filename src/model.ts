import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";

export interface ModelInfo {
  model: BaseChatModel;
  provider: string;
  modelName: string;
}

export function createModel(): ModelInfo {
  const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();

  if (provider === "openai") {
    const modelName = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    return {
      provider,
      modelName,
      model: new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: modelName,
        temperature: 0,
        streamUsage: false,
      }),
    };
  }

  if (provider === "anthropic") {
    const modelName = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    return {
      provider,
      modelName,
      model: new ChatAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: modelName,
        temperature: 0,
        maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 4096),
      }),
    };
  }

  if (provider === "openai-compatible") {
    const baseURL = (
      process.env.OPENAI_COMPAT_BASE_URL ?? "http://localhost:11434/v1"
    ).replace(/\/+$/, "");
    const modelName = process.env.OPENAI_COMPAT_MODEL ?? "local-model";
    return {
      provider,
      modelName,
      model: new ChatOpenAI({
        apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "not-needed",
        model: modelName,
        temperature: 0,
        streamUsage: false,
        configuration: { baseURL },
      }),
    };
  }

  throw new Error(
    `Unknown LLM_PROVIDER: ${provider}. Use openai, anthropic, or openai-compatible.`,
  );
}
