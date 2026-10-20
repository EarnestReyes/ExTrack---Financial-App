> Structural follow-up: implementation paths were reorganized. See [ARCHITECTURE.md](ARCHITECTURE.md) and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for current paths. This report retains the Phase 1 history.

# Phase 1: security and financial data preservation

## Implementation and boundaries

The baseline working tree was clean. Both existing TypeScript checks passed.
There were no versioned SQLite migrations or application test suite. The old
database had unowned transactions, loans, cards, profile data and queue entries;
cloud records use `users/{uid}/...` paths. Legacy clear helpers could delete both
local and cloud data. No application/device database was opened during this work.

The implementation plan was: secure server boundaries; isolate user storage;
replace automatic loan recording; share calculations; tighten rules; remove
destructive cache behavior; validate with synthetic data. Existing navigation,
Firebase authentication, Firestore, SQLite and React Native are retained.

## Data preservation and recovery gate

**No production or device backup has been created or verified.** No migrations,
record deletions, ownership assignments, deployments, credential changes,
commits or pushes were performed against a real account.

The application no longer opens `extrack.db`. Its unowned rows and sync queue
remain untouched and must never be assigned to the first user who signs in.
Native file metadata detects whether a legacy database exists; web detection is
reported as unknown. Record-level inspection is deferred until backup verification.
The old source is recoverable from Git; this is not a backup of financial data.

New local stores use `extrack-owned-v1-{encoded UID}.db`. Each contains:

- `records`: owner UID, entity, stable Firestore ID, original JSON payload,
  deleted flag and dirty flag; composite primary key includes ownership.
- `sync_queue`: owner UID, entity, Firestore ID, action and JSON payload.
- `PRAGMA user_version = 1`; unknown future versions are rejected.

Local changes and their outbox entries commit in one SQLite transaction. Every
read, write and acknowledgment is owner-filtered. Authentication changes remount
private navigation and clear support conversation state. In-flight requests keep
their captured account path and cannot become another user's operation.

Only complete server snapshots reconcile the local store. Dirty rows are kept.
Missing remote rows are hidden with a tombstone, not physically erased. Inserts
are idempotent; conflicting existing cloud records are preserved and block the
queue. Updates require the expected cloud timestamp, never recreate a deleted
document, and send only mutable fields. Immutable legacy metadata is not rewritten.
Conflict resolution UI and legacy ownership import remain future work. A blocked
queue is retained and shown as a sync error; it is never silently discarded.

### Manual native backup before recovery

1. Use the existing installed build/device. Do not uninstall, clear app storage,
   run reset scripts, or install a replacement build over the only copy.
2. Stop the app. Export its entire SQLite directory using Android Studio Device
   Explorer for a debuggable build, or a trusted device/app backup workflow.
   Include `extrack.db`, any WAL/SHM sidecars, all new owned database files and
   their sidecars. For iOS, export the app container using a supported developer
   device workflow. Do not root/jailbreak a device just for this task.
3. Store the backup outside this repository with restricted access. Record file
   sizes and checksums. Never paste financial data or Auth tokens into Git/chat.
4. On a separate copy, run SQLite integrity checks and verify table counts and
   representative ledger totals. Prove that restoration works in a staging app.
5. Only then design a versioned ownership recovery step. Correlate stable cloud
   IDs with authenticated owner paths; preserve original IDs/raw values. Any
   unmatched row or queued write requires explicit ownership confirmation.

### Manual Firestore backup

An authorized project operator must use a managed Firestore export to an approved
Cloud Storage bucket (billing/IAM may be required), or the organization's verified
backup facility. Include user documents and all nested financial collections.
Verify completion metadata, collection counts and a restore into an isolated
staging project. A source checkout is not a Firestore backup. No export was run.
See https://firebase.google.com/docs/firestore/manage-data/export-import.

## Server security and configuration

`functions/src/index.ts` uses authenticated callable Functions:

- `supportChat`: validates bounded conversations; at most 12 messages, 2,000
  characters each and 12,000 total; 5 requests/minute per UID; 512 output tokens;
  provider timeout; general app support only, without financial data tools.
- `sendLowBalanceAlert`: accepts only a negative finite balance; recipient comes
  from the verified authenticated email, never a user-supplied recipient.
  At most 1 request/minute per UID; plaintext email avoids HTML injection.
