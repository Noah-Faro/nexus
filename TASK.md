# Phase 11 Recovery hardening ledger

Only mark `[x]` after implementation, automated and relevant device tests pass, and orchestrator review confirms the result. Keep work on `codex/phase11-recovery-dashboard`; do not commit or push without explicit permission. Preserve unrelated `.codex/config.toml` and `.agents/.claude/` changes.

## 1. Storage safety and runtime decoding

- [x] "Define strict, runtime-validated decoders for persisted training sessions, templates, custom exercises, defaults, and recovery inputs; surface structured load status instead of silently accepting malformed JSON as typed data."
- [x] "Make workout-session persistence strict so ordinary encryption or AsyncStorage failures reject rather than being logged and swallowed."
- [x] "Make finish-session persistence transactional: do not clear the active session or leave a non-durable session in Recovery when the durable write fails; restore a coherent retry state and explain the failure."
- [ ] "Make delete-session persistence and tombstone recording transactional so a failed local write cannot produce a remote deletion or an in-memory Recovery state that disagrees with durable storage."
- [ ] "Gate cloud auto-push on successful durable local mutation, including session finish, edit, delete, template changes, custom-exercise changes, and defaults changes."
- [ ] "Add acceptance tests that force storage/encryption rejection and prove no finished, edited, or deleted session changes Recovery or cloud-sync intent until the local mutation is durable."

## 2. Backward compatibility, backup, and sync

- [ ] "Define a versioned encrypted recovery-observation envelope and migrate the current plaintext v2 observation payload without losing IDs, timestamps, supersession links, model metadata, or hidden legacy-unit records."
- [ ] "Preserve all legacy observation storage keys and v1 payload readers as read-only migration sources; never delete original legacy values until a verified migration/backup-retention policy exists."
- [ ] "Add recovery observations to encrypted backup export, import, merge staging, interrupted-merge replay, and Drive sync with deterministic per-record conflict and supersession handling."
- [ ] "Wire a durable observation save through TrainingApp/TrainingDashboard so successful group-observation writes mark sync dirty and request cloud push only after the local write succeeds."
- [ ] "Reconcile template revision/conflict behavior with template-order settings and tombstones so renamed, reordered, changed, deleted, and remotely merged canonical templates resolve consistently in Recovery."
- [ ] "Replay pending merge staging before dependent Training and Recovery loads, and expose a recoverable load status if staged data is invalid."
- [ ] "Add fixtures for legacy unencrypted/encrypted training values, each legacy observation key/schema, v2 observations, incomplete/staged import recovery, template tombstones, and multi-device merge conflicts."
- [ ] "Add acceptance tests proving export/import and Drive merge retain visible group observations and hidden migrated legacy observations without changing calculated recovery."

## 3. Recovery correctness and scope semantics

- [ ] "Add a low-frequency, foreground-aware Recovery clock so burden decay, contributor age, and outlook refresh while the dashboard is open without recalculating every second."
- [ ] "Keep zero-load results at 100% ready with no limiting unit/group and no arbitrary highest or most-affected group in cards, details, or accessibility labels."
- [ ] "Replace the raw scope-key string with tagged scope state so a deleted or remotely removed template remains an explicit unavailable template rather than degrading into a fake exercise-selection scope."
- [ ] "Make card, Map Focus, and detail scope resolution agree for canonical templates after saved names, exercise order, target sets, target reps, or template availability changes."
- [ ] "Define and implement an explicit missing-planned-reps policy that is represented consistently in scope validation, coverage, displayed fallback copy, and tests."
- [ ] "Define orphan-custom-exercise behavior for saved templates and completed sessions so missing custom definitions remain visible as unsupported/unavailable evidence rather than crashing or silently becoming mapped."
- [ ] "Prevent duplicate exercise identifiers from producing duplicate React keys or ambiguous scope relevance; preserve intentional repeated exercises through stable occurrence keys and deterministic aggregation."
- [ ] "Make RPE provenance explicit across recorded sets, neutral fallback, history coverage, and Estimate Quality so legacy missing RPE data remains interpretable."
- [ ] "Document that exercise weight is intentionally excluded from Phase 11 fatigue dose, including the rationale and user-facing estimate-quality implications."
- [ ] "Add acceptance tests for time refresh, zero-load/limiter behavior, renamed/edited/deleted templates, missing reps, orphan custom exercises, duplicate exercise entries, and recorded versus fallback RPE."

## 4. Interaction and accessibility

