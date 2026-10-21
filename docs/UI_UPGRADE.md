# Premium fintech UI upgrade

Current AI scope: see [AI_FREE_TIER.md](AI_FREE_TIER.md). Optional Gemini support and explanations are implemented behind activation gates; offline analytics remain deterministic. No live integration or billing was activated.

## Implemented

- Shared navy, blue, light/dark surface, typography-color, radius, spacing, and touch-target tokens in `src/constants/design.ts`. Body text uses stronger contrast variants of the brand's secondary, positive, and negative colors.
- Branded splash with an interruptible 620 ms entrance, ambient backdrop, and completion callback. Removed the forced 4.5-second loading gate and looping decoration. Authentication and biometric checks still control access; the animation does not unlock an account.
- Floating Home / Activity / Add / Insights / Profile navigation shared across native and web. Add opens the existing protected Home transaction form. Appearance changes update navigation immediately.
- Gradient recorded-balance panel, income/expense summaries, shared category-icon transaction rows, search and type filters, and separate Insights charts. Home, Activity, and Insights share the existing screen controller and ledger functions rather than implementing separate financial rules. Only Home can trigger the existing low-balance notification.
- Bounded Activity preview (50 records) and virtualized full transaction and loan lists. Existing edit/save/delete handlers remain in place; deletion now requests confirmation.
- Loan cards show principal, monthly installment, and confirmed payment counts from the existing schedule. Historical loans request review. Payment still requires the existing explicit confirmation and never transfers money.
- Consistent authentication branding, wider inputs, responsive content widths, refined profile/settings/document/support surfaces, and theme-aware assistant bubbles and unavailable/typing feedback.
- Reduced-motion preferences apply to splash, card entrance, tab fades, sheets, document preview, account modals, and wellness gauge. Animations stop on cleanup. Native inputs and transaction rows have clearer accessibility labels.

## Preservation

No dependencies were added. Financial domain functions, SQLite schema/repositories/sync, Firebase integration, backend callables, and protected configuration are unchanged, verified by the architecture baseline check. The route check explicitly permits the two new thin Activity and Insights entries and continues to check every original route.

Transaction rows use the existing `ledgerKind` and `entryCentavos` functions for presentation: transfers/opening balances remain neutral, and excluded or invalid entries show a review label. This does not change any saved record or total.

Existing safety restrictions remain: unverified statement imports cannot be saved, historical device records remain separate, and AI support requires configured authenticated backend support. The UI does not claim access to banking accounts or financial advice.

## Validation

- App TypeScript check.
- Existing 25 financial, SQLite, ownership, synchronization, payment, backend, and chat regression tests.
- Architecture/import/asset/cycle and protected-code checks.
- Metro development bundle compilation for Android, iOS, and web (HTTP 200); compile checks do not execute the app or access user records.
- Backend TypeScript and configured backend lint.

Root Expo lint is not configured; invoking its bootstrap would install tooling, so it was not used.

Metro's optional React Native DevTools installer reported `spawn EPERM` in this restricted environment. Metro itself started successfully, and all three platform bundles compiled after the final edits. The temporary development server was stopped afterward.

## Device review still required

These are manual acceptance checks, not completed device-test results:

1. Cold start signed out and signed in; reduced motion on/off; biometric success, cancellation, and background resume. Verify no protected content flashes before unlocking.
2. Light/dark appearance, smaller phones, tablet widths, large accessibility text, VoiceOver/TalkBack focus, and bottom navigation/home-indicator safe areas.
3. Add from every tab, cancel, save, duplicate taps, edit, delete confirmation, keyboard avoidance, and reopening the composer. Use test records only.
4. Offline refresh, local pending writes, account switch, and sync failure messaging. Compare dashboard, Insights, and Statements totals against the same test ledger.
5. Search/type filters, full history scrolling, empty records, large balances, and long names.
6. Loan principal/schedule display, paid/unpaid status, confirmation cancellation, and repeated confirmation using a test backend. No automatic payment entry should appear merely because a due date passes.
7. Profile photo, appearance, biometrics, cards, password reset, Help, statement preview, and unavailable support. Test configured chat only against an authorized test backend.

No simulator/device screenshots or native interaction runs were available in this environment. Production deployment, enabling integrations, and legacy-data recovery are outside this visual upgrade.
