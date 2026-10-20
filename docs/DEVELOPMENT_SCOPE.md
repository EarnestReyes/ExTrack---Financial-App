# ExTrack current development scope

This scope supersedes earlier plans that included chatbot delivery or external AI integration in the current release.

## Current release priorities

1. Premium, consistent mobile UI/UX and a polished animated splash, including light/dark appearance, accessibility, reduced motion, and keyboard/safe-area behavior.
2. Maintain the modular project structure and reusable design components through focused refactoring.
3. Complete and polish transactions, loans, explicit payment confirmation, statements, and profile/settings flows. Preserve existing records and authentication throughout.
4. Improve charts, summaries, category analysis, and financial explanations using deterministic calculations from the existing ledger/domain layer. No AI inference or external provider is required for analytics.
5. Validate changes in small batches using affected-file checks and existing regression tests. Device visual and interaction acceptance remains necessary before production readiness can be claimed.

## Deferred until a future release

- Chatbot UI delivery, external AI APIs, provider setup, model integration, prompts, and financial AI features.
- New OpenAI/Gemini dependencies, API keys, paid services, or activation of existing AI integrations.

The current Help interface has no chatbot entry point. The preserved `ChatSupport` route is explicitly excluded by a false Expo Router protected guard, including direct navigation/deep links. This release exclusion is independent of existing environment feature flags.

## Preserved extension points

Keep `src/features/ai-chat/`, `src/services/ai/`, `src/app/ChatSupport.tsx`, related backend callables/configuration, and existing AI regression tests intact for future implementation. Do not delete AI-related code or configuration without explicit approval. Existing environment files and secrets are not changed by this scope update.

The existing UI/service/backend separation remains available for a later release. Reopening AI work requires an explicit scope decision; it must not be enabled as part of ordinary UI or analytics work. No backend deployment or decommissioning is implied by hiding the client interface.

## Working constraints

- Preserve financial records, authentication, ownership boundaries, synchronization, and financial calculation accuracy.
- Use targeted reads, minimal dependencies, small implementation batches, and concise reports.
- Do not rewrite unrelated backend logic, deploy, or commit automatically.
- Do not introduce API keys or paid services.

## Next focused batches

- Finish phone/device acceptance for the transaction sheet and category picker, large text, keyboard behavior, and light/dark appearance.
- Polish core transaction/loan/document workflows while retaining explicit confirmations and existing data-preservation restrictions.
- Refine deterministic analytics and verify displayed metrics against the same ledger used by Statements.
- Continue shared-component and project-structure cleanup where it directly supports those features.
