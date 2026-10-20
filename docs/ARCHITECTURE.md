# ExTrack architecture

ExTrack is an Expo SDK 57 / React Native application with Expo Router, Firebase
Authentication, Firestore, SQLite, and Firebase callable Functions. This structural
refactor preserves the uncommitted Phase 1 implementation. It changes module
locations and boundaries, not accounting rules, authentication policy, schedules,
database schema, API identifiers or UI design.

## Entry point and navigation

`package.json` still uses `expo-router/entry`. Expo Router still scans `src/app`.
The eight screen route files re-export feature implementations. The existing
`_layout.tsx` owns splash animation, Auth state observation, biometric checks,
notification setup and protected navigation. Authentication context is now in
`src/contexts/AuthContext.tsx`; consumers no longer import from a route layout.

Unchanged route paths:

| Route file | Implementation |
| --- | --- |
| `src/app/index.tsx` | `features/auth/screens/LoginScreen.tsx` |
| `src/app/register.tsx` | `features/auth/screens/RegisterScreen.tsx` |
| `src/app/forgotPass.tsx` | `features/auth/screens/ForgotPasswordScreen.tsx` |
| `src/app/(tabs)/home.tsx` | `features/dashboard/screens/DashboardScreen.tsx` |
| `src/app/(tabs)/explore.tsx` | `features/profile/screens/ProfileScreen.tsx` |
| `src/app/statements.tsx` | `features/statements/screens/StatementsScreen.tsx` |
| `src/app/help.tsx` | `features/settings/screens/HelpScreen.tsx` |
| `src/app/ChatSupport.tsx` | `features/ai-chat/components/ChatSupport.tsx` |

`(tabs)` remains a route group; it does not add a URL segment. Native tabs and
their `.web.tsx` counterpart remain paired under `components/layout`. Route
names, casing, redirects, links, presentation and asset targets are preserved.
The `/ChatSupport` route retains its existing component contract; this refactor
does not invent a new standalone chat-screen behavior.

## Responsibilities

- `app`: routing, application startup and navigation layouts.
- `features`: screen implementations, feature-owned modals, styles and services.
- `components/ui`: shared themed primitives and external-link behavior.
- `components/layout`: native/web tab shells.
- `contexts`: authentication context contract shared by layout and features.
- `services/firebase`: Firebase singleton client initialization.
- `services/ai`, `services/email`, `services/biometrics`: integration adapters.
- `database`: connection, schema initialization, repositories and synchronization.
- `domain/finance.ts`: shared pure money, date, ledger and loan calculations.
- `hooks`, `constants`: shared appearance hooks and design tokens.

No empty placeholder feature, middleware, migration, feedback or types directories
are introduced. Transactions, loans, cards and analytics currently share the
dashboard/profile UI and pure financial domain. Their persistence responsibilities
are separated into repositories. Further UI/controller decomposition is deferred
rather than changing tightly coupled React state or financial behavior here.

Seven screen stylesheets are extracted verbatim into feature `styles` folders.
The values and styling functions are unchanged. Feature-only password, wellness,
developer and system-information modals live with their owning features.

## Database modules

```text
database.ts                         compatibility facade
data/ownedStore.ts                  compatibility exports
database/
  index.ts                         public API and existing safe-disabled clear
  access.ts                        authenticated ownership, cloud paths, IDs
  types.ts                         persisted record and queue contracts
  connection.ts                    cached UID database handles
  schema.ts                        existing schema initialization
  legacyStorage.ts                 legacy file detection, no ownership migration
  repositories/
    ownedRecordRepository.ts       JSON record persistence/reconciliation
    shared.ts                      existing local-save and lookup orchestration
    transactionRepository.ts       transaction access, validation and mutations
    loanRepository.ts              loans and confirmation client adapter
    cardRepository.ts              card summary access and mutations
    profileRepository.ts           profile cache and picture helpers
    settingsRepository.ts          appearance preference database
    creditScoreRepository.ts       existing wellness metrics/snapshots
  sync/
    events.ts                      local subscription notifications
    syncQueue.ts                   owner-filtered queue reads/acknowledgments
    syncService.ts                 push/pull, status, listeners and retry order
```

