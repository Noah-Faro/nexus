NEXUS/
|-- plan/                    # Product roadmaps and detailed implementation phases
|   |-- phases/              # PHASE0.md through PHASE12.md; sequential Stage 0-12 specifications
|   |-- IDEAS.md             # State-of-the-art life-dashboard backlog
|   |-- IDEASVERBOSE.md      # Extended ML research blueprint
|   |-- PLAN.md              # Deterministic-first implementation roadmap
|   `-- V3.md                # Native data, lifestyle, ML, and Athena blueprint
├── .agents/                 # Collapsed: AI Agent skills, configurations, and reference guides
├── .claude/                 # Collapsed: Local Claude settings and active agent skills
├── .codex/                  # Collapsed: Codex system configuration file
├── .expo/                   # Collapsed: Expo mobile framework build cache and device registries
├── assets/                  # Collapsed: App icon and splash screen image assets
├── dashboard_ideas/         # Experimental dashboard UI components and Phase 11 prototypes
│   ├── archive/
│   │   └── phase11/         # Superseded Phase 11 anatomy explorations
│   │       ├── phase11-recovery-ui-anatomy.html
│   │       ├── phase11-recovery-ui-anatomy-detailed.html
│   │       ├── phase11-recovery-ui-anatomy-repo-detailed.html
│   │       ├── phase11-recovery-ui-anatomy-repo-specific.base
│   │       └── phase11-recovery-ui-anatomy-repo-specific.stage
│   ├── CoachCard.tsx        # UI component displaying coach training suggestions
│   ├── overloadCoach.ts     # Logic handling training load analysis for the coach
│   ├── phase11-recovery-ui.html
│   ├── phase11-recovery-ui-alt.html
│   ├── phase11-recovery-ui-anatomy-repo.html       # Exact repository anatomy reference
│   └── phase11-recovery-ui-anatomy-repo-specific.html # Detailed recovery prototype handoff
├── src/                     # Expanded: Main application source code folder
│   ├── components/          # Expanded: Reusable UI component modules for the training layout
│   │   ├── ActiveWorkoutBanner.tsx   # Persistent floating banner displaying active workout and 1-tap water
│   │   ├── ActiveWorkoutCard.tsx     # Ticking active workout summary card rendered on Training home view
│   │   ├── AppAlertModal.tsx         # Modal displaying critical system or error alerts
│   │   ├── BrewLabSheet.tsx          # Bottom sheet or overlay for custom formula tracking
│   │   ├── CalendarHeatmap.tsx       # Visual grid mapping user workout consistency over time
│   │   ├── CoachCard.tsx             # Interactive dashboard card managing coach suggestions
│   │   ├── CommandPalette.tsx        # Global search and quick-action utility overlay
│   │   ├── DailyNoteView.tsx         # Panel for reviewing or editing single-day training logs
│   │   ├── ExercisePickerModal.tsx   # Selection overlay filtering target gym movements
│   │   ├── ExerciseSynthesizer.tsx   # Controller combining historical metrics for custom drills
│   │   ├── GoalModal.tsx             # Configuration interface defining target fitness goals
│   │   ├── GraphView.tsx             # Performance dashboard chart plotting volume progressions
│   │   ├── Header.tsx                # Main top-navigation and branding layout component
│   │   ├── NexusVault.tsx            # Protected secure UI for critical data management
│   │   ├── PasswordPromptModal.tsx   # Lockscreen modal verifying user credentials
│   │   ├── PresetButtons.tsx         # Utility component rendering quick-input setup values
│   │   ├── QuickWaterModal.tsx       # OLED-first in-workout quick water logging modal with progress
│   │   ├── ReorderableTemplateList.tsx # Drag-and-drop workflow ordering workout routines
│   │   ├── recovery/                    # Recovery dashboard, anatomy map, and supporting sheets
│   │   ├── SegmentedControl.tsx      # Toggle switch parsing active layout categories
│   │   ├── SettingsModal.tsx         # App preferences and synchronization configuration panel
│   │   ├── SheetHeader.tsx           # Standard formatting block finishing sheet components
│   │   ├── StepperInput.tsx          # Numeric button stepper tweaking set weight or repetition count
│   │   ├── SyncIndicator.tsx         # Header status item flashing dynamic database backup health
│   │   ├── SyncPreviewModal.tsx      # Diagnostic overlay previewing cloud data changes
│   │   ├── TemplateEditorSheet.tsx   # Program designer module creating customized workout structures
│   │   ├── TrainingApp.tsx           # High-level shell coordinating absolute layout injection
│   │   ├── TrainingDashboard.tsx     # Central user lander presenting active logs and suggestions
│   │   ├── TrainingHistory.tsx       # Expandable logging archive mapping past gym performance
│   │   ├── TrainingSessionView.tsx   # Dynamic active tracker recording immediate active workout items
│   │   └── TrainingSettings.tsx      # Specific adjustments shifting profile configuration metrics
│   ├── exerciseLibrary.ts   # Data store containing the library of trackable gym exercises
│   ├── backupPayload.ts     # Pure backup payload builder excluding local transaction journals
│   ├── finishSessionTransaction.ts # Two-write durable finish boundary with one in-memory commit
│   ├── googleAuth.ts        # Google Account user authentication workflows
│   ├── googleDrive.ts       # Google Drive API interactions for cloud storage sync
│   ├── gymStorage.ts        # Local storage utility mapping exercise and workout tracking data
│   ├── mergeReplay.ts       # Pure ordered replay that retains staging until every write succeeds
│   ├── overloadCoach.ts     # Progressive overload coaching recommendation module
│   ├── recovery/             # Deterministic muscle recovery model, anatomy registry, and selectors
│   ├── security.ts          # Password vault protection and data encryption features
│   ├── serializedAsyncQueue.ts # Non-poisoning ordered queue for active-session persistence
│   ├── sessionDeletionJournal.ts # Encrypted crash-recovery journal for completed-session deletion
│   ├── sessionDeletionRecovery.ts # Pure injected crash-state decisions and validation
│   ├── sessionDeletionSyncGate.ts # Root backup/sync gate for pending deletion recovery
│   ├── sessionDeletionSyncGateRuntime.ts # Native storage adapter for the root sync gate
│   ├── sessionDeletionTransaction.ts # Strict history/tombstone deletion transaction and rollback
│   ├── storage.ts           # Global application state and storage coordinator
│   ├── structuredStorage.ts # Pure read/decrypt/validation status classification for persisted JSON
│   ├── sync.ts              # Data synchronization engine handling remote backups
│   ├── syncSnapshot.ts      # Conflict resolution snapshots for backup rollbacks
│   ├── theme.ts             # Application dark and light mode UI styling variables
│   ├── tombstones.ts        # Deleted record marking for offline first sync handling
│   ├── tombstoneTransactionQueue.ts # Shared lock for complete tombstone transactions
│   ├── trainingDefaults.ts  # Immutable repository workout prescriptions and mutable default clones
│   ├── trainingDecoders.ts  # Versioned runtime validation for persisted Training and Recovery inputs
│   ├── trainingStorage.ts   # Specialized file interaction tracking for user training logs
│   ├── trainingStorageAssertions.ts # Deterministic structured-load and compatibility assertions
│   ├── trainingStorageKeys.ts # Canonical persisted Training storage identifiers
│   ├── trainingTypes.ts     # Data structure type systems mapping training protocols
│   ├── types.ts             # Global TypeScript type definitions
│   ├── utils.ts             # Shared layout and math helper computations

├── .gitignore               # Excludes dependency and cache files from git version control
├── AGENTS.md                # Documentation listing active project agent behaviors
├── App.tsx                  # Main root React Native application rendering component entrypoint
├── CLAUDE.md                # Context file mapping system boundaries and coding guidelines
├── GOOGLE_CLOUD.md          # Guide mapping cloud database architecture steps
├── IDEAS.md                 # Product development backlog and user stories
├── LICENSE                  # MIT project distribution authorization rules
├── STYLE_GUIDE.md           # Coding style standard rules for components and typescript
├── app.json                 # Core configuration manifest mapping Expo framework build rules
├── eas.json                 # Compilation profiles setting up Expo Application Services deployments
├── index.ts                 # Registry file bootstrapping the absolute code execution path
├── package.json             # Registry containing app metadata and structural project dependencies
└── tsconfig.json            # Parameters enforcing global TypeScript compiler rules
