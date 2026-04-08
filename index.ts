// ---------------------------------------------------------------------------
// Simple example showing how to load environment variables and run an agent
// ---------------------------------------------------------------------------
// Load environment variables from .env. This provides OPENAI_API_KEY to the
// OpenAI/agents runtime without hardcoding secrets in source.
import 'dotenv/config';

// Agent primitives and interactive I/O helpers
import { Agent, run } from '@openai/agents';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// Create a tiny agent with simple instructions. In real apps this would be
// replaced with a more featureful agent or a composition of tools.
const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

// Sanity check: verify OPENAI_API_KEY is present and show a masked snippet
// to confirm the environment variable loaded correctly.
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error(
    'ERROR: OPENAI_API_KEY is not set in process.env. Make sure you have a .env file and dotenv is loaded.',
  );
  // Note: we intentionally don't exit here to allow local development without
  // a real API key. In production you may want to exit with a non-zero code.
} else {
  const masked = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.log('OPENAI_API_KEY loaded:', masked);
}


/**
 * askAndRun
 * Prompts for the user's name, then demonstrates running the agent.
 */
async function askAndRun() {
  const rl = createInterface({ input, output });
  const name = await rl.question('What is your name? ');
  await rl.close();

  // Demonstration: call the agent with a simple message and log the response
  run(agent, `hello my name is ${name}`).then((response) => {
    console.log('Agent response:', response);
  }).catch((error) => {
    console.error('Error running agent:', error);
  });
}

askAndRun();