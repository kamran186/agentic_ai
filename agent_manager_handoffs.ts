import "dotenv/config";
import { Agent, tool, run } from "@openai/agents";
import { z } from "zod";

import fs from "node:fs/promises";

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

const refundAgent = new Agent({
  name: "Refund Agent",
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

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

async function runAgent(query = "") {
  const result = await run(receptionistAgent, query);
  console.log(result.finalOutput);
}

runAgent(
    `Hi There, I want to know about the available plans for my internet connection. customerId: 12345. Also refund for the previous month as I had some issues with the connection. customerId: 12345, reason: poor connection.`,
);
