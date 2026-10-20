# Project structure and refactor report

## Original architecture

Before this refactor, screen implementations lived directly under Expo routes,
modals and starter components shared a flat components folder, Firebase/client
integrations were split between config and flat service files, and database.ts
combined persistence access and sync orchestration. Profile/chat imported auth
context from the root route layout. Backend handlers shared one entry file.
Phase 1 changes were already uncommitted and have been preserved.

```text
src/
  app/                 route files containing screen implementations
  components/          feature modals, shared UI, native/web tabs and starters
  config/firebase.ts
  database.ts          repositories, ownership, preferences and synchronization
  data/ownedStore.ts   connection, schema, records and queue
  domain/finance.ts
  services/            flat integration adapters
  utils/creditScore.ts
functions/src/
  index.ts             all callable handlers, configuration and rate limiter
  validation.ts
```

## Resulting source tree

Root assets, Android sources, package/configuration files and hosting identifiers
remain in their existing locations. Dependencies, caches and build outputs are
omitted below. No unused placeholder directories were added.

```text
src/
+-- app/
|   +-- (tabs)/
|   |   +-- _layout.tsx
|   |   +-- explore.tsx
|   |   \-- home.tsx
|   +-- _layout.tsx
|   +-- ChatSupport.tsx
|   +-- forgotPass.tsx
|   +-- help.tsx
|   +-- index.tsx
|   +-- register.tsx
|   \-- statements.tsx
+-- components/
|   +-- layout/
|   |   +-- app-tabs.tsx
|   |   \-- app-tabs.web.tsx
|   \-- ui/
|       +-- external-link.tsx
|       +-- themed-text.tsx
|       \-- themed-view.tsx
+-- constants/
|   \-- theme.ts
+-- contexts/
|   \-- AuthContext.tsx
+-- data/
|   \-- ownedStore.ts
+-- database/
|   +-- repositories/
|   |   +-- cardRepository.ts
|   |   +-- creditScoreRepository.ts
|   |   +-- loanRepository.ts
|   |   +-- ownedRecordRepository.ts
|   |   +-- profileRepository.ts
|   |   +-- settingsRepository.ts
|   |   +-- shared.ts
|   |   \-- transactionRepository.ts
|   +-- sync/
|   |   +-- events.ts
|   |   +-- syncQueue.ts
|   |   \-- syncService.ts
|   +-- access.ts
|   +-- connection.ts
|   +-- index.ts
|   +-- legacyStorage.ts
|   +-- schema.ts
|   \-- types.ts
+-- domain/
|   \-- finance.ts
+-- features/
|   +-- ai-chat/
|   |   \-- components/
|   |       \-- ChatSupport.tsx
|   +-- auth/
|   |   +-- components/
|   |   |   \-- ChangePasswordModal.tsx
|   |   +-- screens/
|   |   |   +-- ForgotPasswordScreen.tsx
|   |   |   +-- LoginScreen.tsx
|   |   |   \-- RegisterScreen.tsx
|   |   \-- styles/
|   |       +-- ForgotPasswordScreen.styles.ts
|   |       +-- LoginScreen.styles.ts
|   |       \-- RegisterScreen.styles.ts
|   +-- credit-score/
|   |   +-- components/
|   |   |   \-- CreditScoreModal.tsx
|   |   \-- services/
|   |       \-- creditScore.ts
|   +-- dashboard/
|   |   +-- screens/
|   |   |   \-- DashboardScreen.tsx
|   |   \-- styles/
|   |       \-- DashboardScreen.styles.ts
|   +-- profile/
|   |   +-- screens/
|   |   |   \-- ProfileScreen.tsx
|   |   \-- styles/
|   |       \-- ProfileScreen.styles.ts
|   +-- settings/
|   |   +-- components/
|   |   |   +-- DeveloperModal.tsx
|   |   |   \-- SystemInformationModal.tsx
|   |   +-- screens/
|   |   |   \-- HelpScreen.tsx
|   |   \-- styles/
|   |       \-- HelpScreen.styles.ts
|   \-- statements/
|       +-- screens/
|       |   \-- StatementsScreen.tsx
|       \-- styles/
|           \-- StatementsScreen.styles.ts
+-- hooks/
|   +-- use-color-scheme.ts
|   +-- use-color-scheme.web.ts
|   \-- use-theme.ts
+-- services/
|   +-- ai/
|   |   \-- supportService.ts
|   +-- biometrics/
|   |   \-- biometricService.ts
|   +-- email/
|   |   \-- emailService.ts
|   \-- firebase/
|       \-- client.ts
+-- database.ts
+-- global.css
\-- images.d.ts
functions/src/
+-- api/
|   +-- confirmLoanPayment.ts
|   +-- sendLowBalanceAlert.ts
|   \-- supportChat.ts
+-- config/
|   +-- firebase.ts
|   +-- options.ts
|   \-- secrets.ts
+-- middleware/
|   \-- requestLimits.ts
+-- utils/
|   \-- validation.ts
+-- index.ts
\-- validation.ts
docs/
+-- ARCHITECTURE.md
+-- PHASE1.md
\-- PROJECT_STRUCTURE.md
tests/
+-- architecture-baseline.json
\-- phase1.test.cjs
scripts/
+-- check-architecture.cjs
\-- reset-project.js
```

