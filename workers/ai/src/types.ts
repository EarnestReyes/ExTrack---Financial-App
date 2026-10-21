// Narrow structural interfaces for the Cloudflare APIs used here; no runtime SDK.
export interface KVTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
export interface QuotaStorage extends KVTransaction {
  transaction<T>(callback: (tx: KVTransaction) => Promise<T>): Promise<T>;
}
export interface QuotaState { storage: QuotaStorage }
export interface QuotaNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
export interface Env {
  AI_QUOTA: QuotaNamespace;
  GEMINI_API_KEY?: string;
  AI_ENABLED: string;
  AI_FREE_TIER_VERIFIED: string;
  GEMINI_MODEL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PROJECT_NUMBER: string;
  FIREBASE_APP_IDS: string;
  ALLOWED_ORIGINS?: string;
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter = 0) { super(message); }
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

export async function readJSON(request: Request | Response, maximum = 32768): Promise<unknown> {
  const declared = request.headers.get('Content-Length');
  if (declared && Number(declared) > maximum) throw new ApiError(413, 'invalid-argument', 'Request too large.');
  if (!request.body) throw new ApiError(400, 'invalid-argument', 'JSON required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const value = chunk.value;
      length += value.length;
      if (length > maximum) { await reader.cancel(); throw new ApiError(413, 'invalid-argument', 'Request too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}
