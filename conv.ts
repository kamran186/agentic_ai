import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const executeSQL = tool({
  name: "execute_sql",
  description: "This executes the SQL Query",
  parameters: z.object({
    sql: z.string().describe("the sql query"),
  }),
  execute: async function ({ sql }) {
    console.log(`[SQL]: Execute ${sql}`);
    return "done";
  },
});

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
  const result = await run(sqlAgent, question, {
    conversationId: 'conv_69d56f5879c88195b419af0f857f400c0fab7f4b54ca803c',
  });

  //   console.log(result.history);
  console.log("Final Out:", result.finalOutput);
}

while (conversation) {
  await main();
}
