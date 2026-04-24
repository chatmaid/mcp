#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ChatmaidApiError, ChatmaidClient } from "./client.js";

const apiKey = process.env.CHATMAID_API_KEY ?? process.env.CHATMAID_KEY;
const baseUrl = process.env.CHATMAID_BASE_URL;

if (!apiKey) {
  console.error(
    "[chatmaid-mcp] CHATMAID_API_KEY is required. Set it in your MCP client config (e.g. claude_desktop_config.json).",
  );
  process.exit(1);
}

const client = new ChatmaidClient({ apiKey, baseUrl });

// ---- Tool schemas ------------------------------------------------------
const sendMessageSchema = z.object({
  from: z
    .string()
    .describe("Sender phone number in E.164 format (e.g. +14155551234). Must be a connected phone in your Chatmaid account."),
  to: z
    .string()
    .describe("Recipient phone number in E.164 format (e.g. +14155559876)."),
  content: z.string().describe("The WhatsApp message text to send."),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Optional idempotency key to safely retry the same send."),
});

const listMessagesSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Maximum number of messages to return. Defaults to 20, max 100."),
  status: z
    .enum(["pending", "sent", "failed"])
    .optional()
    .describe("Filter by message status."),
  phoneNumberId: z
    .string()
    .optional()
    .describe("Only return messages sent from this phone number ID."),
});

const getMessageSchema = z.object({
  messageId: z.string().describe("The message ID returned from send_message."),
});

const getPhoneNumberSchema = z.object({
  id: z.string().describe("Phone number ID (not the raw number)."),
});

// ---- Tool definitions --------------------------------------------------
const tools: Tool[] = [
  {
    name: "send_message",
    description:
      "Send a WhatsApp message to a phone number via Chatmaid. Returns a message ID and initial status. Use E.164 format (+country code).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: sendMessageSchema.shape.from.description },
        to: { type: "string", description: sendMessageSchema.shape.to.description },
        content: { type: "string", description: sendMessageSchema.shape.content.description },
        idempotencyKey: {
          type: "string",
          description: sendMessageSchema.shape.idempotencyKey.description,
        },
      },
      required: ["from", "to", "content"],
    },
  },
  {
    name: "list_messages",
    description:
      "List recent WhatsApp messages sent via Chatmaid, optionally filtered by status or phone number.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: listMessagesSchema.shape.limit.description },
        status: {
          type: "string",
          enum: ["pending", "sent", "failed"],
          description: listMessagesSchema.shape.status.description,
        },
        phoneNumberId: {
          type: "string",
          description: listMessagesSchema.shape.phoneNumberId.description,
        },
      },
    },
  },
  {
    name: "get_message",
    description:
      "Fetch a single message by ID, including final delivery status and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: getMessageSchema.shape.messageId.description },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_phone_numbers",
    description:
      "List all phone numbers connected to the current Chatmaid account. Use this to discover which `from` values are available for sending.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_phone_number",
    description: "Get details about a single connected phone number.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: getPhoneNumberSchema.shape.id.description },
      },
      required: ["id"],
    },
  },
  {
    name: "get_phone_status",
    description:
      "Check whether a phone number is currently connected to WhatsApp and ready to send.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: getPhoneNumberSchema.shape.id.description },
      },
      required: ["id"],
    },
  },
  {
    name: "get_account",
    description: "Get current account information (name, email, plan).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_usage",
    description:
      "Get current usage stats for the account (messages sent this period, remaining quota).",
    inputSchema: { type: "object", properties: {} },
  },
];

// ---- Server --------------------------------------------------------------
const server = new Server(
  { name: "chatmaid-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    const result = await dispatch(name, args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: formatError(error),
        },
      ],
    };
  }
});

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "send_message":
      return client.sendMessage(sendMessageSchema.parse(args));
    case "list_messages":
      return client.listMessages(listMessagesSchema.parse(args));
    case "get_message":
      return client.getMessage(getMessageSchema.parse(args).messageId);
    case "list_phone_numbers":
      return client.listPhoneNumbers();
    case "get_phone_number":
      return client.getPhoneNumber(getPhoneNumberSchema.parse(args).id);
    case "get_phone_status":
      return client.getPhoneStatus(getPhoneNumberSchema.parse(args).id);
    case "get_account":
      return client.getAccount();
    case "get_usage":
      return client.getUsage();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function formatError(err: unknown): string {
  if (err instanceof ChatmaidApiError) {
    const parts = [
      `Chatmaid API error (${err.status}): ${err.message}`,
    ];
    if (err.error?.type) parts.push(`Type: ${err.error.type}`);
    if (err.error?.code) parts.push(`Code: ${err.error.code}`);
    if (err.error?.hint) parts.push(`Hint: ${err.error.hint}`);
    return parts.join("\n");
  }
  if (err instanceof z.ZodError) {
    return `Invalid arguments: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[chatmaid-mcp] listening on stdio");
}

main().catch((err) => {
  console.error("[chatmaid-mcp] fatal:", err);
  process.exit(1);
});