- [ ] "Create a reusable Recovery modal/sheet focus and accessibility contract covering initial focus, focus restoration, modal semantics, Android/iOS behavior, reduced motion, and interruption-safe close handling."
- [ ] "Serialize the Estimate Quality-to-Exercise Guide transition so close/open animations and focus restoration cannot race or leave focus on a dismissed control."
- [ ] "Make the anatomy map expose exactly one logical accessibility target per interactive region while preserving touch behavior for direct, shared, structural, and unavailable anatomy."
- [ ] "Verify and correct radio, selected, checked, disabled, and expanded accessibility states and labels across view toggles, workout accordions, group rows, steppers, observation scale, and sheets."
- [ ] "Remove nested interactive controls or equivalent invalid button containment in Recovery surfaces, preserving the intended tap targets and keyboard/screen-reader behavior."
- [ ] "Audit Recovery Unicode literals and browser/native rendering; retain correct UTF-8 source text and remove only verified redundant repair workarounds without changing displayed copy."
- [ ] "Make TrainingSessionView delayed exercise-advance timing and asynchronous profile/settings initialization unmount-safe; accept only when no state update can occur after unmount or a successful session finish."
- [ ] "Add acceptance checks for iPhone small screen, landscape, tablet, large Dynamic Type, VoiceOver/TalkBack traversal, reduced motion, modal dismissal, and anatomy interaction."

## 5. Confirmed cleanup and measured performance work

- [ ] "Remove only confirmed dead local Recovery code, including unused UnitRow/GroupRow paths and their unreferenced local props/types/styles/imports, after a fresh call-site audit."
- [ ] "Audit every exported Recovery API before removal; retain legacy parsers, supersede/delete repository operations, and externally consumable contracts unless compatibility evidence proves removal safe."
- [ ] "Remove or deprecate the unused exerciseSelectionPreview contract only after confirming no app, test, or consumer depends on it."
- [ ] "Harden PerformanceDashboard volume-snapshot parsing and guard zero-range e1RM chart coordinates so corrupt snapshots and zero-only trends cannot create unhandled errors or NaN SVG paths."
- [ ] "Benchmark the existing Recovery calculation on realistic long histories before changing its algorithm, then optimize only with numerical-equivalence fixtures and a justified negligible-dose cutoff."
- [ ] "Add acceptance checks proving cleanup preserves all public compatibility behavior and any optimization preserves burdens, readiness, contributors, limiters, coverage, and projections within specified tolerances."

## 6. Automated verification and release evidence

- [ ] "Wire runRecoveryAssertions into a deterministic automated test command, then split or supplement it with focused unit, integration, storage, migration, sync, and failure-path tests."
- [ ] "Add mutation-propagation tests covering completed-session logging, historical-session editing, deletion, template edits, custom workout comparison, local reload, backup restore, and cloud-merge refresh."
- [ ] "Add web and Expo Go interaction checks for Recovery controls, dialogs, sheets, map selection, console errors, storage migration, and state propagation."
- [ ] "Run TypeScript strict checking, deterministic recovery tests, storage/migration/sync tests, git diff --check, and Expo SDK 54 iOS export after implementation."
- [ ] "Perform physical device validation for layout, Dynamic Type, VoiceOver/TalkBack, reduced motion, safe areas, portrait/landscape, and all modal/guide transitions."
- [ ] "Update PHASE11 documentation with the final storage/sync contract, compatibility behavior, fatigue-input policy, accessibility contract, validation commands, and deferred product decisions."
- [ ] "Complete final orchestrator review confirming no unrelated .codex/config.toml or .agents/.claude changes were modified, no commit/push occurred, and every completed ledger item has verification evidence."

## Handoff context for remaining work

Updated 2026-07-25. This section is the restart point for a future agent; the checklist above remains authoritative.

### Resume protocol and boundaries

- Work only on `codex/phase11-recovery-dashboard`. Do not switch to or modify `main`, and do not commit or push without explicit permission.
- Read `AGENTS.md`, `STRUCTURE.md`, `STYLE_GUIDE.md`, and `plan/phases/PHASE11.md` before changing relevant code. Consult the exact Expo SDK 54 documentation before Expo-specific changes.
- Preserve unrelated user changes in `.codex/config.toml` and `.agents/.claude/`. The worktree was already dirty before this hardening pass; never reset or overwrite unrelated files.
- Implement one unchecked item at a time. Keep it unchecked until implementation, relevant automated tests, diff review, and orchestrator review all pass. Stop and request approval before an item expands into unrelated app-wide work.
- Prefer one implementation agent and one focused review pass. Use a maximum of five repair iterations, but checkpoint with the user after the first failed review or any cross-cutting scope expansion to control usage.
- Preserve backward compatibility and user data. Unknown, corrupt, locked, or incomplete storage must never silently become empty valid state or be overwritten by defaults.
- Phase 11 invariants: 51 individual recovery units remain the fatigue source of truth; 17 canonical groups are derived bottom-up; the visible Upper back presentation group combines canonical Upper back and Rotator cuff only in presentation; group observations never alter recovery math.

