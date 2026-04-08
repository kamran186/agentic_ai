// ---------------------------------------------------------------------------
// Runtime Context Example
// ---------------------------------------------------------------------------
// Demonstrates how to pass runtime context (typed) into an agent. The context
// allows tools to access external services or per-request data without using
// global variables.

import 'dotenv/config';
import { Agent, run, tool, RunContext } from '@openai/agents';
import { z } from 'zod';

/**
 * MyContext
 * Defines the shape of the runtime context that will be available to tools
 * and agents during execution. This example includes a simple function that
 * returns user information (simulating a DB call).
 */
interface MyContext {
  userId: string;
  userName: string;

  // Example helper that tools can call to fetch user data
  fetchUserInfoFromDb: () => Promise<string>;
}


/**
 * getUserInfoTool
 * A tool that demonstrates accessing the RunContext passed to the agent
 * runtime. The tool reads `ctx.context.fetchUserInfoFromDb()` and returns
 * whatever the provided function resolves to.
 */
const getUserInfoTool = tool({
  name: 'get_user_info',
  description: 'Gets the user info',
  parameters: z.object({}),
  execute: async (
    _,
    ctx?: RunContext<MyContext>
  ): Promise<string | undefined> => {
    const result = await ctx?.context.fetchUserInfoFromDb();
    return result;
  },
});


/**
 * customerSupportAgent
 * An agent that can use the getUserInfoTool. Notice the agent is typed with
 * the same MyContext so the runtime can enforce correct usage.
 */
const customerSupportAgent = new Agent<MyContext>({
  name: 'Customer Support Agent',
  tools: [getUserInfoTool],
  instructions: ({ context }) => {
    return `You're an expert customer support agent`;
  },
});


/**
 * main
 * Runs the agent with a provided runtime context object. This passes the
 * context through the run() call so tools can access it securely.
 */
async function main(query: string, ctx: MyContext) {
  const result = await run(customerSupportAgent, query, {
    context: ctx,
  });
  console.log(`Result:`, result.finalOutput);
}


// Example invocation: provide a small context and a stubbed fetch function
main('Hey, what is my name?', {
  userId: '2',
  userName: 'Jhon Doe',
  fetchUserInfoFromDb: async () => `UserId=2,UserName=Jhon`,
});