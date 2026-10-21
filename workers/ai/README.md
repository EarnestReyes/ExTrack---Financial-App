# ExTrack AI Worker — inactive preparation

Separate endpoints: `POST /supportChat` and `POST /explainInsights`. No deployment, secret creation, billing activation, Wrangler installation, or provider call was performed. The existing Firebase Functions implementation is unchanged and remains available separately. There is no automatic fallback to Firebase when the Worker fails.

## Security and reuse

- Reuses the existing pure `supportMessages` validator from `functions/src/utils/validation.ts`; preserves its bounded conversation contract, consent/policy marker, model, output cap, and qualitative-summary vocabulary.
- Only `gemini-2.5-flash-lite` is permitted. Its key comes exclusively from the Worker `GEMINI_API_KEY` secret binding, never public Expo settings or Wrangler vars.
- Verifies Firebase ID-token RS256 signatures with Google's pinned securetoken public JWKS. Checks algorithm, key ID, type, issuer, audience, subject, expiry, issued-at/authentication times and lifetime. External token-supplied signing URLs/keys are rejected. Multi-tenant tokens are intentionally unsupported.
- Separately verifies App Check RS256 signatures, type, expiry, issuer, project-number audience and allowed app IDs using Firebase's pinned App Check JWKS. Public keys are cached within bounded rotation TTLs. There is no unsigned/debug fallback. A valid token's signature/claims are required, not merely the presence of a header.
- Cryptographic verification works in local tests with signed synthetic RSA tokens. **No real device App Check token or deployed Worker has been verified.** Do not describe the current mobile app as having working production App Check protection yet.
- Ordinary signature verification does not perform immediate Firebase account revocation checks or consume App Check tokens for replay protection. ID tokens are limited to normal one-hour lifetimes; these endpoints cannot retrieve or mutate financial records. Tokens must still be kept confidential.
- All calls require explicit consent and `policyVersion: "free-tier-v1"`. HTTP body size is bounded, unknown fields are rejected, CORS is allowlisted for web, and HTTPS without query parameters is required. CORS is not authentication. Native requests without an Origin header still require both tokens.
- Support text reaches the ExTrack gateway but **never Gemini**: the gateway selects one fixed public help topic. This deliberately limits contextual free-form support to avoid forwarding names, account credentials or transaction details. The provider receives neither conversation history nor user/model text.
- Explanations receive only `cashFlow`, `spendingPattern`, `savingsActivity`, and `loanAttention` allowlisted labels after the existing preview/consent dialog. All amounts/calculations remain in trusted local code. No account IDs, raw records, custom category names, files or dates are forwarded.
- No deliberate prompt/token/response logging, tools, retries, paid-model switching, or credential forwarding. Network/provider/attestation/storage failures return sanitized errors; offline Insights remain available.

## Atomic storage and free-plan compatibility

`AI_QUOTA` must bind to the **SQLite-backed** `AIQuota` Durable Object. Wrangler's `new_sqlite_classes` migration creates this separate quota namespace; no existing SQLite, Firestore, financial schema or record changes are needed. Do not substitute legacy KV-backed Durable Objects, Workers KV, or isolate memory.

Both endpoints use exactly one object ID, `global-v1`. Its storage transaction atomically reserves per-operation minute counters, shared per-user daily counts and the global daily count before fetching Gemini. Failed attempts are consumed. Limits remain 5/minute/operation/user, 5 provider attempts/user/UTC day, and 20 globally/UTC day. UID hashes, counts and windows are stored; no prompts or financial records. Only a bounded daily record is retained. Renaming the Worker/namespace/object or deleting storage can reset limits and must not be done during an active quota day.

HTTP 429 from Gemini persists a global daily circuit in the same object. Storage failures fail closed. Previously reserved concurrent requests can finish, but cannot exceed the global cap. The mobile client conservatively pauses until the next UTC day after any quota response; no reset-time retry is scheduled.

Cloudflare currently permits SQLite-backed Durable Objects on Workers Free; exceeding free limits fails operations instead of requiring an upgrade. Its documented free allowances include 100,000 DO requests/day, 13,000 GB-s/day, 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Workers has separate limits, including 100,000 requests/day and a tight CPU allowance. Counters do not prevent an attacker exhausting the platform's request allowance. Denied requests and token checks still use resources. This preparation neither verifies your actual account plan nor promises availability under abuse. **If Cloudflare requests a paid upgrade for these resources, stop instead of upgrading.** [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Gemini eligibility, availability and quota can change independently. Verify its actual project is unbilled/Free Tier and the model remains eligible. Free-tier input/output may be used for product improvement/human review; age/region and sensitive-information restrictions still apply. Do not switch the Gemini project to paid billing. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [terms](https://ai.google.dev/gemini-api/terms).

## Local checks — repository root

Use the existing Node 24/TypeScript/backend ESLint installations; no new runtime package is required:

