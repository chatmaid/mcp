const DEFAULT_BASE_URL = "https://developers-api.chatmaid.net";

export interface ChatmaidClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatmaidErrorEnvelope {
  success: false;
  error: string;
  message: string[];
  statusCode: number;
  timestamp?: string;
  path?: string;
  retryAfter?: number;
}

export class ChatmaidApiError extends Error {
  public status: number;
  public envelope?: ChatmaidErrorEnvelope;

  constructor(status: number, envelope?: ChatmaidErrorEnvelope, fallback?: string) {
    const summary =
      envelope?.message && envelope.message.length > 0
        ? envelope.message.join("; ")
        : envelope?.error || fallback || `HTTP ${status}`;
    super(summary);
    this.name = "ChatmaidApiError";
    this.status = status;
    this.envelope = envelope;
  }
}

/** Stable error codes returned on a failed message (present when status is "failed"). */
export type MessageErrorCode =
  | "NOT_CONNECTED"
  | "INVALID_RECIPIENT"
  | "RECIPIENT_NOT_REACHABLE"
  | "NOT_GROUP_MEMBER"
  | "RATE_LIMITED"
  | "NOT_AUTHORIZED"
  | "MEDIA_ERROR"
  | "TIMEOUT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface MessageResource {
  id: string;
  from: string;
  to: string;
  isGroup: boolean;
  groupId: string | null;
  content: string | null;
  mediaUrls: string[];
  environment: "test" | "live";
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  errorCode: MessageErrorCode | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
}

export interface InboundMessageResource {
  id: string;
  from: string;
  to: string;
  content: string | null;
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "location"
    | "contact"
    | "other";
  isGroup: boolean;
  groupId: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface PhoneNumberResource {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  environment: "test" | "live";
  connectionStatus: "connected" | "disconnected" | "connecting";
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupResource {
  id: string; // Full group JID (…@g.us) — valid `to` for send_message
  name: string;
  isCommunityAnnounce: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
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
      const envelope = isErrorEnvelope(data) ? data : undefined;
      throw new ChatmaidApiError(response.status, envelope, typeof text === "string" ? text : undefined);
    }

    return data as T;
  }

  sendMessage(input: {
    fromPhoneId: string;
    to: string;
    content?: string;
    mediaUrls?: string[];
    idempotencyKey?: string;
  }) {
    return this.request<ApiSuccess<MessageResource>>("POST", "/v1/messages/send", input);
  }

  listMessages(params: {
    page?: number;
    limit?: number;
    status?: "pending" | "sent" | "delivered" | "read" | "failed";
    phoneNumberId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.phoneNumberId) qs.set("phoneNumberId", params.phoneNumberId);
    const query = qs.toString();
    return this.request<ApiSuccess<PaginatedResponse<MessageResource>>>(
      "GET",
      `/v1/messages${query ? `?${query}` : ""}`,
    );
  }

  getMessage(messageId: string) {
    return this.request<ApiSuccess<MessageResource>>(
      "GET",
      `/v1/messages/${encodeURIComponent(messageId)}`,
    );
  }

  listInboundMessages(params: {
    page?: number;
    limit?: number;
    phoneNumberId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.phoneNumberId) qs.set("phoneNumberId", params.phoneNumberId);
    const query = qs.toString();
    return this.request<ApiSuccess<PaginatedResponse<InboundMessageResource>>>(
      "GET",
      `/v1/messages/inbound${query ? `?${query}` : ""}`,
    );
  }

  getInboundMessage(messageId: string) {
    return this.request<ApiSuccess<InboundMessageResource>>(
      "GET",
      `/v1/messages/inbound/${encodeURIComponent(messageId)}`,
    );
  }

  listGroups(params: { fromPhoneId: string }) {
    const qs = new URLSearchParams({ fromPhoneId: params.fromPhoneId });
    return this.request<ApiSuccess<GroupResource[]>>(
      "GET",
      `/v1/groups?${qs.toString()}`,
    );
  }

  listPhoneNumbers() {
    return this.request<ApiSuccess<PhoneNumberResource[]>>("GET", "/v1/phone-numbers");
  }

  getPhoneNumber(idOrE164: string) {
    return this.request<ApiSuccess<PhoneNumberResource>>(
      "GET",
      `/v1/phone-numbers/${encodeURIComponent(idOrE164)}`,
    );
  }

  getPhoneStatus(idOrE164: string) {
    return this.request<ApiSuccess<Pick<PhoneNumberResource, "id" | "phoneNumber" | "connectionStatus" | "lastConnectedAt" | "lastDisconnectedAt" | "updatedAt">>>(
      "GET",
      `/v1/phone-numbers/${encodeURIComponent(idOrE164)}/status`,
    );
  }

  getAccount() {
    return this.request<ApiSuccess<unknown>>("GET", "/v1/account");
  }

  getUsage(params: { period?: "day" | "week" | "month" } = {}) {
    const qs = new URLSearchParams();
    if (params.period) qs.set("period", params.period);
    const query = qs.toString();
    return this.request<ApiSuccess<unknown>>(
      "GET",
      `/v1/account/usage${query ? `?${query}` : ""}`,
    );
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isErrorEnvelope(value: unknown): value is ChatmaidErrorEnvelope {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.success === false && typeof obj.error === "string";
}
