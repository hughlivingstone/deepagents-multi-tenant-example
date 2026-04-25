import { ChatOpenAI } from "@langchain/openai";

export function createModel(): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY ?? "not-needed",
    model: process.env.LLM_MODEL ?? "local-model",
    temperature: 0,
    streamUsage: false,
    configuration: {
      baseURL: (process.env.LLM_BASE_URL ?? "http://localhost:11434/v1").replace(
        /\/+$/,
        "",
      ),
    },
  });
}