### Completed baseline: section 1 items 1-3

- Runtime validation is implemented in `src/trainingDecoders.ts`, `src/structuredStorage.ts`, `src/utils.ts`, and `src/trainingStorage.ts`. Persisted values expose `absent`, `valid`, `invalid`, `unreadable`, or `locked` status and retain recoverable valid siblings where documented.
- Strict workout-session persistence is implemented with serialization/encryption/write failures propagated. `src/mergeReplay.ts` retains staging until every replay step succeeds.
- Transactional session finishing is implemented in `src/finishSessionTransaction.ts`, `src/serializedAsyncQueue.ts`, `src/trainingStorage.ts`, `src/components/TrainingApp.tsx`, and `src/components/TrainingSessionView.tsx`. Durable history and active-cache clearing precede UI/Recovery commit; retries are ID-idempotent; active-session writes share a non-poisoning queue.
- These three items passed strict TypeScript, recovery assertions, storage assertions, diff checking, and independent review at the time they were ticked. Re-run them after later changes.

### In progress: transactional completed-session deletion

- Item: `Make delete-session persistence and tombstone recording transactional...` It is intentionally still unchecked and must be reviewed before acceptance.
- Current WIP files: `src/sessionDeletionTransaction.ts`, `src/sessionDeletionJournal.ts`, `src/sessionDeletionSyncGate.ts`, `src/tombstoneTransactionQueue.ts`, `src/backupPayload.ts`, `src/trainingStorageAssertions.ts`, `src/components/TrainingApp.tsx`, `src/components/SettingsModal.tsx`, `src/backup.ts`, `App.tsx`, and `STRUCTURE.md`.
- Intended order is encrypted journal -> strict history write -> strict tombstone write -> in-memory commit -> journal clear. A rejected native write is ambiguous because it may have applied before rejecting; recovery evidence may be cleared only after rollback or completion is durably reread and verified.
- Completion proof requires a `valid` decoded session history in which the target is absent plus the exact matching tombstone. An `absent`, invalid, unreadable, or locked history is not proof of completion.
- One shared tombstone transaction queue must cover the complete read-modify-write window for session and template tombstones. Avoid queue re-entry: code already holding this queue must call ungated inner operations rather than enqueueing the same queue again.
- Root gating must recover or block before startup merge replay, Drive diff/sync/push, backup export/import, snapshot restore/undo, and any equivalent Training-data operation. When recovery is unavailable, retain the journal, mark sync dirty where appropriate, prevent cloud mutation, and avoid repeated alert loops.
- The interrupted implementation added tests for crash points, applied-then-rejected history/tombstone writes, corrupt/locked/plaintext journals, absent versus valid history, journal-clear failure, gate block/retry, queue serialization, encrypted journal storage, and backup exclusion. It was interrupted during compile-fix iteration 1/5; do not assume these tests currently compile or pass.
- Recheck template-deletion rollback carefully. Template/session mutations share tombstones, but a cloud callback failure must not leave template storage, template order, UI state, and tombstones disagreeing. Do not broaden this item into the later template-conflict task without approval.
- Before ticking: inspect the full diff, run strict TypeScript and both assertion suites, test every crash state, and obtain a fresh independent review specifically for ambiguous write outcomes, gate coverage, queue deadlocks, and UI state timing.

### Remaining section 1 context

- **Gate cloud auto-push:** audit every session finish/edit/delete, template save/reorder/delete, custom-exercise mutation, and defaults mutation. Each must durably complete first, then update React/Recovery state, mark dirty, and request push. Do not rely on broad state-change effects that can fire for reloads or failed rollbacks. This depends on completing the deletion transaction above.
- **Storage/encryption rejection acceptance tests:** use injected storage that can reject before applying and after applying. Assert durable storage, React state, Recovery inputs, tombstones, dirty flag, and push callback together; mocks that test only a pure helper are insufficient.

### Remaining section 2 context: compatibility, backup, and sync