```powershell
node node_modules/typescript/bin/tsc -p workers/ai/tsconfig.json --pretty false
node functions/node_modules/eslint/bin/eslint.js --config workers/ai/.eslintrc.cjs workers/ai/src --ext .ts
node --test --test-isolation=none tests/workers-ai.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
npm run test:phase1
node scripts/check-architecture.cjs
```

The Worker uses narrow structural Cloudflare interfaces rather than adding an SDK dependency. Tests exercise actual Web Crypto RSA signatures and real in-memory SQLite transactions/restarts, with mocked Google/provider requests. They are not workerd/Miniflare or live deployment tests. Existing financial/backend tests remain intact.

## Exact future deployment sequence — not executed or authorized by this task

1. In Cloudflare, confirm **Workers Free** and SQLite-backed Durable Objects availability. Do not enable Workers Paid, legacy KV-backed objects, R2, a paid database, or Firebase Blaze. Verify the Gemini project's Free Tier and eligible audience separately.
2. In `workers/ai/wrangler.jsonc`, replace only the Firebase project ID, numeric project number, and comma-separated allowed Firebase app IDs. Each app ID must belong to that project. Set exact HTTPS web origins if web is used; no wildcard. Keep `AI_ENABLED` and `AI_FREE_TIER_VERIFIED` at `"false"`. The model stays fixed. No key belongs in this file.
3. When separately authorized to provision/deploy, from the repository root run the following. `npx` may download the Wrangler 4 CLI; that tooling has not been installed or executed here. The dry run must pass before deploying:

```powershell
npx wrangler@4 login
npx wrangler@4 deploy --config workers/ai/wrangler.jsonc --dry-run --outdir workers/ai/.dry-run
npx wrangler@4 deploy --config workers/ai/wrangler.jsonc
npx wrangler@4 secret put GEMINI_API_KEY --config workers/ai/wrangler.jsonc
```

The third command deploys an **inactive** Worker and its SQLite quota migration. Enter the key only at the fourth command's interactive secret prompt, not in command arguments, shell history, source or Expo variables. Do not run Firebase deploy. Secret upload may create a Worker version; the activation vars must remain false. Record the resulting `https://extrack-ai.<account>.workers.dev` URL. [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/).

4. Android native App Check and the Firebase JS CustomProvider bridge are prepared. Follow [Android device verification](ANDROID_APP_CHECK.md) to register Play Integrity, explicitly opt into development debug attestation, and test a native build. The Worker transport lazily registers the JS instance using `registerWorkerAppCheck(instance)`. Native build/device validation and Worker real-token acceptance remain blockers; iOS attestation is deferred. Never bundle debug secrets or disable verification.
5. Verify staging deployment with real Firebase ID/App Check tokens: wrong/missing tokens and wrong project/app must fail before provider use; invalid consent must fail; durable caps must survive restart/concurrent requests; provider/storage failure must retain offline fallback. Measure actual Free-plan CPU/runtime behavior. Do not run quota tests against production using the real Gemini key.
6. Only after a separately authorized rollout and successful checks: set the Worker's two activation vars to `"true"` and deploy that explicitly reviewed change. Then configure/rebuild the mobile client with the following **public non-secret** settings:

```dotenv
EXPO_PUBLIC_AI_TRANSPORT=worker
EXPO_PUBLIC_AI_WORKER_URL=https://extrack-ai.YOUR-ACCOUNT.workers.dev
EXPO_PUBLIC_WORKER_AI_VERIFIED=true
EXPO_PUBLIC_FREE_AI_RELEASE_ENABLED=true
EXPO_PUBLIC_SUPPORT_CHAT_ENABLED=true
EXPO_PUBLIC_AI_INSIGHTS_ENABLED=true
```

These lines are instructions only; no environment file was changed. The URL must be the trusted deployed `workers.dev` address, not an arbitrary proxy. The transport never sends tokens to custom endpoints. The client gates remain off by default. Re-test consent, account switching, quota messages and offline figures on-device before release. Never add `EXPO_PUBLIC_GOOGLE_API_KEY` or `EXPO_PUBLIC_GEMINI_API_KEY`.

To stop live AI later, set server `AI_ENABLED=false` and redeploy the reviewed configuration; also turn off client feature flags for the next build. Preserve quota storage and the existing Firebase code. No billing plan change is needed for shutdown.

## Remaining activation blockers

- Real Android native build, device attestation/refresh and Worker acceptance checks; iOS attestation is deferred.
- Actual Cloudflare Free-plan/account provisioning, Wrangler dry-run/workerd validation and deployment.
- Real-token, production-runtime/CPU, quota failure and on-device acceptance checks.
- Confirmation of Gemini Free Tier, model eligibility and privacy/region suitability at rollout time.

If any of those cannot be satisfied on free services, keep AI disabled; do not weaken the token checks or replace atomic quotas with memory. No paid-service activation is authorized.
