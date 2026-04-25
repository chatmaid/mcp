# @chatmaid/mcp

MCP server for the [Chatmaid WhatsApp Developers API](https://developers.chatmaid.net). Send WhatsApp messages and manage your account from Claude Code, Cursor, Windsurf, Claude Desktop, and any other MCP-compatible AI client.

## Install

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

## Environment variables

| Variable              | Required | Description                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------------- |
| `CHATMAID_API_KEY`    | Yes      | Your API key. Use `sk_test_*` for sandbox, `sk_live_*` for production.              |
| `CHATMAID_BASE_URL`   | No       | Override the API base URL. Defaults to `https://developers-api.chatmaid.net`.       |

Get a key at <https://developers.chatmaid.net/dashboard/api-keys>.

## Tools

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `send_message`       | Send a WhatsApp message: `fromPhoneId` (use `list_phone_numbers` to find), `to` in E.164, plus `content` and/or `mediaUrls`, optional `idempotencyKey`. |
| `list_messages`      | List recent messages, optionally filtered by `status`, `phoneNumberId`, with `page`/`limit` pagination. |
| `get_message`        | Fetch a message by ID, including final status and timestamps.               |
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
- "How much of my WhatsApp quota have I used this month?"

The agent will call the right tool automatically.

## Safety

- Always use `sk_test_*` keys when prototyping with agents. Messages sent with test keys are simulated end-to-end through Chatmaid's sandbox — nothing goes out to WhatsApp.
- Promote to `sk_live_*` only when you've confirmed the agent's behavior.

## Source

Open-source at [github.com/chatmaid/mcp](https://github.com/chatmaid/mcp). PRs welcome.

## License

MIT © Chatmaid
