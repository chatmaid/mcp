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
const sendMessageSchema = z
  .object({
    fromPhoneId: z
      .string()
      .describe(
        "ID of a phone number registered in your Chatmaid account (use list_phone_numbers to discover IDs). NOT the raw phone number.",
      ),
    to: z
      .string()
      .describe("Recipient phone number in E.164 format (e.g. +14155559876)."),
    content: z
      .string()
      .max(4096)
      .optional()
      .describe("Text body of the WhatsApp message. Required if mediaUrls is empty. Max 4096 characters."),
    mediaUrls: z
      .array(z.string().url())
      .optional()
      .describe("Public HTTPS URLs of media to attach. Required if content is empty. Combine with content for a captioned media message."),
    idempotencyKey: z
      .string()
      .max(64)
      .optional()
      .describe("Optional idempotency key (max 64 chars) so retries return the original message instead of sending a duplicate."),
  })
  .refine((v) => v.content || (v.mediaUrls && v.mediaUrls.length > 0), {
    message: "Provide either `content` or at least one entry in `mediaUrls`.",
  });

const listMessagesSchema = z.object({
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Page number (1-based). Defaults to 1."),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Items per page. Defaults to 20, max 100."),
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
  messageId: z.string().describe("The message ID returned from send_message (e.g. msg_abc123)."),
});

const phoneRefSchema = z.object({
  id: z
    .string()
    .describe(
      "Either the phone's internal ID, or its E.164 number (e.g. +14155551234). The MCP server URL-encodes the value before calling the API.",
    ),
});

const getUsageSchema = z.object({
  period: z
    .enum(["day", "week", "month"])
    .optional()
    .describe("Reporting window. Defaults to month."),
});

// ---- Tool definitions --------------------------------------------------
const tools: Tool[] = [
  {
    name: "send_message",
    description:
      "Send a WhatsApp message via Chatmaid from one of the account's connected phones. Returns the full message resource (`id`, `status`, timestamps). Use list_phone_numbers first to find a valid `fromPhoneId`.",
    inputSchema: {
      type: "object",
      properties: {
        fromPhoneId: {
          type: "string",
          description:
            "ID of a phone number registered in your Chatmaid account (use list_phone_numbers to discover IDs). NOT the raw phone number.",
        },
        to: {
          type: "string",
          description: "Recipient phone number in E.164 format (e.g. +14155559876).",
        },
        content: {
          type: "string",
          description:
            "Text body of the WhatsApp message. Required if mediaUrls is empty. Max 4096 characters.",
        },
        mediaUrls: {
          type: "array",
          items: { type: "string" },
          description:
            "Public HTTPS URLs of media to attach. Required if content is empty. Combine with content for a captioned media message.",
        },
        idempotencyKey: {
          type: "string",
          description:
            "Optional idempotency key (max 64 chars) so retries return the original message instead of sending a duplicate.",
        },
      },
      required: ["fromPhoneId", "to"],
    },
  },
  {
    name: "list_messages",
    description:
      "List recent WhatsApp messages with offset/limit pagination, optionally filtered by status or sender phone number ID. Response includes a `pagination` block.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (1-based). Defaults to 1." },
        limit: { type: "number", description: "Items per page. Defaults to 20, max 100." },
        status: {
          type: "string",
          enum: ["pending", "sent", "failed"],
          description: "Filter by message status.",
        },
        phoneNumberId: {
          type: "string",
          description: "Only return messages sent from this phone number ID.",
        },
      },
    },
  },
  {
    name: "get_message",
    description:
      "Fetch a single message by ID, including final delivery status and timestamps (createdAt, sentAt, failedAt).",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID returned from send_message (e.g. msg_abc123).",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_phone_numbers",
    description:
      "List all phone numbers registered to the current Chatmaid account (scoped to the API key's environment). Returned `id` values are valid `fromPhoneId` arguments for send_message.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_phone_number",
    description:
      "Get details about a single registered phone number. Accepts either the internal phone ID or an E.164 number.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "Either the phone's internal ID, or its E.164 number (e.g. +14155551234).",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_phone_status",
    description:
      "Check whether a phone number is currently connected to WhatsApp and ready to send. Accepts either the internal phone ID or an E.164 number.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "Either the phone's internal ID, or its E.164 number (e.g. +14155551234).",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_account",
    description: "Get current account profile (accountId, name, email, subscriptionStatus, aggregate stats).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_usage",
    description:
      "Get usage stats for the account over a window (day, week, or month). Returns message and API request counters.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Reporting window. Defaults to month.",
        },
      },
    },
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
      return client.getPhoneNumber(phoneRefSchema.parse(args).id);
    case "get_phone_status":
      return client.getPhoneStatus(phoneRefSchema.parse(args).id);
    case "get_account":
      return client.getAccount();
    case "get_usage":
      return client.getUsage(getUsageSchema.parse(args));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function formatError(err: unknown): string {
  if (err instanceof ChatmaidApiError) {
    const parts = [`Chatmaid API error (${err.status}): ${err.message}`];
    if (err.envelope?.path) parts.push(`Path: ${err.envelope.path}`);
    if (err.envelope?.retryAfter !== undefined) {
      parts.push(`Retry after: ${err.envelope.retryAfter}s`);
    }
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
