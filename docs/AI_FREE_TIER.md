# Opt-in Gemini support and explanations

Cloudflare preparation now exists separately in [workers/ai](../workers/ai/README.md). It uses mandatory signed Firebase ID/App Check tokens and SQLite-backed Durable Objects for quotas. No deployment or activation occurred. The Firebase implementation described below is preserved; Worker support shares only a fixed help topic with Gemini, and device App Check setup remains an activation blocker.

Implementation prepared on 2026-10-21. No deployment, billing change, API-key creation, production provider request, or environment-file change was performed.

## Cost boundary

The existing integration is a Firebase v2 callable using a Secret Manager Gemini key, Firebase Authentication, enforced App Check, and Firestore-backed limits. Reusing it avoids moving secrets into the mobile app or inventing another hosting integration. It **does not provide guaranteed free hosting**.

[Firebase Functions requires Blaze](https://firebase.google.com/docs/functions/faq-and-troubleshooting). Build artifacts, compute, networking, Firestore quota counters, and secret access may incur charges, even though no-cost allowances exist. No alternative hosting account was provisioned. A strict zero-total-cost production deployment remains blocked until an acceptable hosting arrangement is verified. Existing project billing and App Check device configuration have not been verified here.

[Google's pricing](https://ai.google.dev/gemini-api/docs/pricing) currently lists `gemini-2.5-flash-lite` standard text input/output as free-tier eligible. Eligibility/quotas vary by project and may change; verify the actual AI Studio project before activation. The model allowlist is deliberately one model; there is no automatic model upgrade, paid fallback, grounding, tool, or retry.

Use an eligible Gemini project with API billing disabled. A Firebase Blaze hosting project's billing status is not evidence that its Gemini requests are free: a separate unbilled Gemini project/key may be necessary. Server attestation flags cannot inspect or guarantee a key's billing tier. They default off and must not be set based only on an assumed free allowance. Per-request caps do not guarantee zero hosting cost or defend against all invocation-level abuse.

## Privacy and consent

[Gemini unpaid-service terms](https://ai.google.dev/gemini-api/terms) allow product improvement and human review and prohibit submitting sensitive, confidential, or personal information. They also impose age/region eligibility restrictions; unpaid API clients are not eligible for EEA, Switzerland, or UK audiences under the current terms. Verify eligibility before making this available to users.

- Chat asks permission for each send, disclosing that the current conversation is shared. It never reads or attaches financial records. The server rejects common identifiers; this is a limited safeguard, not comprehensive PII detection. Users must not type private/confidential information.
- Financial totals remain local. The explicit per-request preview contains **only four qualitative labels**: recorded cash flow direction, concentrated/spread/no spending, whether a Savings-category expense exists, and whether a verified schedule needs loan attention. No amounts, names, categories, transaction descriptions, documents, account IDs, dates, or raw records are sent to Gemini.
- Even these labels may feel sensitive. Users can decline and retain all local features. Consent is not permission to violate provider terms. AI output is untrusted explanation, visibly labeled as potentially inaccurate; it never changes records or financial totals.
- The authenticated user ID is used only by the backend for authorization and hashed quota counters. It is not part of the provider payload. Prompts/responses are not deliberately persisted or logged by application code.

## Limits and graceful failure

- Firebase Auth and App Check are required by both callables. No request can select another user's account or retrieve financial records through these endpoints.
- Existing per-operation limit: 5 attempts per minute per UID.
- Shared atomic caps across chat/explanations: 5 provider attempts per UID per UTC day and 20 across the backend project per UTC day, including failed attempts. Counters are reserved before fetching and never refunded after uncertain failures.
- Input is bounded/allowlisted; output is capped at 512 tokens and 2,000 displayed characters; request timeout is 20 seconds. No automatic retries or provider/model switching.
- Provider HTTP 429 opens a persisted global circuit until the next UTC day. The client also conservatively pauses further AI network calls after a resource-exhausted result. Smaller real provider quotas still take precedence. No automatic retry is scheduled at reset.
- Calls remain gated off unless server `AI_ENABLED=true`, `AI_FREE_TIER_VERIFIED=true`, the existing `GEMINI_SUPPORT_MODEL` equals the allowlisted model, and the existing secret is configured. These are setup requirements, not instructions to activate now.
- A new mobile release gate `EXPO_PUBLIC_FREE_AI_RELEASE_ENABLED` must also be explicitly true; old flags alone cannot activate the new code. Existing `EXPO_PUBLIC_SUPPORT_CHAT_ENABLED` controls the support entry; `EXPO_PUBLIC_AI_INSIGHTS_ENABLED` controls optional explanations. They are public capability flags, never secrets. All default off in code. No `.env` values were read or changed during this implementation.
- New requests carry the `free-tier-v1` policy marker. The old backend's strict request validator rejects that marker, preventing the new client from silently using the previous uncapped chat deployment. The updated backend likewise rejects requests without the marker and explicit consent.

## Offline behavior

Insights uses the existing `summarize`, `loanSchedule`, local date handling, and centavo fields. It displays monthly recorded income/expenses, category breakdown/highest category, income less expenses, Savings-category allocations, canonical loan principal/remaining schedule totals, and unconfirmed-installment reminders. Surplus and categorized allocations are explicitly distinguished from verified bank savings. Legacy/invalid records remain excluded and flagged, never migrated or overwritten. Upcoming reminders do not create payment expenses.

All those features require no AI calls and continue on local records when AI is disabled, offline, quota-limited, or unavailable. Optional explanations receive coarse labels derived from these local results; the backend validates their shape but does not independently reconcile the device's offline ledger.

## Validation and remaining work

Tests use synthetic data and mocked providers only. App/backend TypeScript, configured backend lint, and regression coverage validate disabled gates, consent, private-field rejection, shared caps/concurrency, quota circuit, and deterministic summaries. The structural baseline intentionally updates only the changed `supportChat` declaration fingerprint; original financial/payment/email/database/schema/configuration protections remain.

Before any separately authorized rollout: verify real free-tier/model availability, hosting/billing restrictions, eligible audience, production App Check token delivery, device privacy dialogs and account-switch behavior, and deployed quota/error behavior. No live provider, emulator/device interaction, or production hosting validation was performed here.
