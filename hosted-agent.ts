import 'dotenv/config';
import { Agent, run, hostedMcpTool } from '@openai/agents';

const agent = new Agent({
  name: 'MCP Assistant',
  instructions: 'You must always use the MCP tools to answer questions.',
  tools: [
    hostedMcpTool({
      serverLabel: 'gitmcp',
      // This is a public MCP server hosting the Codex MCP. You can also self-host your own MCP server and point to it here.
      serverUrl: 'https://gitmcp.io/openai/codex',
    }),
  ],
});

async function main(q: string) {
  const result = await run(agent, q);
  console.log(result.finalOutput);
}

main('What is the capital of Pakistan?');