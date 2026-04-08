// ---------------------------------------------------------------------------
// Small utility: create a conversation thread using the OpenAI Conversations API
// ---------------------------------------------------------------------------

// Load environment variables from .env (e.g., OPENAI_API_KEY). Using
// `dotenv/config` lets us keep secrets out of source code while accessing
// them through process.env.
import 'dotenv/config';

// Import the OpenAI client. The client picks up the API key from process.env.
import { OpenAI } from 'openai';

// Instantiate a client. The OpenAI constructor will read OPENAI_API_KEY
// from the environment when using the official SDK.
const client = new OpenAI();

// Create an empty conversation thread and log the ID once created. This is
// useful for bootstrapping a conversation that other scripts can reference.
client.conversations.create({}).then((e) => {
  console.log('Conv thread created id=', e.id);
});