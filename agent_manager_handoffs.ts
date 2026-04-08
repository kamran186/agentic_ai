// ---------------------------------------------------------------------------
// Agent Manager with Handoffs
// ---------------------------------------------------------------------------
// Demonstrates a receptionist agent that can hand off work to specialized
// agents (salesAgent and refundAgent) depending on the customer's request.

// Load environment variables from .env
import "dotenv/config";

// Agent primitives and schema validation
import { Agent, tool, run } from "@openai/agents";
import { z } from "zod";

// File system access for audit logs
import fs from "node:fs/promises";

// ------------------------------------------------------------------
// Tools
// ------------------------------------------------------------------
// fetchAvailablePlans returns mock plan information (PKR prices in this example)
const fetchAvailablePlans = tool({
  name: "fetch_available_plans",
  description: "fetches the available plans for internet in PKR",
  parameters: z.object({
    customerId: z.string().describe("id of the customer"),
  }),
  execute: async function ({ customerId }) {
    return [
      { plan_id: "1", price_inr: 399, speed: "30MB/s" },
      { plan_id: "2", price_inr: 999, speed: "100MB/s" },
      { plan_id: "3", price_inr: 1499, speed: "200MB/s" },
    ];
  },
});

// processRefund appends refund records to a local file. In production this
// would call a backend service or database.
const processRefund = tool({
  name: "process_refund",
  description: `This tool processes the refund for a customer`,
  parameters: z.object({
    customerId: z.string().describe("id of the customer"),
    reason: z.string().describe("reason for refund"),
  }),
  execute: async function ({ customerId, reason }) {
    await fs.appendFile(
      "./refunds.txt",
      `Refund for Customer having ID ${customerId} for ${reason}`,
      "utf-8",
    );
    return { refundIssued: true };
  },
});

// ------------------------------------------------------------------
// Agents
// ------------------------------------------------------------------
// refundAgent: handles refunds via processRefund tool
const refundAgent = new Agent({
  name: "Refund Agent",
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

// salesAgent: fetches plans and can delegate refunds
const salesAgent = new Agent({
  name: "Sales Agent",
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

// receptionistAgent: a general entry-point agent that inspects user intent
// and hands off to the appropriate specialized agent (sales or refunds).
const receptionistAgent = new Agent({
  name: "Receptionist Agent",
  instructions: `You are expert in handling customer inquiries and directing them to the appropriate agent.
  If the customer has any questions related to sales, plans or refunds, direct them to the sales agent.
  If they have any questions related to refunds only, direct them to the refund agent.`,
  handoffDescription: `This agent is responsible for handling customer inquiries and directing them to the appropriate agent based on the customer's needs.
  If the customer has any questions related to sales, plans, direct them to the sales agent.
  If they have any questions related to refunds only, direct them to the refund agent.
  `,
  handoffs: [salesAgent, refundAgent],
});

// ------------------------------------------------------------------
// Runner
// ------------------------------------------------------------------
async function runAgent(query = "") {
  // Run the receptionist which will decide which agent should handle the query
  const result = await run(receptionistAgent, query);
  console.log(result.finalOutput);
}

// Example usage: a mixed query asking about plans and refunds
runAgent(
    `Hi There, I want to know about the available plans for my internet connection. customerId: 12345. Also refund for the previous month as I had some issues with the connection. customerId: 12345, reason: poor connection.`,
);
