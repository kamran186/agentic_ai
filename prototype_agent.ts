import 'dotenv/config';
import { google } from 'googleapis';
import OpenAI from 'openai';

const {
    OPENAI_API_KEY,
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID,
} = process.env;

if (!OPENAI_API_KEY || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    throw new Error('Missing required environment variables.');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function getSheetData(range: string) {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range,
    });

    return res.data.values ?? [];
}

// ---------------------------------------------------------------------------
// Google Sheets Agent: tool + agent + runner
// ---------------------------------------------------------------------------
// We'll expose a small tool that calls getSheetData(range). Then we'll create
// an agent that can invoke that tool when asked about sheet contents.

// ---------------------------------------------------------------------------
// Agent Manager - Interactive example
// ---------------------------------------------------------------------------
// This file demonstrates creating tools, composing agents, and running an
// interactive conversation loop where a user can ask about plans or refunds.

// Load environment variables from .env
import 'dotenv/config';

// Import agent primitives
import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { createInterface } from "node:readline/promises";

// File system for logging refund operations (simple audit trail)
import fs from 'node:fs/promises';

// ------------------------------------------------------------------
// Tools
// ------------------------------------------------------------------
// Tool to fetch available plans (mock implementation)
const fetchAvailablePlans = tool({
  name: 'fetch_available_plans',
  description: 'fetches the available plans for internet',
  parameters: z.object({
    customerId: z.string().describe('id of the customer'),
  }),
  execute: async function ({ customerId }) {
    return [
      { plan_id: '1', price_inr: 399, speed: '30MB/s' },
      { plan_id: '2', price_inr: 999, speed: '100MB/s' },
      { plan_id: '3', price_inr: 1499, speed: '200MB/s' },
    ];
  },
});

// Tool to process refunds (appends a record to ./refunds.txt)
const processRefund = tool({
  name: 'process_refund',
  description: `This tool processes the refund for a customer`,
  parameters: z.object({
    customerId: z.string().describe('id of the customer'),
    reason: z.string().describe('reason for refund'),
  }),
  execute: async function ({ customerId, reason }) {
    await fs.appendFile(
      './refunds.txt',
      `Refund for Customer having ID ${customerId} for ${reason}`,
      'utf-8'
    );
    return { refundIssued: true };
  },
});

// ------------------------------------------------------------------
// Google Sheets tool
// ------------------------------------------------------------------
/**
 * getSheetTool
 * A thin wrapper tool that allows agents to request data from a Google
 * Sheet range. The tool returns the raw 2D array of values.
 */
const getSheetTool = tool({
  name: 'get_sheet_data',
  description: 'Fetches data from a Google Sheet range (e.g. "Sheet1!A1:C10")',
  parameters: z.object({
    range: z.string().describe('A1-style range or sheet name (e.g. "Sheet1!A1:C10")'),
  }),
  execute: async function ({ range }) {
    // Delegate to the helper that authenticates and calls the Sheets API
    const values = await getSheetData(range);
    return { values };
  },
});

// ------------------------------------------------------------------
// Agents
// ------------------------------------------------------------------
// Dedicated refund agent with access only to the processRefund tool
const refundAgent = new Agent({
  name: 'Refund Agent',
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

// Primary sales agent which can fetch plans and delegate refunds
const salesAgent = new Agent({
  name: 'Sales Agent',
  instructions: `
        You are an expert sales agent for an internet broadband comapny.
        Talk to the user and help them with what they need.
    `,
  tools: [
    fetchAvailablePlans,
    refundAgent.asTool({
      toolName: 'refund_expert',
      toolDescription: 'Handles refund questions and requests.',
    }),
    // Allow the sales agent to also query sheet data if needed
    getSheetTool,
  ],
});

// ------------------------------------------------------------------
// Interactive conversation loop
// ------------------------------------------------------------------
let conversation = true;
let firstQuestion = true;
async function runAgent(query = '') {
  // Create readline interface and prompt the user
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const question = await rl.question(`Ask Question? ${firstQuestion ? '[default]' : ''} `);
  await rl.close();
  firstQuestion = false;

  // Allow user to exit cleanly
  if(question.toLowerCase() === "exit") {
    conversation = false;
    console.log("Exiting conversation. Goodbye!");
    return;
  }

  // Run the sales agent with the provided question. The conversationId
  // maintains context across interactions (if supported by the runtime).
  const result = await run(salesAgent, question  === 'default' ? query : question, {
    conversationId: 'conv_69d56f5879c88195b419af0f857f400c0fab7f4b54ca803c',
  });
  console.log("Final Out:", result.finalOutput);
}

// Run a single example turn (this file is intended as an example script)
runAgent(
  `I had 5 users with the plan of 399.
  user1, user2, user3, user4 and user5.
  Also, I need to view plans for my internet connection for user 6.
  As all of them have upgraded to 999, I want to issue refund for the previous month.`
);

// ------------------------------------------------------------------
// Optional: a dedicated interactive runner for Google Sheets queries
// ------------------------------------------------------------------
async function runSheetsAgent() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const range = await rl.question('Enter sheet range (e.g. "Sheet1!A1:C10"): ');
  await rl.close();

  try {
    // Use the tool directly via the agent runtime by prompting the agent to
    // call the tool. The sheetsAgent below is minimal and instructs the agent
    // to call get_sheet_data when asked about sheets.
    const sheetsAgent = new Agent({
      name: 'Google Sheets Agent',
      instructions: `You are a Google Sheets assistant. When asked for sheet
data, call the get_sheet_data tool with the requested range and return the
values in a concise JSON-friendly format. Do not attempt to access external
services directly; always use the tool.`,
      tools: [getSheetTool],
    });

    // Ask the agent (the agent will call the tool internally)
    const result = await run(sheetsAgent, `Please fetch the sheet data for range: ${range}`);
    const out = result.finalOutput;
    console.log('Sheet fetch result:', out);
    // Try to extract values returned by the tool in a few common shapes
    const values = (out && typeof out === 'object') ? (out as any).values ?? (out as any).toolResponses?.get_sheet_data?.values : undefined;
    if (values) {
      console.log('Values:', JSON.stringify(values, null, 2));
    }
  } catch (err) {
    console.error('Error fetching sheet data:', err);
  }
}

// Provide a small prompt so the user can try the sheets agent manually. If
// you prefer not to run this interactive prompt automatically, comment the
// next line out.
// runSheetsAgent();