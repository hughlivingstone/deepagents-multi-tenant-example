import { getConfig } from "@langchain/langgraph";
import { StoreBackend, type StoreBackendOptions } from "deepagents";

export class UserScopedStoreBackend extends StoreBackend {
  constructor(
    private readonly suffix: string[],
    options?: StoreBackendOptions,
  ) {
    super(options);
  }

  protected getNamespace(): string[] {
    const userId = getConfig().configurable?.userId;
    if (typeof userId !== "string" || userId.length === 0) {
      throw new Error("UserScopedStoreBackend requires configurable.userId");
    }
    return ["users", userId, ...this.suffix];
  }
}