## File moves

The route rows below move implementations; their original route files remain as
one-line re-exports. Platform-specific tabs remain a matched native/web pair.

| Previous path | Implementation path |
| --- | --- |
| `src/app/index.tsx` | `src/features/auth/screens/LoginScreen.tsx` |
| `src/app/register.tsx` | `src/features/auth/screens/RegisterScreen.tsx` |
| `src/app/forgotPass.tsx` | `src/features/auth/screens/ForgotPasswordScreen.tsx` |
| `src/app/(tabs)/home.tsx` | `src/features/dashboard/screens/DashboardScreen.tsx` |
| `src/app/(tabs)/explore.tsx` | `src/features/profile/screens/ProfileScreen.tsx` |
| `src/app/statements.tsx` | `src/features/statements/screens/StatementsScreen.tsx` |
| `src/app/help.tsx` | `src/features/settings/screens/HelpScreen.tsx` |
| `src/app/ChatSupport.tsx` | `src/features/ai-chat/components/ChatSupport.tsx` |
| `src/config/firebase.ts` | `src/services/firebase/client.ts` |
| `src/services/supportService.ts` | `src/services/ai/supportService.ts` |
| `src/services/emailService.ts` | `src/services/email/emailService.ts` |
| `src/services/biometricService.ts` | `src/services/biometrics/biometricService.ts` |
| `src/services/legacyStorage.ts` | `src/database/legacyStorage.ts` |
| `src/components/ChangePasswordModal.tsx` | `src/features/auth/components/ChangePasswordModal.tsx` |
| `src/components/CreditScoreModal.tsx` | `src/features/credit-score/components/CreditScoreModal.tsx` |
| `src/components/DeveloperModal.tsx` | `src/features/settings/components/DeveloperModal.tsx` |
| `src/components/SystemInformationModal.tsx` | `src/features/settings/components/SystemInformationModal.tsx` |
| `src/utils/creditScore.ts` | `src/features/credit-score/services/creditScore.ts` |
| `src/components/app-tabs.tsx` | `src/components/layout/app-tabs.tsx` |
| `src/components/app-tabs.web.tsx` | `src/components/layout/app-tabs.web.tsx` |
| `src/components/themed-text.tsx` | `src/components/ui/themed-text.tsx` |
| `src/components/themed-view.tsx` | `src/components/ui/themed-view.tsx` |
| `src/components/external-link.tsx` | `src/components/ui/external-link.tsx` |

## Extracted and created modules

- Auth context: src/contexts/AuthContext.tsx, with unchanged default value/hook.
- Database: src/database/index.ts, access.ts, types.ts, connection.ts, schema.ts;
  repositories for owned records, transactions, loans, cards, profile, settings,
  credit estimates and shared saves; sync/events.ts, syncQueue.ts and syncService.ts.
- Existing route files became lightweight feature re-exports.
- Existing styles were extracted into seven feature stylesheets:
- `src/features/auth/styles/LoginScreen.styles.ts`
- `src/features/auth/styles/RegisterScreen.styles.ts`
- `src/features/auth/styles/ForgotPasswordScreen.styles.ts`
- `src/features/dashboard/styles/DashboardScreen.styles.ts`
- `src/features/profile/styles/ProfileScreen.styles.ts`
- `src/features/statements/styles/StatementsScreen.styles.ts`
- `src/features/settings/styles/HelpScreen.styles.ts`
- Backend: api/supportChat.ts, api/sendLowBalanceAlert.ts,
  api/confirmLoanPayment.ts, config/firebase.ts, config/secrets.ts,
  config/options.ts, middleware/requestLimits.ts and utils/validation.ts.