- `confirmLoanPayment`: authenticated, rate-limited, atomic payment confirmation.

All require Firebase App Check, have bounded instance counts/timeouts and use a
server-owned `service_limits` collection inaccessible to client rules. Callable
Firebase infrastructure verifies identity/App Check tokens; handlers also reject
missing authentication. Errors do not include provider responses or secrets.
Rate limits are per minute, not a monthly billing cap; configure billing alerts.

Before enabling services, an authorized operator must:

1. Revoke/rotate the previously exposed Gmail application password. Removing
   source does not revoke it. Git history still contains it (including commit
   `cc7c6ce`); no history rewrite was performed. Review previous build artifacts.
2. Rotate the former Gemini client key; remove the obsolete
   `EXPO_PUBLIC_GOOGLE_API_KEY` from local/EAS configuration. Existing published
   builds may still expose it. No environment values were printed or replaced.
3. Configure Firebase secrets interactively with the correct explicit project:

   ```text
   firebase functions:secrets:set SMTP_USER --project <project-id>
   firebase functions:secrets:set SMTP_PASSWORD --project <project-id>
   firebase functions:secrets:set GEMINI_API_KEY --project <project-id>
   ```

4. Configure server parameter `GEMINI_SUPPORT_MODEL` to a currently available,
   approved model. There is intentionally no invented replacement key/model.
   Firebase Functions parameter files belong outside version control.
5. Register platform App Check providers and implement/verify client token
   provisioning for the intended native/web builds. The existing app has no
   configured App Check provider. Until this is done, protected calls fail closed.
   Never remove enforcement to bypass this setup.
6. Review and test rules/Functions in emulators and staging. Deploy only after
   explicit approval. Callable Functions use the default `us-central1` region;
   configure both sides together if changing region.
7. Only after verification set `EXPO_PUBLIC_SUPPORT_CHAT_ENABLED=true` and/or
   `EXPO_PUBLIC_EMAIL_ALERTS_ENABLED=true` for a new build. These are public feature
   flags, not credentials. Their default is disabled. Payment confirmation also
   requires the deployed Function and App Check setup; there is no insecure fallback.

See https://firebase.google.com/docs/functions/config-env and
https://firebase.google.com/docs/functions/callable.

## Loan workflow and accounting

New loans have `schemaVersion: 2`, `ownerUid`, `principalCentavos`,
`installmentCentavos`, `durationMonths`, `startDate`, `dueDay`, `firstDueDate`,
`endDate`, title and creation timestamp. Principal and installment are entered
separately. The user reviews the first due date and total before saving. Short
months use their last day. Interest is not inferred.

Schedule total is installment × duration. Paid count and remaining scheduled
obligation are derived from confirmed installment transactions, not duplicated
mutable loan balances. There is no background or due-date payment generation.
Upcoming, Due, Overdue and Paid are computed for display. Early confirmation is
allowed only after explicit user confirmation that payment has occurred.

Home loan details offer Confirm Payment followed by a confirmation alert. The
backend reads the user's canonical loan and creates exactly one transaction at
`users/{uid}/transactions/payment_{loanId}_{installmentNumber}` in a Firestore
transaction. Repeated calls return the same payment. Client rules forbid forging,
editing or deleting confirmed payments. Confirmation requires connectivity; an
unknown response is resolved by refreshing/retrying the same installment ID.

Legacy loan documents retain all original fields and show a review notice. No
principal/installment meaning is guessed. A reconciliation/reversal workflow is
required before editing confirmed payments or converting historical loans.

`src/domain/finance.ts` supplies all screen totals in integer centavos:

- Income, expense and net cash flow are calculated from ledger records.
- Recorded balance = explicit opening balances + income − expense, not bank funds.
- Transfers do not change total cash flow. Card summaries are not income or
  opening balances; credit card summaries are not automatically treated as cash.
- Generated legacy card deposits/balances and automatic unconfirmed loan expenses
  are preserved but flagged/excluded until reviewed. Invalid monetary records and
  unknown types are also excluded with a review count; raw records are unchanged.
- Confirmed loan payment totals and remaining scheduled obligations are distinct
  from principal. Full-period chart data uses the same summaries, including zero days.
