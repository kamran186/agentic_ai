import 'dotenv/config';
import { Agent, run, MCPServerStreamableHttp } from '@openai/agents';

const githubMcpSever = new MCPServerStreamableHttp({
  // This is a public MCP server hosting the Codex MCP. You can also self-host your own MCP server and point to it here.
  url: 'https://gitmcp.io/openai/codex',
  name: 'GitMCP Documentation Server',
});

const agent = new Agent({
  name: 'MCP Assistant',
  instructions: 'You must always use the MCP tools to answer questions.',
  mcpServers: [githubMcpSever],
});

async function main(q: string) {
  await githubMcpSever.connect();
  const result = await run(agent, q);
  console.log(result.finalOutput);
  await githubMcpSever.close();
}

main('What is this repo about?');