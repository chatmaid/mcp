const DEFAULT_BASE_URL = "https://developers-api.chatmaid.net";

export interface ChatmaidClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatmaidError {
  type?: string;
  code?: string;
  message?: string;
  hint?: string;
}

export class ChatmaidApiError extends Error {
  public status: number;
  public error?: ChatmaidError;

  constructor(status: number, error?: ChatmaidError, fallback?: string) {
    super(error?.message || fallback || `HTTP ${status}`);
    this.name = "ChatmaidApiError";
    this.status = status;
    this.error = error;
  }
}

export class ChatmaidClient {
  private apiKey: string;
  private baseUrl: string;

  constructor({ apiKey, baseUrl }: ChatmaidClientOptions) {
    if (!apiKey) {
      throw new Error(
        "CHATMAID_API_KEY is required. Generate one in your Chatmaid dashboard at https://developers.chatmaid.net/dashboard/api-keys",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "@chatmaid/mcp",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? safeJson(text) : null;

    if (!response.ok) {
      const error = (data as { error?: ChatmaidError } | null)?.error;
      throw new ChatmaidApiError(response.status, error, text);
    }

    return data as T;
  }

  sendMessage(input: {
    from: string;
    to: string;
    content: string;
    idempotencyKey?: string;
  }) {
    return this.request<{ success: boolean; data: { messageId: string; status: string; createdAt: string } }>(
      "POST",
      "/v1/messages/send",
      input,
    );
  }

  listMessages(params: { limit?: number; status?: string; phoneNumberId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.phoneNumberId) qs.set("phoneNumberId", params.phoneNumberId);
    const query = qs.toString();
    return this.request<{ success: boolean; data: unknown[] }>(
      "GET",
      `/v1/messages${query ? `?${query}` : ""}`,
    );
  }

  getMessage(messageId: string) {
    return this.request<{ success: boolean; data: unknown }>(
      "GET",
      `/v1/messages/${encodeURIComponent(messageId)}`,
    );
  }

  listPhoneNumbers() {
    return this.request<{ success: boolean; data: unknown[] }>("GET", "/v1/phone-numbers");
  }

  getPhoneNumber(id: string) {
    return this.request<{ success: boolean; data: unknown }>(
      "GET",
      `/v1/phone-numbers/${encodeURIComponent(id)}`,
    );
  }

  getPhoneStatus(id: string) {
    return this.request<{ success: boolean; data: unknown }>(
      "GET",
      `/v1/phone-numbers/${encodeURIComponent(id)}/status`,
    );
  }

  getAccount() {
    return this.request<{ success: boolean; data: unknown }>("GET", "/v1/account");
  }

  getUsage() {
    return this.request<{ success: boolean; data: unknown }>("GET", "/v1/account/usage");
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
