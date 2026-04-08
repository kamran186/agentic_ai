// ---------------------------------------------------------------------------
// SQL Conversation Example
// ---------------------------------------------------------------------------
// Shows how to expose a small SQL execution tool to an agent that generates
// SQL queries based on a provided schema. This is intended for local testing
// and illustration only; never execute untrusted SQL in production.

// Load environment variables and runtime primitives
import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";


/**
 * executeSQL
 * A toy tool that 'executes' SQL by printing it to the console. In a real
 * application this would run the query against a database connection.
 */
const executeSQL = tool({
  name: "execute_sql",
  description: "This executes the SQL Query",
  parameters: z.object({
    sql: z.string().describe("the sql query"),
  }),
  execute: async function ({ sql }) {
    // IMPORTANT: This is a no-op mock. Replace with a safe DB call if used.
    console.log(`[SQL]: Execute ${sql}`);
    return "done";
  },
});


/**
 * sqlAgent
 * Agent configured to generate SQL for a given Postgres schema. The agent
 * will be able to call the execute_sql tool to run the generated queries.
 */
const sqlAgent = new Agent({
  name: "SQL Expert Agent",
  tools: [executeSQL],
  instructions: `
          You are an expert SQL Agent that is specialized in generating SQL queries as per user request.

          Postgres Schema:
      -- users table
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- comments table
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `,
});


// ------------------------------------------------------------------
// Interactive loop
// ------------------------------------------------------------------
let conversation = true;
async function main(q = "") {
  const rl = createInterface({ input, output });
  const question = await rl.question("Ask Question? ");
  await rl.close();

  if(question.toLowerCase() === "exit") {
    conversation = false;
    console.log("Exiting conversation. Goodbye!");
    return;
  }

  // Run the sqlAgent with the user's question. conversationId preserves
  // context if the runtime supports it.
  const result = await run(sqlAgent, question, {
    conversationId: 'conv_69d56f5879c88195b419af0f857f400c0fab7f4b54ca803c',
  });

  // Display the final structured output from the agent
  console.log("Final Out:", result.finalOutput);
}

// Keep prompting the user until they exit
while (conversation) {
  await main();
}
