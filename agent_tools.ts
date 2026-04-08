// ---------------------------------------------------------------------------
// Agent Tools Example
// ---------------------------------------------------------------------------
// Demonstrates how to create reusable tools (getWeather, sendEmail) and
// expose them to an agent. The agent can call these tools during execution.

import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import axios from "axios";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';

// Load environment variables from .env into process.env
dotenv.config();


// Example: a schema for structured weather results could be defined with Zod
// const GetWeatherResultSchema = z.object({
//   city: z.string().describe("name of the city"),
//   degree_c: z.number().describe("the degree celcius of the temp"),
//   condition: z.string().optional().describe("condition of the weather"),
// });


/**
 * getWeatherTool
 * Fetches a human-readable weather string from wttr.in. In production you may
 * prefer a proper weather API and return structured data instead of plain text.
 */
const getWeatherTool = tool({
  name: "get_weather",
  description: "returns the current weather information for the given city",
  parameters: z.object({
    city: z.string().describe("name of the city"),
  }),
  execute: async function ({ city }) {
    const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t`;
    const response = await axios.get(url, { responseType: "text" });
    return `The weather of ${city} is ${response.data}`;
  },
});


/**
 * sendEmailTool
 * A mock email-sending tool. Replace the implementation with a call to your
 * email provider (SendGrid, SES, etc.) if you want to actually deliver mail.
 */
const sendEmailTool = tool({
  name: "send_email",
  description: "This tool sends an email",
  parameters: z.object({
    toEmail: z.string().describe("email address to"),
    subject: z.string().describe("subject"),
    body: z.string().describe("body of the email"),
  }),
  execute: async function ({ body, subject, toEmail }) {
    console.log(`Sending email to ${toEmail} with subject "${subject}" and body "${body}"`);
    // Here you would implement the actual email sending logic using an email service provider's API.
    // For this example, we'll just log the email details to the console.
    return `Email sent to ${toEmail} with subject "${subject}"`;
  },
});


// Agent that can call both tools
const agent = new Agent({
  name: "Weather Agent",
  instructions: `
        You are an expert weather agent that helps user to tell weather report of single or multiple cities. You can also send email to the user if they want to share the weather report with someone else.
    `,
  tools: [getWeatherTool, sendEmailTool],
  // outputType: GetWeatherResultSchema,
});


// Simple interactive runner that prompts the user and runs the agent
async function main(query = "") {
  const rl = createInterface({ input, output });
  const name = await rl.question('Ask me about the weather of any city: ');
  await rl.close();
  const result = await run(agent, name);
  console.log(`Result:`, result.finalOutput);
}

main();
