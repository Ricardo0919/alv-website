// Vacío = mismo dominio del frontend (Next.js reenvía /api al backend, ver next.config.ts)
const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const API_URL = `${BASE}/api`;
const TOKEN_KEY = "alv_token";

// --- Tipos ---

export type InteractionType = "ADD" | "REMOVAL" | "GIFT" | "CONVERSATION" | "CALL";

export interface InteractionInput {
  type: Exclude<InteractionType, "GIFT">;
  count_or_duration: number;
  batch_quantity?: number;
  reason?: string;
}

/** Un movimiento del historial. */
export interface Interaction {
  id: number;
  type: InteractionType;
  count_or_duration: number;
  reason: string;
  gift_from: string | null;
  crumbs: number;
  created_at: string;
}

export interface Stats {
  username: string;
  total_crumbs: number;
  goal: number;
  percent: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  goal: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type CrumbRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface CrumbRequest {
  id: number;
  sender: string;
  recipient: string;
  crumbs: number;
  reason: string;
  status: CrumbRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_crumbs: number;
  goal: number;
  percent: number;
  goal_reached_at: string | null;
  is_me: boolean;
}

export interface FriendRequest {
  id: number;
  from_user: string;
  to_user: string;
  status: "PENDING" | "ACCEPTED";
  created_at: string;
}

export type Relationship = "self" | "none" | "friends" | "pending_sent" | "pending_received";

export interface PendingCounts {
  pending: number;
  crumb_requests: number;
  friend_requests: number;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
    /** Código del backend, p. ej. "goal_reached" */
    public code?: string,
  ) {
    super(message);
  }
}

// --- Token ---

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Se dispara cuando el backend rechaza el token (expirado / revocado)
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

// --- Cliente HTTP ---

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const data = body as Record<string, unknown>;
    if (typeof data.detail === "string") {
      return new ApiError(status, data.detail, {}, typeof data.code === "string" ? data.code : undefined);
    }

    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    const first = fields.non_field_errors?.[0] ?? Object.values(fields)[0]?.[0];
    return new ApiError(status, first ?? "Ocurrió un error.", fields);
  }
  return new ApiError(status, "Ocurrió un error inesperado.");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Token ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "No pudimos conectar con el servidor.");
  }

  if (res.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized?.();
  }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

// --- Endpoints ---

export const api = {
  register: (data: { username: string; password: string; email?: string }) =>
    request<AuthResponse>("/auth/register/", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { username: string; password: string }) =>
    request<AuthResponse>("/auth/login/", { method: "POST", body: JSON.stringify(data) }),

  logout: () => request<void>("/auth/logout/", { method: "POST" }),

  me: () => request<User>("/auth/me/"),

  updateGoal: (goal: number) => request<User>("/auth/me/", { method: "PATCH", body: JSON.stringify({ goal }) }),

  stats: () => request<Stats>("/stats/"),

  // Perfil público de solo lectura (no requiere sesión)
  publicProfile: (username: string) => request<Stats>(`/users/${encodeURIComponent(username)}/`),

  // --- Regalar migajas / notificaciones ---

  // Envía una solicitud: no suma nada hasta que el destinatario la acepta
  sendCrumbRequest: (username: string, crumbs: number, reason: string) =>
    request<CrumbRequest>(`/users/${encodeURIComponent(username)}/requests/`, {
      method: "POST",
      body: JSON.stringify({ crumbs, reason }),
    }),

  crumbRequests: (status?: CrumbRequestStatus) =>
    request<Page<CrumbRequest>>(`/requests/${status ? `?status=${status}` : ""}`),

  pendingRequestsCount: () => request<PendingCounts>("/requests/pending-count/"),

  resolveCrumbRequest: (id: number, action: "accept" | "reject") =>
    request<{ request: CrumbRequest; total_crumbs: number }>(`/requests/${id}/${action}/`, { method: "POST" }),

  // --- Amigos ---

  leaderboard: () => request<LeaderboardEntry[]>("/friends/"),

  friendRequests: () => request<{ received: FriendRequest[]; sent: FriendRequest[] }>("/friends/requests/"),

  sendFriendRequest: (username: string) =>
    request<FriendRequest>("/friends/requests/", { method: "POST", body: JSON.stringify({ username }) }),

  respondFriendRequest: (id: number, action: "accept" | "reject") =>
    request<FriendRequest | undefined>(`/friends/requests/${id}/${action}/`, { method: "POST" }),

  cancelFriendRequest: (id: number) => request<void>(`/friends/requests/${id}/`, { method: "DELETE" }),

  removeFriend: (username: string) => request<void>(`/friends/${encodeURIComponent(username)}/`, { method: "DELETE" }),

  relationship: (username: string) =>
    request<{ status: Relationship; request_id: number | null }>(`/friends/status/${encodeURIComponent(username)}/`),

  // Historial propio, 50 por página (más reciente primero)
  history: (page = 1) => request<Page<Interaction>>(`/interactions/?page=${page}`),

  // Todas las interacciones viajan en una sola petición (una transacción en el backend)
  logInteractions: (items: InteractionInput[]) =>
    request<{ total_crumbs: number }>("/interactions/batch/", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
