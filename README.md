# @chatmaid/mcp

[![npm](https://img.shields.io/npm/v/@chatmaid/mcp)](https://www.npmjs.com/package/@chatmaid/mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.github.chatmaid%2Fmcp-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.chatmaid/mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

MCP server for the [Chatmaid WhatsApp Developers API](https://www.chatmaid.net/developers). Send WhatsApp messages to contacts and groups, read the replies, and check delivery from Claude Code, Cursor, Windsurf, Claude Desktop, VS Code, and any other MCP-compatible AI client.

- Docs: [chatmaid.net/docs/mcp](https://www.chatmaid.net/docs/mcp)
- API keys: [developers.chatmaid.net](https://developers.chatmaid.net/dashboard/api-keys)
- Chatmaid: [chatmaid.net](https://www.chatmaid.net)

## Install

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=chatmaid&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBjaGF0bWFpZC9tY3AiXSwiZW52Ijp7IkNIQVRNQUlEX0FQSV9LRVkiOiJza190ZXN0X3h4eCJ9fQ%3D%3D)

Every client runs the same command, `npx -y @chatmaid/mcp`, with your API key in `CHATMAID_API_KEY`. Replace `sk_test_xxx` with your key after installing.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "chatmaid": {
      "command": "npx",
      "args": ["-y", "@chatmaid/mcp"],
      "env": {
        "CHATMAID_API_KEY": "sk_test_xxx_or_sk_live_xxx"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chatmaid": {
      "command": "npx",
      "args": ["-y", "@chatmaid/mcp"],
      "env": { "CHATMAID_API_KEY": "sk_test_xxx_or_sk_live_xxx" }
    }
  }
}
```

### Claude Code / CLI

```bash
claude mcp add chatmaid \
  --env CHATMAID_API_KEY=sk_test_xxx \
  -- npx -y @chatmaid/mcp
```

### VS Code

Add to `.vscode/mcp.json` (VS Code prompts for the key and stores it securely):

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "chatmaid-api-key",
      "description": "Chatmaid API key (sk_test_* or sk_live_*)",
      "password": true
    }
  ],
  "servers": {
    "chatmaid": {
      "command": "npx",
      "args": ["-y", "@chatmaid/mcp"],
      "env": { "CHATMAID_API_KEY": "${input:chatmaid-api-key}" }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "chatmaid": {
      "command": "npx",
      "args": ["-y", "@chatmaid/mcp"],
      "env": { "CHATMAID_API_KEY": "sk_test_xxx_or_sk_live_xxx" }
    }
  }
}
```

## Environment variables

| Variable              | Required | Description                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------------- |
| `CHATMAID_API_KEY`    | Yes      | Your API key. Use `sk_test_*` for sandbox, `sk_live_*` for production.              |
| `CHATMAID_BASE_URL`   | No       | Override the API base URL. Defaults to `https://developers-api.chatmaid.net`.       |

Get a key at <https://developers.chatmaid.net/dashboard/api-keys>.

## Tools

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `send_message`       | Send a WhatsApp message: `fromPhoneId` (use `list_phone_numbers` to find), `to` as an E.164 number or a group JID (from `list_groups`), plus `content` and/or `mediaUrls`, optional `idempotencyKey`. |
| `list_groups`        | List the WhatsApp groups a connected phone can post to; returned `id` values are group JIDs usable as `to` in `send_message`. |
| `list_messages`      | List recent messages, optionally filtered by `status`, `phoneNumberId`, with `page`/`limit` pagination. |
| `get_message`        | Fetch a message by ID, including final status and timestamps.               |
| `list_inbound_messages` | List messages received by your connected phone numbers (live only), optionally filtered by `phoneNumberId`, with `page`/`limit` pagination. |
| `get_inbound_message` | Fetch an inbound (received) message by ID (`inmsg_xxx`).                   |
| `list_phone_numbers` | List phone numbers registered to the account (scoped to your API key environment). |
| `get_phone_number`   | Get details for a single phone number. Accepts internal ID or E.164.        |
| `get_phone_status`   | Check if a phone number is currently connected to WhatsApp. Accepts internal ID or E.164. |
| `get_account`        | Get current account info (accountId, name, email, subscription status).     |
| `get_usage`          | Get usage stats for `period` = `day` \| `week` \| `month` (defaults to month). |

## Example prompts

Once installed, you can ask your agent things like:

- "Send a WhatsApp message from my business number to +14155551234 saying the order has shipped."
- "What phone numbers are connected to my Chatmaid account?"
- "Check if message `msg_abc123` was delivered."
- "Show me the latest messages received on my business number."
- "How much of my WhatsApp quota have I used this month?"

The agent will call the right tool automatically.

## Safety

- Always use `sk_test_*` keys when prototyping with agents. Messages sent with test keys are simulated end-to-end through Chatmaid's sandbox — nothing goes out to WhatsApp.
- Promote to `sk_live_*` only when you've confirmed the agent's behavior.

## Source

Open-source at [github.com/chatmaid/mcp](https://github.com/chatmaid/mcp). PRs welcome. Listed in the official [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.chatmaid/mcp`.

## License

MIT © Chatmaid
