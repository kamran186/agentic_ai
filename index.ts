import { Agent, run } from '@openai/agents';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';

// Load environment variables from .env into process.env
dotenv.config();

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

// Quick sanity check: ensure the OPENAI_API_KEY is available (masked when printed)
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY is not set in process.env. Make sure you have a .env file and dotenv is loaded.');
  // Do not exit here during development; comment out the next line if you prefer to continue without a key.
  // process.exit(1);
} else {
  const masked = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.log('OPENAI_API_KEY loaded:', masked);
}



async function askAndRun() {
    const rl = createInterface({ input, output });
    const name = await rl.question('What is your name? ');
    await rl.close();

    run(agent, 'hello my name is Kamran').then((response) => {
        console.log('Agent response:', response);
    }).catch((error) => {
        console.error('Error running agent:', error);
    });
}

askAndRun();