- **Versioned encrypted observation envelope:** locate current observation repository under `src/recovery/`. Write a discriminated, versioned decoder for presentation-group observations and hidden `legacy_unit` records. Preserve IDs, timestamps, supersession links, and model metadata exactly; observations remain presentation-only.
- **Legacy observation sources:** inventory every historical observation/check-in key and v1/v2 shape before writing migration code. Treat originals as read-only sources and never delete them during migration until a separately approved retention policy exists.
- **Backup/Drive observation support:** extend the typed backup payload, encrypted export/import, merge staging, replay, sync diff, and Drive merge. Resolve record conflicts deterministically by stable identity, timestamp, and supersession semantics; never include transaction journals.
- **Durable observation save:** pass a strict save callback through `TrainingApp` and `TrainingDashboard`. Only update visible latest observation and sync intent after local durability; snapshot recovery state before/after and assert all burden/readiness values are identical.
- **Template revision/conflicts:** reconcile saved template content, template-order settings, and tombstones as one consistency problem. Recovery uses stable default template IDs but must display the live saved name, order, exercise IDs, sets, and reps; deleted presets remain explicitly unavailable.
- **Merge replay ordering:** root startup must replay valid staging before Training/Recovery loads or cloud work. Invalid, locked, or unreadable staging needs an explicit recoverable status and must remain intact; never silently discard it.
- **Compatibility fixtures:** cover plaintext and encrypted legacy Training values, all observation keys/shapes, staged and interrupted imports, template tombstones/order, orphan exercises, and multi-device conflicts. Fixtures should be immutable files or deterministic builders, not production data.
- **Observation round-trip acceptance:** verify export/import and Drive merge preserve visible group observations plus hidden legacy-unit records and never change calculated recovery.

### Remaining section 3 context: Recovery correctness

- **Foreground-aware clock:** add a low-frequency timestamp source active only while Recovery is visible and the app is foregrounded. Recalculate at a documented cadence and immediately on foreground; clean up timers/listeners on unmount.
- **Zero-load semantics:** audit tiles, cards, map summaries, details, lists, and accessibility copy. Exact zero burden means 100% ready, no limiting/most-affected unit or group, and `No current mapped burden`; nonzero burden must never display as 100% after rounding.
- **Tagged scope state:** replace ambiguous raw scope strings with explicit variants such as all, saved-template, and custom selection. A missing/deleted template remains a saved-template scope with `Unavailable`, never reinterpreted as an exercise ID or custom scope.
- **Scope agreement:** card selection, four tiles, map coloring, group disclosure, and detail rail/sheet must consume the same scope evaluation. Test live saved template rename, order, sets/reps, exercises, deletion, restoration, and remote reload.
- **Missing planned reps:** choose one documented policy before coding. It must affect scope validity, planned dose, coverage, Estimate Quality fallback copy, and tests identically; do not silently invent repetitions.
- **Orphan custom exercises:** retain their names and prescriptions as unsupported evidence when a definition is missing. They contribute no invented activation and lower coverage without crashing history or templates.
- **Duplicate exercise IDs:** use stable occurrence keys based on scope/template position while aggregating every intentional occurrence. Never use exercise ID alone as a React key where repetitions are allowed.
- **RPE provenance:** distinguish recorded RPE, documented neutral planned-effort fallback, and missing historical effort. Coverage and Estimate Quality must identify which source contributed; never imply exact physiology.
- **Weight exclusion:** keep weight excluded unless the Phase 11 model is deliberately redesigned. Document the rationale and explain that volume/RPE/reps are heuristic fatigue inputs rather than medical or activation measurements.
- **Correctness acceptance tests:** include elapsed-time refresh, zero/tiny/tied burden, saved-template changes, missing reps, orphan definitions, duplicate occurrences, and recorded versus fallback RPE. Assert cards, map, lists, and details remain identical for the active scope.

### Remaining section 4 context: interaction and accessibility

