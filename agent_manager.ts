import 'dotenv/config';
import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import fs from 'node:fs/promises';

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

const refundAgent = new Agent({
  name: 'Refund Agent',
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

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
  ],
});

let conversation = true;
let firstQuestion = true;
async function runAgent(query = '') {
  
    const rl = createInterface({ input, output });
    const question = await rl.question(`Ask Question? ${firstQuestion ? '[default]' : ''} `);
    await rl.close();
    firstQuestion = false;
  
    if(question.toLowerCase() === "exit") {
      conversation = false;
      console.log("Exiting conversation. Goodbye!");
      return;
    }
    const result = await run(salesAgent, question  === 'default' ? query : question, {
      conversationId: 'conv_69d56f5879c88195b419af0f857f400c0fab7f4b54ca803c',
    });
    console.log("Final Out:", result.finalOutput);
}

runAgent(
  `I had 5 users with the plan of 399.
  user1, user2, user3, user4 and user5.
  Also, I need to view plans for my internet connection for user 6.
  As all of them have upgraded to 999, I want to issue refund for the previous month.`
);