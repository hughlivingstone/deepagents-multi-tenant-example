// Demonstrates per-user memory isolation in the multi-tenant deepagent demo.
//
// Two users save a memory, then each recalls theirs on a brand-new thread.
// Recalls on a fresh thread can only succeed via the user-scoped postgres
// store — proving isolation isn't an artifact of in-memory checkpointer state.
//
// Prereqs: `docker compose up -d` and `npm run dev` running on localhost:3000.
// Run:     npx tsx scripts/demo-memory.ts

import "dotenv/config";

import pg from "pg";

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const RULE = "─".repeat(64);

type Turn = { user: string; userId: string; prompt: string; reply: string };

async function chat(
  userId: string,
  prompt: string,
  threadId = "default",
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, threadId, message: prompt }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const { reply } = (await res.json()) as { reply: string };
  return reply;
}

function printSection(title: string, turns: Turn[]): void {
  console.log(`\n  ${title}`);
  console.log(`  ${RULE}`);
  for (const t of turns) {
    console.log(`  ${t.user.padEnd(5)}  ▸  ${t.prompt}`);
    const lines = t.reply.split("\n").map((l) => l.trimEnd());
    const [first, ...rest] = lines;
    console.log(`  agent  ◂  ${first}`);
    for (const line of rest) {
      console.log(line.length === 0 ? "" : `            ${line}`);
    }
  }
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const users = [
    { name: "alice", id: `demo-alice-${stamp}`, colour: "teal" },
    { name: "bob", id: `demo-bob-${stamp}`, colour: "amber" },
  ];

  console.log(`\n  Multi-tenant deepagent — per-user memory demo`);
  console.log(`  ${RULE}`);
  for (const u of users) console.log(`  ${u.name.padEnd(5)}  →  ${u.id}`);

  const writes: Turn[] = [];
  for (const u of users) {
    const prompt = `Save a memory: my favourite colour is ${u.colour}.`;
    writes.push({
      user: u.name,
      userId: u.id,
      prompt,
      reply: await chat(u.id, prompt),
    });
  }
  printSection("WRITE", writes);

  const recallPrompt = "What is my favourite colour? Just the colour name.";
  const recalls: Turn[] = [];
  for (const u of users) {
    recalls.push({
      user: u.name,
      userId: u.id,
      prompt: recallPrompt,
      reply: await chat(u.id, recallPrompt, "recall"),
    });
  }
  printSection("RECALL  (new thread → checkpointer state is empty)", recalls);

  const writeAttempt = await chat(
    users[0].id,
    "Please save a new skill at /skills/test/SKILL.md with the content 'hello'.",
    "skill-write",
  );
  printSection("READ-ONLY  (agent tries to write under /skills/)", [
    {
      user: users[0].name,
      userId: users[0].id,
      prompt: "Save a new skill at /skills/test/SKILL.md.",
      reply: writeAttempt,
    },
  ]);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const { rows } = await pool.query<{
    namespace_path: string;
    key: string;
    content: string;
  }>(
    `SELECT namespace_path, key, value->>'content' AS content
       FROM store
      WHERE namespace_path = ANY($1)
      ORDER BY namespace_path, key`,
    [users.map((u) => `users:${u.id}:memories`)],
  );
  await pool.end();

  console.log(`\n  STORAGE  (postgres store table)`);
  console.log(`  ${RULE}`);
  for (const r of rows) {
    console.log(`  ${r.namespace_path}${r.key}`);
    console.log(`     └─ ${r.content.trim().replace(/\s*\n\s*/g, " ")}`);
  }
  console.log();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
