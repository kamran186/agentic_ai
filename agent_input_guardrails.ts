import 'dotenv/config';
import { Agent, tool, run, InputGuardrailTripwireTriggered } from '@openai/agents';
import { z } from 'zod';

import fs from 'node:fs/promises';


const salesReceptionInputAgent = new Agent({
  name: 'Internet Sales and refund query checker',
  instructions: `
  You are a Reception who can only answer if the query is related to sales or refund of plans
  If the query is not related to sales or refund of plans, you will reject the query give an abusing reason.
  `,
  outputType: z.object({
    isValidSalesOrRefundQuery: z.boolean().describe('if the question is a valid sales or refund query'),
    reason: z.string().optional().describe('reason to reject'),
  }),
});


const salesReceptionInputGuardrail = {
  name: 'Sales and Refund Query Guardrail',
  execute: async ({ input }: { input: any }) => {
    const result = await run(salesReceptionInputAgent, input);
    return {
      outputInfo: result.finalOutput?.reason,
      tripwireTriggered: !result.finalOutput?.isValidSalesOrRefundQuery, // <-- This value decides if we have to trigger
    };
  },
};

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
  inputGuardrails: [salesReceptionInputGuardrail],
});

async function runAgent(query = '') {
  const result = await run(salesAgent, query);
  console.log(result.finalOutput);
}

runAgent(
  `I had 5 users with the plan of 399.
  user1, user2, user3, user4 and user5.
  Also, I need to view plans for my internet connection for user 6.
  As all of them have upgraded to 999, I want to issue refund for the previous month.`
);