The exact filenames remain `extrack-owned-v1-{encoded UID}.db` and
`extrack-preferences-v1.db`. Legacy `extrack.db` remains quarantined as in Phase 1.
`records`, `sync_queue`, `preferences`, keys, SQL and schema version are unchanged.
No database is opened by the architecture-check script. No migrations ran.

Repository modules depend on shared save orchestration; synchronization depends
only on ownership, connection, low-level records, queue and events. It does not
depend on feature screens or high-level repositories, preventing import cycles.

The compatibility facade intentionally keeps the existing singleton startup
listeners and import behavior. It is not a second database implementation. New
code should prefer the relevant repository while accounting for existing sync
startup requirements; do not casually move listener registration into render.

## Data flow

```text
Expo route -> feature screen -> database facade/repository
                                  |
                       owner check -> SQLite record + outbox
                                  |
                  sync service -> authenticated user's Firestore path
                                  |
                   full server snapshot -> owned reconciliation
                                  |
                      local event -> screen state refresh

Help -> ChatSupport -> AI service -> supportChat callable
Home loan details -> loan repository -> confirmLoanPayment callable
Balance alert -> email service -> sendLowBalanceAlert callable
```

Phase 1 semantics remain: stable identities, owner-scoped outbox, pending local
changes, guarded updates, retained conflicts/tombstones, manual idempotent loan
confirmation and centralized integer-centavo calculations. Provider keys remain
server-side; public feature flags retain their existing disabled defaults.

## Firebase Functions

`functions/src/index.ts` exports exactly `supportChat`, `sendLowBalanceAlert`,
and `confirmLoanPayment`. Their handler bodies are unchanged.

- `api`: the three callable handlers.
- `config/firebase.ts`: existing Admin app/store initialization.
- `config/secrets.ts`: existing secret and model parameter definitions.
- `config/options.ts`: existing protected callable options.
- `middleware/requestLimits.ts`: existing persistent per-user limiter.
- `utils/validation.ts`: existing request validators.
- `validation.ts`: compatibility re-exports for the original module path.

The shared module cache preserves a single Admin store and request limiter state.
Secret names, rate limits, App Check requirements, timeouts, payment document IDs
and provider requests were not changed. Nothing was deployed.

## Commands and checks

From the project root:

```text
npm start
npm run android
npm run ios
npm run web
npm run test:phase1
node scripts/check-architecture.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/typescript/bin/tsc -p functions/tsconfig.json --noEmit --incremental false --pretty false
npm --prefix functions run lint
```

`npm run lint` at the application root is still an unconfigured Expo lint
bootstrap command. The installed CLI would install dependencies and create a
config automatically; it was not run as part of this structural refactor.
Functions lint is configured and is run normally.

`check-architecture.cjs` resolves local imports/assets, detects cycles, compares
route files against the pre-refactor inventory, and checks captured hashes of
database declarations, schema initialization, handler bodies, financial logic,
package manifests and protected configuration. It reads source only.

The existing test loader now resolves moved modules and caches them per test
fixture, matching module singleton semantics. All behavioral assertions remain.

## Validation and limits

Application and Functions TypeScript, Functions lint, all 25 Phase 1 tests, and
architecture checks pass after the major extractions. Android development bundling
returned HTTP 200 from local Metro. React Native DevTools setup reported a process
permission error; Metro itself started and bundled. Device/simulator behavior,
deep-link interaction, biometric prompts, deployed rules and live services are
not proven by compilation/bundling. Consult PROJECT_STRUCTURE.md for final bundle
results and the complete migration inventory.

## Future work and known limitations

Keep new route files thin. Add feature UI and controllers under `features`, pure
calculations under the shared domain or an appropriate feature service, persistence
under database repositories, and external calls under integration services.
Only create a migration after verified backups and an explicit schema plan.

Phase 1 limitations remain: legacy ownership recovery/reconciliation, disabled
statement import saving, conflict-resolution UI, client App Check provisioning,
credential rotation and staging/device validation. Profile and dashboard still
contain substantial stateful UI orchestration; extracting those controllers and
individual form/chart components needs focused behavior tests. The pre-existing
web Home-tab target/branding is deliberately unchanged in this refactor.
# Current release scope

See [DEVELOPMENT_SCOPE.md](DEVELOPMENT_SCOPE.md). AI integration is deferred. Help no longer imports or opens chat, and the preserved ChatSupport route is excluded by a false protected guard. Earlier chat-flow notes below describe preserved architecture for a future release.

