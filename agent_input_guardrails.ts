// ============================================================================
// IMPORTS & CONFIGURATION
// ============================================================================

// Load environment variables from .env file
import "dotenv/config";

// Import agent framework components from OpenAI Agents library
import {
  Agent,
  tool,
  run,
} from "@openai/agents";

// Import Zod for type validation and schema definition
import { z } from "zod";

// Import Node.js process streams for readline support
import { stdin as input, stdout as output } from "node:process";

// Import readline for interactive user input
import { createInterface } from "node:readline/promises";

// Import file system module for writing refund logs
import fs from "node:fs/promises";

// ============================================================================
// GUARDRAIL AGENT: Sales and Refund Query Validator
// ============================================================================

/**
 * salesReceptionInputAgent
 * Acts as a gatekeeper that validates whether a user query is related to
 * sales or refunds. Only valid queries are allowed through to the sales agent.
 * Returns a boolean indicating if the query is valid, and a reason if rejected.
 */
const salesReceptionInputAgent = new Agent({
  name: "Internet Sales and refund query checker",
  instructions: `
  You are a Reception who can only answer if the query is related to sales or refund of plans. Ask his name in the first message
  If the query is not related to sales or refund of plans, you will reject the query give an abusing reason.
  `,
  // Define the output schema: validates if query is sales/refund related
  outputType: z.object({
    isValidSalesOrRefundQuery: z
      .boolean()
      .describe("If is a valid sales or refund query"),
    reason: z.string().optional().describe("reason to reject"),
  }),
});

/**
 * salesReceptionInputGuardrail
 * Executes the guardrail check on user input. Blocks invalid queries
 * from reaching the sales agent by setting tripwireTriggered to true.
 */
const salesReceptionInputGuardrail = {
  name: "Sales and Refund Query Guardrail",
  execute: async ({ input }: { input: any }) => {
    // Run the guardrail agent on the input
    const result = await run(salesReceptionInputAgent, input);
    return {
      // Return rejection reason if any
      outputInfo: result.finalOutput?.reason,
      // tripwireTriggered: true blocks the query from proceeding to sales agent
      tripwireTriggered: !result.finalOutput?.isValidSalesOrRefundQuery,
    };
  },
};

// ============================================================================
// TOOLS: Actions Available to Agents
// ============================================================================

/**
 * fetchAvailablePlans
 * Tool that returns available internet broadband plans.
 * The sales agent can call this to show customers available options.
 */
const fetchAvailablePlans = tool({
  name: "fetch_available_plans",
  description: "fetches the available plans for internet",
  parameters: z.object({
    customerId: z.string().describe("id of the customer"),
  }),
  execute: async function ({ customerId }) {
    // Mock data: real implementation would query a database
    return [
      { plan_id: "1", price_inr: 399, speed: "30MB/s" },
      { plan_id: "2", price_inr: 999, speed: "100MB/s" },
      { plan_id: "3", price_inr: 1499, speed: "200MB/s" },
    ];
  },
});

/**
 * processRefund
 * Tool that processes refund requests for customers.
 * Appends refund details to a file for record-keeping.
 */
const processRefund = tool({
  name: "process_refund",
  description: `This tool processes the refund for a customer`,
  parameters: z.object({
    customerId: z.string().describe("id of the customer"),
    reason: z.string().describe("reason for refund"),
  }),
  execute: async function ({ customerId, reason }) {
    // Log the refund to a file for audit trail
    await fs.appendFile(
      "./refunds.txt",
      `Refund for Customer having ID ${customerId} for ${reason}`,
      "utf-8",
    );
    return { refundIssued: true };
  },
});

// ============================================================================
// SPECIALIZED AGENTS
// ============================================================================

/**
 * refundAgent
 * Specialized agent for handling refund-related requests.
 * Has access to the processRefund tool only.
 */
const refundAgent = new Agent({
  name: "Refund Agent",
  instructions: `You are expert in issuing refunds to the customer`,
  tools: [processRefund],
});

/**
 * salesAgent
 * Main agent that handles customer interactions for sales and refunds.
 * Features:
 *   - Access to available plans via fetchAvailablePlans tool
 *   - Can delegate to refundAgent via refund_expert tool
 *   - Uses inputGuardrails to validate queries before processing
 */
const salesAgent = new Agent({
  name: "Sales Agent",
  instructions: `
        You are an expert sales agent for an internet broadband comapny.
        Talk to the user and help them with what they need.
    `,
  tools: [
    // Allow sales agent to fetch available plans
    fetchAvailablePlans,
    // Allow sales agent to delegate to refund agent for refund issues
    refundAgent.asTool({
      toolName: "refund_expert",
      toolDescription: "Handles refund questions and requests.",
    }),
  ],
  // Validate all input queries through the guardrail before processing
  inputGuardrails: [salesReceptionInputGuardrail],
});

// ============================================================================
// CONVERSATION STATE & MAIN LOOP
// ============================================================================

// Flag to control the main conversation loop
let conversation = true;

// Flag to track if this is the first question (for UI display)
let firstQuestion = true;

/**
 * runAgent
 * Executes a single turn of the conversation.
 * - Prompts user for input (or uses default query on first run)
 * - Sends input through sales agent (with guardrails)
 * - Handles errors gracefully without crashing
 *
 * @param query - Default query to use if user enters "default"
 */
async function runAgent(query = "") {
  // Create readline interface for user input
  const rl = createInterface({ input, output });

  // Prompt user for their question
  const question = await rl.question(
    `Ask Question? ${firstQuestion ? "[default]" : ""} `,
  );
  await rl.close();

  // Update flag: no longer the first question
  firstQuestion = false;

  // Check if user wants to exit the conversation
  if (question.toLowerCase() === "exit") {
    conversation = false;
    console.log("Exiting conversation. Goodbye!");
    return;
  }

  // Try to run the sales agent with error handling
  try {
    // Execute the sales agent with user query
    const result = await run(
      salesAgent,
      // Use default query if user typed "default", otherwise use their input
      question === "default" ? query : question,
      {
        // Maintain conversation context across multiple interactions
        conversationId:
          "conv_69d5817ec19481939e21cc7c075f7d0d0d4193aa41c3b098",
      },
    );
    // Display agent's response to user
    console.log(result.finalOutput);
  } catch (err: any) {
    // Gracefully handle any errors from the agent
    // Extract and log the error reason (e.g., "query not related to sales/refunds")
    if (err) {
      console.error('Agent error:', err?.result?.output?.outputInfo);
    } else {
      console.error('Agent error:', String(err));
    }
    // Conversation continues despite the error
  }
}

/**
 * Main Conversation Loop
 * Continuously prompts the user for input until they type "exit".
 * First iteration uses a default query to demonstrate the agent's capabilities.
 */
while (conversation) {
  await runAgent(
    // Default query for first interaction - demonstrates a typical customer scenario
    `I had 5 users with the plan of 399.
    user1, user2, user3, user4 and user5.
    Also, I need to view plans for my internet connection for user 6.
    As all of them have upgraded to 999, I want to issue refund for the previous month.`,
  );
}
