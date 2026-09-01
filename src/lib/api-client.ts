// Cliente HTTP para a API propria do Prospectar -- substitui o supabase-js.
// Mesmo padrao do concorrentes: token em localStorage, injetado como
// Bearer em toda chamada. Diferenca daqui: nao ha SSR (SPA pura), entao
// sem o desvio de base URL para 127.0.0.1.

const TOKEN_KEY = "pk_auth_token";
const EVENT = "pk:auth-changed";
const BASE = "/api";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function onAuthChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!res.ok) {
    const msg = (body as { detail?: string } | null)?.detail ?? `Erro ${res.status}`;
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body as T;
}

// ----- Auth -----
export type ApiUser = { id: string; email: string; nome: string };
export type Papel = "admin" | "supervisor" | "agent";
export type ApiSession = { user: ApiUser; role: Papel; is_approved: boolean; full_name: string | null };

let cachedMe: Promise<ApiSession | null> | null = null;
function invalidateMe() { cachedMe = null; }

export async function getSession(): Promise<ApiSession | null> {
  if (!getToken()) return null;
  if (!cachedMe) {
    cachedMe = apiFetch<{ usuario: ApiUser; perfil: { role: Papel; is_approved: boolean; full_name: string | null } }>("/auth/me")
      .then((r) => ({ user: r.usuario, role: r.perfil.role, is_approved: r.perfil.is_approved, full_name: r.perfil.full_name }))
      .catch(() => null);
  }
  return cachedMe;
}

export async function signInWithPassword(email: string, senha: string) {
  const r = await apiFetch<{ token: string; usuario: ApiUser }>("/auth/login", {
    method: "POST", body: JSON.stringify({ email, senha }),
  });
  setToken(r.token); invalidateMe();
  return r;
}

export async function signUp(email: string, senha: string, nome?: string) {
  const r = await apiFetch<{ token: string; usuario: ApiUser; role: Papel }>("/auth/signup", {
    method: "POST", body: JSON.stringify({ email, senha, nome }),
  });
  setToken(r.token); invalidateMe();
  return r;
}

export function signOut(): void {
  setToken(null); invalidateMe();
}
