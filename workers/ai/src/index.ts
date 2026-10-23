import { verifyFirebaseTokens } from './tokens';
import { MODEL, providerInput, type Operation } from './policy';
import { ApiError, json, readJSON, type Env } from './types';
export { AIQuota } from './quota';

function configured(env: Env) {
  if (env.AI_ENABLED !== 'true' || env.AI_FREE_TIER_VERIFIED !== 'true' || env.GEMINI_MODEL !== MODEL || !env.GEMINI_API_KEY ||
      !/^[a-z][a-z0-9-]{4,62}$/.test(env.FIREBASE_PROJECT_ID) || !/^\d{6,20}$/.test(env.FIREBASE_PROJECT_NUMBER) ||
      !env.FIREBASE_APP_IDS?.split(',').every(id => id.trim().startsWith('1:' + env.FIREBASE_PROJECT_NUMBER + ':')) || !env.AI_QUOTA) {
    throw new ApiError(503, 'unavailable', 'AI is not activated. Offline summaries and Help remain available.');
  }
}

async function execute(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) throw new ApiError(403, 'permission-denied', 'Origin not allowed.');
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.search) throw new ApiError(400, 'invalid-argument', 'HTTPS without query parameters required.');
  const operation = url.pathname.slice(1);
  if (operation === 'verifyTokens') {
    const until = Date.parse(env.TOKEN_VERIFICATION_UNTIL ?? '');
    const remaining = until - Date.now();
    // Explicit, short-lived test window; verification cannot coexist with AI activation.
    if (env.TOKEN_VERIFICATION_ENABLED !== 'true' || !Number.isFinite(until) || remaining <= 0 || remaining > 3600000 ||
        env.AI_ENABLED !== 'false' || env.AI_FREE_TIER_VERIFIED !== 'false') {
      return json({ ok: false }, 404);
    }
    if (request.method !== 'POST') return json({ ok: false }, 405);
    // No request body, Gemini configuration, quota reservation, or financial access.
    if (request.body !== null) return json({ ok: false }, 400);
    try {
      await verifyFirebaseTokens(request, env);
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false }, error instanceof ApiError && error.status === 401 ? 401 : 503);
    }
  }
  if (operation !== 'supportChat' && operation !== 'explainInsights') throw new ApiError(404, 'not-found', 'Endpoint not found.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') throw new ApiError(405, 'invalid-argument', 'POST required.');
  configured(env);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) throw new ApiError(415, 'invalid-argument', 'JSON required.');
  const uid = await verifyFirebaseTokens(request, env);
  let raw: unknown;
  try { raw = await readJSON(request); } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid-argument', 'Invalid JSON.');
  }
  const input = providerInput(operation as Operation, raw);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
  const owner = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  // Never shard or rename this instance: both endpoints/accounts must share one cap.
  const quota = env.AI_QUOTA.get(env.AI_QUOTA.idFromName('global-v1'));
  const reservation = await quota.fetch(new Request('https://quota/reserve', { method: 'POST', body: JSON.stringify({ action: 'reserve', operation, owner }) }));
  const usage = await reservation.json() as { retryAfter?: number; day?: string };
  if (reservation.status === 429) throw new ApiError(429, 'resource-exhausted', 'AI usage is paused. Offline summaries still work.', usage.retryAfter ?? 86400);
  if (!reservation.ok || !usage.day) throw new ApiError(503, 'unavailable', 'Usage verification unavailable. No AI request was sent.');
  // Attempts are consumed even on failure; no refunds, retries, tools, or fallback.
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: input.instruction }] }, contents: input.contents,
      generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingLevel: 'low' } } }),
  });
  if (response.status === 429) {
    const blocked = await quota.fetch(new Request('https://quota/block', { method: 'POST', body: JSON.stringify({ action: 'block', day: usage.day }) }));
    if (!blocked.ok) throw new ApiError(503, 'unavailable', 'AI quota storage unavailable.');
    throw new ApiError(429, 'resource-exhausted', 'Gemini quota exhausted. Offline summaries remain available.', 86400);
  }
  if (!response.ok) throw new ApiError(503, 'unavailable', 'Gemini is unavailable. Offline summaries remain available.');
  const result = await readJSON(response, 65536) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = result.candidates?.[0]?.content?.parts?.map(part => typeof part.text === 'string' ? part.text : '').join('').trim();
  if (!text) throw new ApiError(503, 'unavailable', 'No explanation available. Offline summaries remain available.');
  return json({ text: text.slice(0, 2000) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try { response = await execute(request, env); } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError(503, 'unavailable', 'AI unavailable. Use offline Insights and Help.');
      response = json({ error: { code: safe.code, message: safe.message } }, safe.status, safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    }
    const origin = request.headers.get('Origin');
    if (origin && (env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
      response.headers.set('Access-Control-Expose-Headers', 'Retry-After');
      response.headers.set('Vary', 'Origin');
    }
    return response;
  },
};
