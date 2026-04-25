import "dotenv/config";

import express from "express";

import { invokeAgent } from "./agent.js";
import { createPersistence, listStoreRows } from "./db.js";
import { createModel } from "./model.js";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const model = createModel();
  const { pool, store, checkpointer } = await createPersistence(databaseUrl);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, model: process.env.LLM_MODEL });
  });

  app.post("/chat", async (req, res, next) => {
    try {
      const { userId, threadId = "default", message } = req.body ?? {};
      if (!userId || !message) {
        return res.status(400).json({ error: "userId and message are required" });
      }

      const reply = await invokeAgent(
        userId,
        threadId,
        message,
        model,
        store,
        checkpointer,
      );
      res.json({ userId, threadId, reply });
    } catch (err) {
      next(err);
    }
  });

  app.get("/debug/store", async (req, res, next) => {
    try {
      const userId = String(req.query.userId ?? "");
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const namespaces = {
        globalMemories: ["global", "memories"],
        userMemories: ["users", userId, "memories"],
        globalSkills: ["global", "skills"],
        userSkills: ["users", userId, "skills"],
      };

      const entries = await Promise.all(
        Object.entries(namespaces).map(async ([scope, ns]) => [
          scope,
          {
            namespace: ns,
            rows: await listStoreRows(pool, ns.join(":")),
          },
        ]),
      );

      res.json({ userId, scopes: Object.fromEntries(entries) });
    } catch (err) {
      next(err);
    }
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : "Unexpected error";
      res.status(500).json({ error: message });
    },
  );

  const server = app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });

  const shutdown = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    await store.stop();
  };

  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