- **Modal/sheet contract:** inventory Custom workout, Estimate Quality, Exercise Guide, region chooser, individual detail, group observation, Recovery outlook, and alerts. Define initial focus, focus restoration, modal semantics, one scroll owner, safe dismissal, reduced motion, and Android/iOS behavior in a reusable scaffold.
- **Estimate Quality -> Guide transition:** serialize close then open; restore focus only when the originating surface still exists. Test rapid taps, hardware back, swipe dismissal, and screen-reader focus.
- **Anatomy accessibility:** SVG/path duplication must expose one logical accessibility target per label/side/shared outline, while retaining every physical source path and touch target. Structural/neutral Neck remains visible but unavailable.
- **Control semantics:** verify segmented controls as selectable choices, accordions with `expanded`, workout/group selections with correct selected state, steppers with value/disabled labels, and the 0-10 observation scale with no default selection.
- **Nested interaction:** audit pressables containing other pressables in cards, disclosures, rows, and headers. Split containers or actions without shrinking 44-point targets or breaking keyboard/screen-reader order.
- **Unicode:** source must remain UTF-8. Several older comments/copy display mojibake sequences; distinguish source corruption from console rendering before removing compatibility repair logic.
- **TrainingSessionView unmount safety:** track and clear the delayed exercise-advance timer; guard asynchronous profile/settings initialization and autosave callbacks after unmount or successful finish. This was identified as a nonblocking follow-up during item 1.3 review.
- **Device acceptance:** test 320/375 widths, landscape, tablet, large Dynamic Type, VoiceOver/TalkBack, reduced motion, modal dismissal, focus restoration, and anatomy selection. Automated snapshots do not replace physical-device checks.

### Remaining section 5 context: cleanup and performance

- **Dead local Recovery code:** start with a fresh `rg` call-site audit of `UnitRow`, `GroupRow`, related styles, props, types, and imports. Remove only code proven unreachable locally.
- **Exported APIs:** treat recovery repositories, legacy parsers, supersede/delete methods, and public selectors as compatibility surfaces. Search the entire repository and tests before removal; deprecate when external use cannot be disproved.
- **exerciseSelectionPreview:** confirm it has no app, test, backup, or external consumer before removal. If retained, document its intended consumer; if removed, update all types and assertions.
- **PerformanceDashboard hardening:** runtime-decode persisted volume snapshots and handle empty/zero chart ranges without division by zero or NaN SVG coordinates. Preserve legacy valid snapshots.
- **Recovery performance:** benchmark realistic long histories first. Record history size, device/runtime, duration, and allocations. Optimize only demonstrated hotspots and preserve numerical results with equivalence fixtures and an explicit negligible-dose tolerance.
- **Cleanup acceptance:** run public-contract and legacy fixtures after removal; for any optimization compare burden, readiness, contributors, limiters, coverage, and projections within documented tolerances.

### Remaining section 6 context: verification and release evidence

- **Automated test command:** expose `runRecoveryAssertions` and storage assertions through a deterministic package script, then organize focused unit/integration/storage/migration/sync failure tests. Keep assertion execution strict because non-strict ad-hoc compilation previously produced false discriminated-union errors.
- **Mutation propagation:** exercise logging, editing, deletion, template edits, custom scopes, reload, restore, and cloud merge through real orchestration boundaries. Assert durable storage -> React state -> Recovery state -> sync intent ordering.
- **Web and Expo Go checks:** cover controls, modal/sheet transitions, map selection, console cleanliness, migrations, and propagation. Record platform limitations rather than treating web as proof of native accessibility.
- **Final automated commands:** run `npx.cmd tsc --noEmit --pretty false`; compile assertions with `--strict`; run recovery and storage assertions; run `git diff --check`; perform the Expo SDK 54 iOS export. Do not install or upgrade dependencies without approval.
- **Physical device validation:** explicitly record device/OS, Expo Go or installed build, dimensions/orientation, Dynamic Type, screen reader, reduced motion, safe areas, and observed failures. Leave unchecked until actually performed.
- **PHASE11 documentation:** update the plan only after behavior stabilizes. Document storage/sync ordering, compatibility/migration, live saved-template semantics, group observations, fatigue inputs and exclusions, accessibility, validation commands, and deliberately deferred decisions.
- **Final orchestrator review:** inspect all diffs and untracked files, confirm every checked task has evidence, preserve unrelated changes, verify branch name, and confirm no commit/push. Summarize known deferrals rather than silently marking them complete.

### Last known verification commands

```powershell
npx.cmd tsc --noEmit --pretty false
.\node_modules\.bin\tsc.cmd --pretty false --strict --skipLibCheck --esModuleInterop --target ES2020 --module commonjs --moduleResolution node --rootDir src --outDir node_modules\.cache\phase11-hardening src\recovery\assertions.ts src\trainingStorageAssertions.ts
node -e "const r=require('./node_modules/.cache/phase11-hardening/recovery/assertions.js'); const s=require('./node_modules/.cache/phase11-hardening/trainingStorageAssertions.js'); r.runRecoveryAssertions(); s.runTrainingStorageAssertions().then(()=>console.log('all hardening assertions passed'))"
git diff --check
```

The first three checklist items passed these checks before the interrupted deletion changes. The current worktree must be revalidated from scratch; no passing result should be inferred for item 1.4 or later work.