- Local/cloud merges use stable Firestore IDs, not device-specific numeric IDs.
- Stored calendar dates are `YYYY-MM-DD`. New ledger dates, reporting cutoffs and
  payment confirmations use Asia/Manila. Period/schedule arithmetic uses UTC date
  components to avoid daylight-saving changes. Historical dates are not shifted.

## Rules and deliberately deferred functionality

Nested user collections now require matching authentication. New financial writes
have ownership/type/field/amount validation. Legacy documents remain readable by
their cloud path owner; ordinary edits preserve metadata. Canonical loan fields
are immutable from clients. Confirmed payment writes are server-only. Unrelated
and top-level access is denied. Estimated wellness snapshots cannot claim to be
bureau-verified. Rules have not been deployed or emulator-validated here.

Clear Cache is informationally disabled: there is no identified disposable cache.
Bulk clear helpers fail safely. No financial history or pending writes are erased.

Statement parsing remains preview-only. Saving is disabled rather than reporting
false success; durable imports need verified bank direction/date mapping,
provenance and duplicate detection. The parser is not a reliable ledger importer.

Other fixes include stable transaction editing, category/loan-link preservation,
submit guards, profile field fallbacks and canonical registration fields, sanitized
logging, correct Metro filename, and removal of direct client AI/EmailJS calls.
Old SDK dependencies remain installed but unused where applicable. No packages
were installed; the already-locked FileSystem package is now declared directly.

## Verification

Executed results: application TypeScript **passed**; Functions TypeScript
**passed**; Functions `npm run lint` **passed**; **25 targeted tests passed**;
`git diff --check` **passed**. No package installation was performed. A clean
typecheck is not proof of runtime/device or security-rule correctness.

Commands (run from the repository unless specified):

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/typescript/bin/tsc -p functions/tsconfig.json --noEmit --incremental false --pretty false
npm run test:phase1
cd functions
npm run lint
```

The tests transpile in memory and use synthetic records, real in-memory Node
SQLite, mocked Firestore/Functions/provider behavior, and a mocked React hook
harness. They cover money, ownership/account switching, outbox retries and lost
acknowledgments, deletion tombstones, loan schedule states and duplicate payment
confirmation, backend authentication/limits/errors, and chat cleanup/consecutive
messages. They do not prove actual device navigation or production behavior.

The default `node --test` subprocess mode was blocked by the execution environment;
the checked-in test command uses Node 24's in-process test isolation option.

## File inventory

Created:

- `docs/PHASE1.md`
- `functions/src/validation.ts`
- `src/data/ownedStore.ts`
- `src/domain/finance.ts`
- `src/services/legacyStorage.ts`
- `src/services/supportService.ts`
- `tests/phase1.test.cjs`

Renamed: `metro.cofig.js` to `metro.config.js` (configuration preserved).

Modified:

- `.gitignore`
- `firestore.rules`
- `functions/.gitignore`
- `functions/src/index.ts`
- `package.json`
- `package-lock.json`
- `src/app/_layout.tsx`
- `src/app/index.tsx`
- `src/app/register.tsx`
- `src/app/forgotPass.tsx`
- `src/app/ChatSupport.tsx`
- `src/app/statements.tsx`
- `src/app/(tabs)/home.tsx`
- `src/app/(tabs)/explore.tsx`
- `src/components/CreditScoreModal.tsx`
- `src/components/SystemInformationModal.tsx`
- `src/database.ts`
- `src/services/biometricService.ts`
- `src/services/emailService.ts`
- `src/utils/creditScore.ts`

No emulator JAR was available in the inspected cache. Emulator rule evaluation,
Firebase Auth/App Check token exchange, native builds, PDF extraction and live
provider/email delivery remain unverified. Do not enable/deploy until cross-user
denial, malformed writes, payment immutability and valid owner requests have been
tested with the Firebase emulator and a staging app. Use a `demo-` project and
explicit local emulator connections, never production credentials in tests.

## Next phase

Verify backup/restore first, then build explicit legacy ownership recovery and
loan/card reconciliation, a conflict-resolution UI, durable reviewed statement
imports, App Check provisioning and emulator integration tests. Complete device
and staging acceptance before UI modernization or financial AI insights.