- Documentation: docs/ARCHITECTURE.md and docs/PROJECT_STRUCTURE.md.
- Structural validation: scripts/check-architecture.cjs and
  tests/architecture-baseline.json (hashes and path metadata only).

src/database.ts, src/data/ownedStore.ts and functions/src/validation.ts are retained
as compatibility export modules. The existing behavioral tests were adapted for
moved paths and per-fixture module caching; their assertions were not removed.

## Verified dead source removed

Reference searches covered application imports, require/dynamic-import usage,
platform counterparts, scripts, Expo configuration and native Android sources.
These starter modules had no callers; only the removed web animated module
referenced its CSS companion:

- `src/components/animated-icon.tsx`
- `src/components/animated-icon.web.tsx`
- `src/components/animated-icon.module.css`
- `src/components/hint-row.tsx`
- `src/components/web-badge.tsx`
- `src/components/ui/collapsible.tsx`

No assets were deleted. Native splash/icon resources and other retained images
may have configuration or platform references. Empty src/config and src/utils
directories were removed only after their contents had been moved.

## Import and database compatibility

Relative imports, @/ aliases, moved asset paths and platform counterparts were
updated. Feature components no longer import auth state from src/app/_layout.tsx.
The @/* and @/assets/* alias definitions are unchanged. Existing names, exports,
database filenames, tables, SQL, schema version, owner filtering, queue semantics,
manual loan confirmation and accounting calculations remain unchanged.

Architecture checks compare all pre-refactor database declaration bodies and
schema initialization against captured hashes. Pure domain calculations, package
manifests, Firestore rules, Expo/Metro/Firebase configuration are also hash-checked.
No database migration or record operation was executed.

## Backend compatibility

index.ts still exports supportChat, sendLowBalanceAlert and confirmLoanPayment.
Handler bodies, App Check/auth checks, validation, secrets, rate limits, timeouts,
provider calls and payment IDs are unchanged; the handlers simply import their
configuration and limiter from dedicated modules. Nothing was deployed.

## Navigation compatibility and validation

- All ten route/layout files retain their paths and casing.
- Eight screen routes are lightweight implementation exports.
- Native/web tab labels, link targets and platform file pairing are unchanged.
- Authentication redirects, protected route declarations, splash/biometric logic
  and the AuthContext default contract are retained.
- Local module and asset references resolve; no local import cycles detected.
- Application TypeScript: passed after the major moves/extractions.
- Functions TypeScript: passed after backend extraction.
- Functions npm run lint: passed.
- Existing npm run test:phase1: all 25 tests pass after the major extractions.
- Static node scripts/check-architecture.cjs: passed (75 source modules).
- Local Metro started using src/app. Android, iOS and web development bundles
  each returned HTTP 200. Dotenv loading was disabled for this compile smoke test;
  no app was executed on a device and no cloud services were exercised.
- React Native DevTools installation reported spawn EPERM. This did not prevent
  Metro startup or the three successful bundles. Metro was stopped after testing.
- Root npm run lint was not executed: its installed Expo bootstrap would install
  dependencies and create configuration. No lint packages or config were added.

Bundling is not proof of actual deep-link interaction, native PDF extraction,
biometrics, device rendering or deployed service access. No Android/iOS device or
simulator testing was performed.

## Deferred refactors and remaining bugs

Profile and dashboard retain substantial local state and form/action orchestration.
They are now feature-owned with separate styles, but extracting every hook/modal
at once would create unnecessary behavioral risk. Further decomposition should
use focused interaction tests and preserve existing timing.

This phase does not resolve Phase 1 operational work: verified backups, explicit
legacy ownership recovery, historical loan/card reconciliation, disabled statement
import persistence, pending-conflict UI, credential rotation, App Check setup and
emulator/staging acceptance. The existing web Home-tab target and starter branding
are deliberately preserved rather than changed during a structural refactor.

## Recommended next step

Complete Phase 1 staging/device validation and verified backup/restore, then add
interaction tests around dashboard and profile flows before extracting their
remaining stateful controllers. Financial AI and UI redesign remain separate work.

See ARCHITECTURE.md for dependency directions and development commands. PHASE1.md
is a historical implementation record; paths in its original inventory refer to
the pre-refactor layout and map to the locations above.
