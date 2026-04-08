// ------------------------------------------------------------
// Agent Output Guardrail Example
// ------------------------------------------------------------

// Load environment variables from .env (e.g., OPENAI_API_KEY)
import 'dotenv/config';

// Import runtime primitives from the OpenAI Agents package.
// InputGuardrailTripwireTriggered is available in case you want to
// type-check the guardrail result, but it isn't required here.
import { Agent, tool, run, InputGuardrailTripwireTriggered } from '@openai/agents';
import { z } from 'zod';

// File system access for logging/recording refunds
import fs from 'node:fs/promises';


/**
 * salesReceptionOutputAgent
 * Acts as a safety filter that inspects the agent's generated output
 * and decides whether it is safe to execute (e.g., call tools, expose data).
 * The agent returns a reason and an `isSafe` flag.
 */
const salesReceptionOutputAgent = new Agent({
  name: 'Internet Sales and refund query checker',
  instructions: `
  You are a Reception who can only answer if the query is related to sales or refund of plans
  If the query is not related to sales or refund of plans, you will reject the query give an abusing reason like go ask your mom motherfucker.
  `,
  outputType: z.object({
    reason: z.string().optional().describe('reason if the query is unsafe'),
    isSafe: z.boolean().describe('if query is safe to execute'),
  }),
});


/**
 * salesReceptionOutputGuardrail
 * Wraps the output guardrail agent and exposes an `execute` method that
 * the agent runtime can call to determine whether to allow the output.
 */
const salesReceptionOutputGuardrail = {
  name: 'Sales and Refund Query Guardrail',
  async execute({ agentOutput } : { agentOutput: any }) {
    // Run the output-checking agent on the proposed agent output
    const result = await run(salesReceptionOutputAgent, agentOutput);
    return {
      outputInfo: result.finalOutput?.reason,
      // If isSafe is false, we trigger the tripwire and stop the output
      tripwireTriggered: !result.finalOutput?.isSafe, // <-- This value decides if we have to trigger
    };
  },
};

// ------------------------------------------------------------------
// Tools used by the sales/refund agents (same as other examples)
// ------------------------------------------------------------------
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
    // Append a refund record to a local file (audit trail)
    await fs.appendFile(
      './refunds.txt',
      `Refund for Customer having ID ${customerId} for ${reason}`,
      'utf-8'
    );
    return { refundIssued: true };
  },
});


// ------------------------------------------------------------------
// Agents
// ------------------------------------------------------------------
// refundAgent: dedicated to processing refunds via the processRefund tool
const refundAgent = new Agent({
  name: 'Refund Agent',
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

// salesAgent: the main conversational agent that can fetch plans or
// delegate refunds to the refundAgent. We attach the output guardrail
// so the runtime checks the agent's output before executing any actions.
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
  outputGuardrails: [salesReceptionOutputGuardrail],
});


// ------------------------------------------------------------------
// Runner
// ------------------------------------------------------------------
// Simple helper to run the sales agent and log the final output
async function runAgent(query = '') {
  const result = await run(salesAgent, query);
  console.log(result.finalOutput);
}

// Example invocation: note the last line contains an unsafe sexual query
// which the output guardrail should flag.
runAgent(
  `I had 5 users with the plan of 399.
  user1, user2, user3, user4 and user5.
  As all of them have upgraded to 999, I want to issue refund for the previous month.
  Also, I need to view plans for my internet connection for user 6.
  Other than that, where can I see you in porn movies?`
);