import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import {
  CANONICAL_TEMPLATE_ID_BY_PRESET,
  CANONICAL_WORKOUT_TEMPLATES,
  createDefaultWorkoutTemplates,
} from '../trainingDefaults';
import type { LoggedSet, WorkoutSession } from '../trainingTypes';
import {
  decodeActiveSession,
  decodeCustomExercises,
  decodeExerciseDefaults,
  decodeWorkoutSessions,
  decodeWorkoutTemplates,
  recoveryHistoryCompletenessForStatus,
  TRAINING_STORAGE_DECODER_VERSION,
} from '../trainingDecoders';
import {
  ACTIVATION_BUDGET_IDS,
  RECOVERY_GROUP_BY_ID,
  RECOVERY_GROUPS,
  RECOVERY_UNIT_BY_ID,
  RECOVERY_UNITS,
} from './definitions';
import {
  ACTIVATION_BUDGET_REGISTRY,
  QUALITATIVE_EXERCISE_IDS,
  RESOLVED_EXERCISE_PROFILES,
  validateActivationRegistry,
} from './activationRegistry';
import { EXERCISE_IMPACT_GUIDE } from './exerciseImpactGuide';
import {
  calculateSetDose,
  effortFactor,
  repFactor,
} from './setDose';
import {
  burdenFromLatent,
  calculateRecoveryState,
  decayFactor,
} from './recoveryModel';
import { aggregateRecoveryGroup } from './groupAggregation';
import {
  evaluateRecoveryScope,
  resolveRecoveryScope as resolveRecoveryScopeWithTemplates,
} from './scopeAggregation';
import {
  selectScopeRecoveryGroupSummaries,
  selectScopeRecoveryPresentationGroupSummaries,
} from './selectors';
import {
  createRecoveryGroupObservation,
  parseStoredRecoveryObservations,
  selectRecoveryGroupObservations,
} from './checkInRepository';
import {
  assertMuscleRecoveryUnitId,
  assertRecoveryGroupId,
  assertRecoveryPresentationGroupId,
  isMuscleRecoveryUnitId,
  isRecoveryGroupId,
  isRecoveryPresentationGroupId,
  MUSCLE_RECOVERY_UNIT_IDS,
  RECOVERY_GROUP_IDS,
} from './types';
import type { MuscleRecoveryUnitId, UnitRecoverySignal } from './types';

const resolveRecoveryScope = (
  scope: Parameters<typeof resolveRecoveryScopeWithTemplates>[0],
) => resolveRecoveryScopeWithTemplates(scope, createDefaultWorkoutTemplates());

const TOLERANCE = 1e-9;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Recovery assertion failed: ${message}`);
  }
}

function approximatelyEqual(left: number, right: number, tolerance = TOLERANCE): boolean {
  return Math.abs(left - right) <= tolerance;
}

function loggedSet(
  id: string,
  exerciseId: string,
  options: {
    reps?: number;
    rpe?: number;
    isWarmup?: boolean;
    timestamp?: number;
  } = {},
): LoggedSet {
  return {
    id,
    exerciseId,
    exerciseName: EXERCISE_LIBRARY[exerciseId]?.name ?? exerciseId,
    setNumber: 1,
    weight: 1,
    weightUnit: 'kg',
    reps: options.reps ?? 8,
    rpe: options.rpe,
    isWarmup: options.isWarmup ?? false,
    timestamp: options.timestamp ?? 0,
    estimated1RM: 1,
  };
}

function session(
  id: string,
  endTime: number | undefined,
  sets: LoggedSet[],
): WorkoutSession {
  return {
    id,
    templateId: `${id}-template`,
    templateName: `${id} session`,
    startTime: (endTime ?? 0) - 3_600_000,
    endTime,
    sets,
    totalVolume: 0,
    sessionNumber: 1,
  };
}

function syntheticSignal(
  unitId: MuscleRecoveryUnitId,
  burden: number,
): UnitRecoverySignal {
  return {
    unitId,
    asOf: 0,
    available: true,
    latentBurden: 0,
    burden,
    readiness: 100 - burden,
    scale: 1,
    halfLifeHours: 24,
    contributors: [],
    projection: [],
    lastMaterialLoadAt: null,
    issueCodes: [],
  };
}

export function runRecoveryAssertions(): void {
  assert(TRAINING_STORAGE_DECODER_VERSION === 1, 'training decoder contract is explicitly versioned');

  const legacySetValue: Record<string, unknown> = {
    id: 'legacy-set',
    exerciseId: 'bench-press',
    exerciseName: 'Bench Press',
    setNumber: 1,
    weight: 80,
    reps: 8,
    timestamp: 1_000,
    estimated1RM: 101,
    harmlessFutureField: 'preserved',
  };
  const legacySessionValue: Record<string, unknown> = {
    id: 'legacy-session',
    templateId: CANONICAL_TEMPLATE_ID_BY_PRESET.push,
    templateName: 'Push A',
    startTime: 0,
    endTime: 2_000,
    sets: [legacySetValue],
    totalVolume: 640,
    sessionNumber: 1,
    harmlessFutureField: { retained: true },
  };
  const legacySessions = decodeWorkoutSessions([legacySessionValue]);
  assert(legacySessions.ok, 'legacy sessions without RPE, warmup, duration, or exercise snapshots remain valid');
  assert(
    (legacySessions.value[0] as WorkoutSession & { harmlessFutureField?: unknown }).harmlessFutureField != null,
    'harmless unknown session fields are preserved in memory',
  );
  assert(
    (legacySessions.value[0].sets[0] as LoggedSet & { harmlessFutureField?: unknown }).harmlessFutureField === 'preserved',
    'harmless unknown set fields are preserved in memory',
  );
  assert(
    legacySessions.value[0].sets[0].weightUnit === 'kg' && legacySetValue.weightUnit === undefined,
    'missing legacy set weightUnit is normalized to kg without mutating raw input',
  );
  assert(
    !decodeWorkoutSessions([{
      ...legacySessionValue,
      sets: [{ ...legacySetValue, weightUnit: 'stone' }],
    }]).ok,
    'invalid present set weightUnit is rejected',
  );

  const partialSessions = decodeWorkoutSessions([
    legacySessionValue,
    { ...legacySessionValue, id: 'broken-session', sets: [{ ...legacySetValue, reps: 'eight' }] },
  ]);
  assert(!partialSessions.ok, 'malformed nested set data is rejected at runtime');
  assert(partialSessions.recoverableValue.length === 1, 'valid session siblings remain safely recoverable');
  assert(
    partialSessions.issues.some(item => item.path === 'sessions[1].sets[0].reps'),
    'session decoder reports the exact malformed nested path',
  );
  assert(
    recoveryHistoryCompletenessForStatus('invalid') === 'unknown' &&
      recoveryHistoryCompletenessForStatus('unreadable') === 'unknown' &&
      recoveryHistoryCompletenessForStatus('locked') === 'unknown',
    'invalid or unreadable completed history produces unknown Recovery history',
  );
  assert(
    recoveryHistoryCompletenessForStatus('valid') === 'complete' &&
      recoveryHistoryCompletenessForStatus('absent') === 'complete',
    'valid and genuinely absent completed history remain complete inputs',
  );

  const validPushTemplate = {
    id: CANONICAL_TEMPLATE_ID_BY_PRESET.push,
    name: 'Renamed Push',
    exercises: [{ exerciseId: 'bench-press', targetSets: 3, targetReps: 8 }],
    harmlessFutureField: 42,
  };
  const partialTemplates = decodeWorkoutTemplates([
    validPushTemplate,
    {
      id: CANONICAL_TEMPLATE_ID_BY_PRESET.pull,
      name: 'Broken Pull',
      exercises: [{ exerciseId: 'barbell-row', targetSets: 'three', targetReps: 8 }],
    },
  ]);
  assert(!partialTemplates.ok, 'malformed template prescriptions are rejected at runtime');
  assert(
    partialTemplates.recoverableValue.length === 1 &&
      partialTemplates.recoverableValue[0].id === CANONICAL_TEMPLATE_ID_BY_PRESET.push,
    'a malformed template does not suppress a separately valid canonical template',
  );
  const recoveredPushScope = resolveRecoveryScopeWithTemplates(
    { type: 'template', templateId: CANONICAL_TEMPLATE_ID_BY_PRESET.push },
    partialTemplates.recoverableValue,
  );
  const missingPullScope = resolveRecoveryScopeWithTemplates(
    { type: 'template', templateId: CANONICAL_TEMPLATE_ID_BY_PRESET.pull },
    partialTemplates.recoverableValue,
  );
  assert(
    !recoveredPushScope.issueCodes.includes('template_not_found'),
    'validated canonical template remains resolvable after partial corruption',
  );
  assert(
    missingPullScope.issueCodes.includes('template_not_found'),
    'only the excluded malformed canonical template becomes unavailable',
  );

  const customExercises = decodeCustomExercises([{
    id: 'legacy-custom',
    name: 'Legacy Custom',
    muscleGroup: 'core',
    equipment: 'bodyweight',
    incrementStep: 1,
    isCustom: true,
  }]);
  assert(customExercises.ok, 'legacy custom exercises without newer optional fields remain valid');
  assert(customExercises.value[0].weightUnit === 'kg', 'missing legacy custom-exercise weightUnit defaults to kg');
  assert(
    !decodeCustomExercises([{
      id: 'invalid-unit',
      name: 'Invalid Unit',
      muscleGroup: 'core',
      equipment: 'bodyweight',
      incrementStep: 1,
      isCustom: true,
      weightUnit: 'stone',
    }]).ok,
    'invalid present custom-exercise weightUnit is rejected',
  );
  const defaults = decodeExerciseDefaults({
    'legacy-custom': { defaultWeight: 0, defaultReps: 0, harmlessFutureField: true },
  });
  assert(defaults.ok, 'legacy defaults without weightUnit remain valid');
  assert(
    (defaults.value['legacy-custom'] as typeof defaults.value[string] & { harmlessFutureField?: unknown }).harmlessFutureField === true,
    'harmless unknown defaults fields are preserved in memory',
  );
  assert(Object.getPrototypeOf(defaults.value) === null, 'decoded defaults use a null prototype');
  const dangerousDefaults = decodeExerciseDefaults(JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"defaultWeight":1,"defaultReps":1},"safe":{"defaultWeight":1,"defaultReps":1}}',
  ));
  assert(!dangerousDefaults.ok, 'dangerous defaults keys are rejected');
  assert(
    Object.getPrototypeOf(dangerousDefaults.recoverableValue) === null &&
      dangerousDefaults.recoverableValue.safe.defaultWeight === 1 &&
      !('polluted' in dangerousDefaults.recoverableValue),
    'safe defaults recover without prototype mutation or inherited values',
  );
  const invalidActiveSession = decodeActiveSession({ ...legacySessionValue, sets: 'not-an-array' });
  assert(!invalidActiveSession.ok, 'invalid active-session input is isolated and rejected');
  assert(invalidActiveSession.recoverableValue === null, 'invalid active session can only recover to safe null');
  assert(
    recoveryHistoryCompletenessForStatus('valid') === 'complete',
    'active-session failure does not independently downgrade completed Recovery history',
  );

  assert(RECOVERY_UNITS.length === 51, '51 recovery units');
  assert(
    JSON.stringify(RECOVERY_UNITS.map((unit) => unit.id)) ===
      JSON.stringify(MUSCLE_RECOVERY_UNIT_IDS),
    'unit definitions match canonical IDs',
  );
  assert(
    JSON.stringify(RECOVERY_GROUPS.map((group) => group.id)) ===
      JSON.stringify(RECOVERY_GROUP_IDS),
    'group definitions match canonical IDs',
  );
  assert(isMuscleRecoveryUnitId('upper_abs'), 'unit ID runtime guard accepts canonical ID');
  assert(!isMuscleRecoveryUnitId('neck'), 'unit ID runtime guard rejects unknown ID');
  assert(isRecoveryGroupId('core'), 'group ID runtime guard accepts canonical ID');
  assert(!isRecoveryGroupId('neck'), 'group ID runtime guard rejects unknown ID');
  assert(
    isRecoveryPresentationGroupId('upper_back'),
    'combined Upper back is a valid presentation group',
  );
  assert(
    !isRecoveryPresentationGroupId('rotator_cuff'),
    'Rotator cuff is not a standalone presentation group',
  );
  assertMuscleRecoveryUnitId('lower_erector_spinae');
  assertRecoveryGroupId('spinal_erectors');
  assertRecoveryPresentationGroupId('upper_back');
  assert(new Set(RECOVERY_UNITS.map((unit) => unit.id)).size === 51, 'unique recovery unit IDs');
  assert(RECOVERY_GROUPS.length === 17, '17 recovery groups');
  assert(new Set(RECOVERY_GROUPS.flatMap((group) => group.unitIds)).size === 51, 'each unit belongs to a group');
  assert(ACTIVATION_BUDGET_IDS.length === 20, '20 activation budgets');
  assert(RECOVERY_UNITS.filter((unit) => unit.mapSelectable).length === 47, '47 map-selectable units');
  assert(RECOVERY_UNITS.filter((unit) => !unit.mapSelectable).length === 4, 'four list-only units');

  const libraryIds = Object.keys(EXERCISE_LIBRARY).sort();
  const guideIds = EXERCISE_IMPACT_GUIDE.map((exercise) => exercise.id).sort();
  assert(libraryIds.length === 87, '87 repository exercises');
  assert(JSON.stringify(libraryIds) === JSON.stringify(guideIds), 'guide exactly covers exercise library');
  assert(
    EXERCISE_IMPACT_GUIDE.every((exercise) =>
      [
        ...exercise.primaryUnitIds,
        ...exercise.secondaryUnitIds,
        ...exercise.stabilizerUnitIds,
      ].every(isMuscleRecoveryUnitId),
    ),
    'exercise guide only references canonical unit IDs',
  );
  assert(Object.keys(ACTIVATION_BUDGET_REGISTRY).length === 75, '75 quantitative activation budgets');
  assert(QUALITATIVE_EXERCISE_IDS.length === 12, 'twelve qualitative profiles');
  assert(Object.keys(RESOLVED_EXERCISE_PROFILES).length === 87, '87 resolved profiles');
  assert(validateActivationRegistry().length === 0, 'activation budgets are preserved');

  const bench = RESOLVED_EXERCISE_PROFILES['bench-press'];
  assert(approximatelyEqual(bench.unitCoefficients.upper_chest ?? -1, 0.5), 'bench upper chest is 0.50');
  assert(approximatelyEqual(bench.unitCoefficients.lower_chest ?? -1, 0.5), 'bench lower chest is 0.50');
  assert(approximatelyEqual(bench.unitCoefficients.triceps_long_head ?? -1, 0.2), 'bench long-head triceps is 0.20');
  assert(approximatelyEqual(bench.unitCoefficients.triceps_lateral_head ?? -1, 0.2), 'bench lateral-head triceps is 0.20');
  assert(approximatelyEqual(bench.unitCoefficients.triceps_medial_head ?? -1, 0.2), 'bench medial-head triceps is 0.20');

  assert(effortFactor(5) === 0.35, 'RPE 5 factor');
  assert(effortFactor(6) === 0.45, 'RPE 6 factor');
  assert(effortFactor(7) === 0.6, 'RPE 7 factor');
  assert(effortFactor(8) === 0.75, 'RPE 8 factor');
  assert(effortFactor(9) === 0.9, 'RPE 9 factor');
  assert(effortFactor(10) === 1, 'RPE 10 factor');
  assert(effortFactor(undefined) === 0.75, 'missing RPE fallback');
  assert(effortFactor(11) === 0.75, 'invalid RPE fallback');
  assert(repFactor(1) === 0.85 && repFactor(5) === 0.85, '1..5 rep factor');
  assert(repFactor(6) === 1 && repFactor(12) === 1, '6..12 rep factor');
  assert(repFactor(13) === 1.1 && repFactor(20) === 1.1, '13..20 rep factor');
  assert(repFactor(21) === 1.2 && repFactor(30) === 1.2, '21..30 rep factor');
  assert(repFactor(31) === 1.25, '31+ rep factor');
  assert(repFactor(0) === null && repFactor(Number.NaN) === null, 'invalid reps excluded');
  assert(calculateSetDose(8, 8)?.dose === 0.75, 'weighted-set dose');
  assert(approximatelyEqual(decayFactor(24), 0.5), '24-hour half-life');
  assert(approximatelyEqual(burdenFromLatent(6, 6), 63.212055882855765), 'display transform');

  const asOf = Date.UTC(2026, 6, 15, 18);
  const endedAt = asOf - 24 * 3_600_000;
  const state = calculateRecoveryState(
    [
      session('dose', endedAt, [
        loggedSet('warmup', 'bench-press', { reps: 5, rpe: 5, isWarmup: true }),
        loggedSet('working', 'bench-press', { reps: 8, rpe: 10 }),
      ]),
      session('active', undefined, [loggedSet('active-set', 'bench-press', { rpe: 10 })]),
    ],
    asOf,
  );
  const upperChest = state.units.upper_chest;
  assert(approximatelyEqual(upperChest.latentBurden ?? -1, 0.25), 'unit dose decays independently');
  assert(upperChest.contributors.length === 1, 'warm-up and active session excluded');
  assert(state.historyCoverage.excludedWarmupCount === 1, 'warm-up coverage count');
  assert(state.historyCoverage.excludedActiveSessionCount === 1, 'active session coverage count');
  assert(approximatelyEqual(upperChest.projection[3].latentBurden, 0.125), '24-hour projection');
  assert(upperChest.contributors[0].latentShare === 1, 'contributor latent share');

  const clampedFutureState = calculateRecoveryState(
    [
      session('near-future', asOf + 4 * 60_000, [
        loggedSet('near-future-set', 'bench-press', { reps: 8, rpe: 10 }),
      ]),
    ],
    asOf,
  );
  assert(
    approximatelyEqual(
      clampedFutureState.units.upper_chest.latentBurden ?? -1,
      0.5,
    ),
    'future session within tolerance is clamped to asOf',
  );
  assert(
    clampedFutureState.historyCoverage.issueCodes.includes(
      'future_session_end_clamped',
    ),
    'future clamp is disclosed',
  );

  const excludedFutureState = calculateRecoveryState(
    [
      session('far-future', asOf + 6 * 60_000, [
        loggedSet('far-future-set', 'bench-press', { reps: 8, rpe: 10 }),
      ]),
    ],
    asOf,
  );
  const excludedFutureEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    excludedFutureState,
  );
  assert(
    excludedFutureState.units.upper_chest.contributors.length === 0,
    'future session beyond tolerance contributes no dose',
  );
  assert(
    excludedFutureState.historyCoverage.historyReason === 'invalid_only' &&
      excludedFutureState.historyCoverage.issueCodes.includes(
        'future_session_excluded',
      ),
    'excluded future history is invalid rather than no-load',
  );
  assert(
    excludedFutureEvaluation.status === 'unavailable' &&
      excludedFutureEvaluation.readiness === null,
    'excluded future-only history cannot show confident zero',
  );

  const gluteSignals = Object.fromEntries(
    RECOVERY_GROUPS.find((group) => group.id === 'glutes')!.unitIds.map((unitId) => [
      unitId,
      syntheticSignal(unitId, 63.212055882855765),
    ]),
  );
  const evenGlutes = aggregateRecoveryGroup('glutes', gluteSignals, 0);
  assert(approximatelyEqual(evenGlutes.burden ?? -1, 63.212055882855765), 'uniform group burden');
  const gluteIds = RECOVERY_GROUPS.find((group) => group.id === 'glutes')!.unitIds;
  const concentratedGlutes = aggregateRecoveryGroup(
    'glutes',
    {
      [gluteIds[0]]: syntheticSignal(gluteIds[0], 95.0212931632136),
      [gluteIds[1]]: syntheticSignal(gluteIds[1], 0),
      [gluteIds[2]]: syntheticSignal(gluteIds[2], 0),
    },
    0,
  );
  assert(approximatelyEqual(concentratedGlutes.weightedMean ?? -1, 31.673764387737867), 'group child mean');
  assert(approximatelyEqual(concentratedGlutes.maximum ?? -1, 95.0212931632136), 'group maximum');
  assert(
    approximatelyEqual(concentratedGlutes.burden ?? -1, 47.511, 0.001),
    'group 75/25 aggregation',
  );

  assert(
    JSON.stringify(
      CANONICAL_WORKOUT_TEMPLATES.map((template) => [
        template.id,
        template.exercises.map((exercise) => [
          exercise.exerciseId,
          exercise.targetSets,
          exercise.targetReps,
        ]),
      ]),
    ) ===
      JSON.stringify([
        ['template-push-a', [['bench-press', 3, 8], ['overhead-press', 3, 8], ['lateral-raise', 3, 12], ['tricep-pushdown', 3, 12]]],
        ['template-pull-a', [['barbell-row', 3, 8], ['lat-pulldown', 3, 10], ['bicep-curl', 3, 12]]],
        ['template-legs-a', [['squat', 3, 8], ['romanian-deadlift', 3, 10], ['leg-press', 3, 12], ['calf-raise', 4, 15]]],
      ]),
    'repository template fixture IDs, prescriptions, and source order',
  );
  assert(
    Object.isFrozen(CANONICAL_WORKOUT_TEMPLATES) &&
      CANONICAL_WORKOUT_TEMPLATES.every(
        (template) =>
          Object.isFrozen(template) &&
          Object.isFrozen(template.exercises) &&
          template.exercises.every(Object.isFrozen),
      ),
    'canonical workout prescriptions are deeply immutable',
  );
  const mutableTemplateDefaults = createDefaultWorkoutTemplates();
  assert(
    mutableTemplateDefaults !== CANONICAL_WORKOUT_TEMPLATES &&
      mutableTemplateDefaults.every(
        (template, index) =>
          template !== CANONICAL_WORKOUT_TEMPLATES[index] &&
          template.exercises !== CANONICAL_WORKOUT_TEMPLATES[index].exercises,
      ),
    'storage defaults are mutable copies rather than canonical references',
  );

  const noLoadState = calculateRecoveryState([], asOf);
  const legacyV1Record = {
    id: 'legacy-unit-1',
    unitId: 'upper_chest',
    readiness: 7,
    scaleVersion: 1,
    recordedAt: asOf - 1_000,
    timezoneOffsetMinutes: -120,
    source: 'manual',
    linkedPlannedSessionId: 'planned-1',
    linkedLoadRecordIds: ['load-1'],
    painPresent: false,
    illnessPresent: true,
    modelVersion: 'legacy-model',
    registryVersion: 'legacy-registry',
    createdAt: asOf - 1_000,
    updatedAt: asOf - 1_000,
  };
  const migratedLegacy = parseStoredRecoveryObservations(
    JSON.stringify({
      schemaVersion: 1,
      updatedAt: asOf,
      checkIns: [legacyV1Record],
    }),
  );
  assert(
    migratedLegacy.length === 1 &&
      migratedLegacy[0].target.kind === 'legacy_unit' &&
      migratedLegacy[0].target.unitId === legacyV1Record.unitId &&
      Object.entries(legacyV1Record).every(
        ([field, value]) =>
          JSON.stringify(
            (migratedLegacy[0] as unknown as Record<string, unknown>)[field],
          ) === JSON.stringify(value),
      ),
    'v1 unit observation migrates losslessly into legacy_unit target',
  );
  const upperBackObservation = createRecoveryGroupObservation(
    {
      id: 'group-observation-1',
      presentationGroupId: 'upper_back',
      readiness: 6,
      source: 'manual',
      modelVersion: noLoadState.recoveryModelVersion,
      registryVersion: noLoadState.activationRegistryVersion,
      recordedAt: asOf,
      timezoneOffsetMinutes: -120,
    },
    asOf,
  );
  assert(
    upperBackObservation.target.kind === 'presentation_group' &&
      upperBackObservation.target.presentationGroupId === 'upper_back' &&
      selectRecoveryGroupObservations([
        migratedLegacy[0],
        upperBackObservation,
      ]).length === 1,
    'new writes target combined presentation groups and UI selector hides legacy units',
  );
  const v2RoundTrip = parseStoredRecoveryObservations(
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: asOf,
      observations: [migratedLegacy[0], upperBackObservation],
    }),
  );
  assert(
    v2RoundTrip.length === 2 &&
      v2RoundTrip[0].target.kind === 'legacy_unit' &&
      selectRecoveryGroupObservations(v2RoundTrip)[0].target
        .presentationGroupId === 'upper_back',
    'v2 rewrite round-trips both hidden legacy and visible group targets',
  );
  let rejectedRotatorObservation = false;
  try {
    createRecoveryGroupObservation(
      {
        presentationGroupId: 'rotator_cuff' as 'upper_back',
        readiness: 6,
        source: 'manual',
        modelVersion: noLoadState.recoveryModelVersion,
        registryVersion: noLoadState.activationRegistryVersion,
      },
      asOf,
    );
  } catch {
    rejectedRotatorObservation = true;
  }
  assert(
    rejectedRotatorObservation,
    'standalone Rotator cuff observations fail runtime validation',
  );
  const recoverySnapshotBeforeObservations = JSON.stringify(noLoadState);
  const recoverySnapshotAfterObservations = JSON.stringify(
    calculateRecoveryState([], asOf),
  );
  assert(
    recoverySnapshotAfterObservations === recoverySnapshotBeforeObservations,
    'loading or creating observations cannot affect RecoveryState calculation',
  );
  const savedPush = resolveRecoveryScopeWithTemplates(
    { type: 'preset', preset: 'push' },
    createDefaultWorkoutTemplates(),
  );
  assert(
    savedPush.id === CANONICAL_TEMPLATE_ID_BY_PRESET.push &&
      savedPush.sourceTemplateId === CANONICAL_TEMPLATE_ID_BY_PRESET.push &&
      savedPush.label === 'Push A' &&
      savedPush.exercises.length === 4,
    'preset resolves the current saved template by stable ID',
  );
  const alteredPushTemplates = createDefaultWorkoutTemplates().map((template) =>
    template.id === 'template-push-a'
      ? {
          ...template,
          name: 'Renamed Push',
          exercises: [
            { exerciseId: 'bicep-curl', targetSets: 2, targetReps: 17 },
            { exerciseId: 'bench-press', targetSets: 5, targetReps: 6 },
          ],
        }
      : template,
  );
  const editedPush = resolveRecoveryScopeWithTemplates(
    { type: 'preset', preset: 'push' },
    alteredPushTemplates,
  );
  assert(
    editedPush.label === 'Renamed Push' &&
      JSON.stringify(editedPush.exercises) ===
        JSON.stringify([
          {
            exerciseId: 'bicep-curl',
            targetSets: 2,
            targetReps: 17,
            targetRpe: null,
          },
          {
            exerciseId: 'bench-press',
            targetSets: 5,
            targetReps: 6,
            targetRpe: null,
          },
        ]),
    'preset imports the saved name, exercise order, IDs, sets, and reps',
  );
  const deletedPreset = resolveRecoveryScopeWithTemplates(
    { type: 'preset', preset: 'push' },
    createDefaultWorkoutTemplates().filter(
      (template) => template.id !== CANONICAL_TEMPLATE_ID_BY_PRESET.push,
    ),
  );
  assert(
    deletedPreset.label === 'Unavailable template' &&
      deletedPreset.exercises.length === 0 &&
      deletedPreset.issueCodes.includes('template_not_found'),
    'deleted preset is explicitly unavailable without repository fallback',
  );
  const deletedPresetEvaluation = evaluateRecoveryScope(
    deletedPreset,
    noLoadState,
  );
  assert(
    deletedPresetEvaluation.status === 'unavailable' &&
      deletedPresetEvaluation.readiness === null,
    'deleted preset cannot evaluate as a confident zero-load scope',
  );
  const missingTemplateScope = resolveRecoveryScopeWithTemplates(
    { type: 'template', templateId: 'missing-template' },
    [],
  );
  assert(
    missingTemplateScope.label === 'Unavailable template' &&
      missingTemplateScope.exercises.length === 0 &&
      missingTemplateScope.issueCodes.includes('template_not_found'),
    'missing editable template resolves explicitly without invented exercises',
  );
  const missingTemplateEvaluation = evaluateRecoveryScope(
    missingTemplateScope,
    noLoadState,
  );
  assert(
    missingTemplateEvaluation.status === 'unavailable' &&
      missingTemplateEvaluation.readiness === null &&
      missingTemplateEvaluation.targets.length === 0 &&
      missingTemplateEvaluation.coverage.issueCodes.includes('template_not_found'),
    'missing editable template evaluates as unavailable rather than confident zero',
  );
  const allEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'all' }),
    noLoadState,
  );
  const pushEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    noLoadState,
  );
  const pullEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'pull' }),
    noLoadState,
  );
  const legsEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'legs' }),
    noLoadState,
  );
  const groupSummaryCases = [
    [allEvaluation, 17, 'All'],
    [pushEvaluation, 7, 'Push'],
    [pullEvaluation, 5, 'Pull'],
    [legsEvaluation, 9, 'Legs'],
  ] as const;
  for (const [evaluation, expectedCount, label] of groupSummaryCases) {
    const summaries = selectScopeRecoveryGroupSummaries(
      evaluation,
      noLoadState,
    );
    assert(
      summaries.length === expectedCount,
      `${label} scope has ${expectedCount} relevant recovery groups`,
    );
    assert(
      approximatelyEqual(
        summaries.reduce(
          (total, summary) => total + summary.scopeRelevance,
          0,
        ),
        1,
      ),
      `${label} group relevance preserves normalized target relevance`,
    );
    for (const summary of summaries) {
      const canonical = noLoadState.groups[summary.groupId];
      assert(
        summary.burden === canonical.burden &&
          summary.readiness === canonical.readiness &&
          summary.status === canonical.status,
        `${label} group summary uses canonical group signal`,
      );
      assert(
        JSON.stringify(summary.childUnitIds) ===
          JSON.stringify(canonical.childSignals.map((child) => child.unitId)),
        `${label} group summary preserves canonical children`,
      );
    }
  }
  const presentationSummaryCases = [
    [allEvaluation, 16, 'All'],
    [pushEvaluation, 6, 'Push'],
    [pullEvaluation, 5, 'Pull'],
    [legsEvaluation, 9, 'Legs'],
  ] as const;
  for (const [evaluation, expectedCount, label] of presentationSummaryCases) {
    const summaries = selectScopeRecoveryPresentationGroupSummaries(
      evaluation,
      noLoadState,
    );
    assert(
      summaries.length === expectedCount,
      `${label} scope has ${expectedCount} visible presentation groups`,
    );
    assert(
      approximatelyEqual(
        summaries.reduce(
          (total, summary) => total + summary.scopeRelevance,
          0,
        ),
        1,
      ),
      `${label} presentation relevance preserves normalized target relevance`,
    );
    assert(
      summaries.every(
        (summary) =>
          (summary.presentationGroupId as string) !== 'rotator_cuff',
      ),
      `${label} does not expose Rotator cuff as a separate presentation group`,
    );
  }
  const upperBackPresentation = selectScopeRecoveryPresentationGroupSummaries(
    allEvaluation,
    state,
  ).find((summary) => summary.presentationGroupId === 'upper_back');
  assert(
    JSON.stringify(upperBackPresentation?.sourceGroupIds) ===
      JSON.stringify(['upper_back', 'rotator_cuff']) &&
      upperBackPresentation?.childUnitIds.length === 8 &&
      upperBackPresentation.childUnitIds.includes('subscapularis'),
    'visible Upper back combines both canonical groups and all eight child units',
  );
  const upperBackChildBurdens = upperBackPresentation?.childUnitIds.map(
    (unitId) => state.units[unitId].burden ?? 0,
  ) ?? [];
  const upperBackWeightedMean = upperBackPresentation?.childUnitIds.reduce(
    (total, unitId) =>
      total +
      (state.units[unitId].burden ?? 0) *
        RECOVERY_UNIT_BY_ID[unitId].aggregationWeight,
    0,
  ) ?? 0;
  const upperBackTotalWeight = upperBackPresentation?.childUnitIds.reduce(
    (total, unitId) =>
      total + RECOVERY_UNIT_BY_ID[unitId].aggregationWeight,
    0,
  ) ?? 0;
  assert(
    upperBackPresentation?.burden != null &&
      approximatelyEqual(
        upperBackPresentation.burden,
        0.75 * (upperBackWeightedMean / upperBackTotalWeight) +
          0.25 * Math.max(...upperBackChildBurdens),
      ),
    'visible Upper back uses exact weighted 75/25 bottom-up aggregation',
  );
  const rotatorLimitingSummaries =
    selectScopeRecoveryPresentationGroupSummaries(
      { ...allEvaluation, limitingUnitId: 'supraspinatus' },
      noLoadState,
    );
  assert(
    rotatorLimitingSummaries.filter(
      (summary) => summary.containsLimitingUnit,
    ).length === 1 &&
      rotatorLimitingSummaries.find(
        (summary) => summary.containsLimitingUnit,
      )?.presentationGroupId === 'upper_back',
    'rotator-cuff limiting units map to the visible Upper back group',
  );
  const allGroupSummaries = selectScopeRecoveryGroupSummaries(
    allEvaluation,
    noLoadState,
  );
  assert(
    JSON.stringify(allGroupSummaries.map((summary) => summary.groupId)) ===
      JSON.stringify(RECOVERY_GROUPS.map((group) => group.id)),
    'equal-burden groups retain canonical registry order',
  );
  assert(
    allGroupSummaries.every(
      (summary) =>
        summary.mostBurdenedUnitId ===
        RECOVERY_GROUP_BY_ID[summary.groupId].unitIds[0],
    ),
    'equal-burden children retain canonical unit order',
  );
  const pushGroupSummaries = selectScopeRecoveryGroupSummaries(
    pushEvaluation,
    noLoadState,
  );
  assert(
    pushEvaluation.limitingUnitId === null &&
      pushEvaluation.maximumCriticalBurden === 0 &&
      pushGroupSummaries.every((summary) => !summary.containsLimitingUnit),
    'zero burden has no limiting unit while preserving a numeric maximum',
  );
  assert(
    allGroupSummaries
      .find((summary) => summary.groupId === 'rotator_cuff')
      ?.childUnitIds.includes('subscapularis') === true &&
      allGroupSummaries
        .find((summary) => summary.groupId === 'quadriceps')
        ?.childUnitIds.includes('vastus_intermedius') === true &&
      allGroupSummaries
        .find((summary) => summary.groupId === 'hip_flexors')
        ?.childUnitIds.includes('psoas_major') === true &&
      allGroupSummaries
        .find((summary) => summary.groupId === 'hip_flexors')
        ?.childUnitIds.includes('iliacus') === true,
    'list-only units remain discoverable through group summaries',
  );
  const loadedGroupSummaries = selectScopeRecoveryGroupSummaries(
    evaluateRecoveryScope(
      resolveRecoveryScope({ type: 'preset', preset: 'push' }),
      state,
    ),
    state,
  );
  assert(
    loadedGroupSummaries.every(
      (summary, index) =>
        index === 0 ||
        (loadedGroupSummaries[index - 1].burden ?? -1) >=
          (summary.burden ?? -1),
    ),
    'group summaries sort by descending canonical burden',
  );
  assert(
    loadedGroupSummaries.find((summary) => summary.groupId === 'chest')
      ?.lastMaterialLoadAt === endedAt,
    'group latest mapped load is the latest child timestamp',
  );
  assert(pushEvaluation.status === 'available', 'known no-load scope is available');
  assert(pushEvaluation.burden === 0 && pushEvaluation.readiness === 100, 'known no-load result is numeric zero burden');
  assert(pushEvaluation.coverage.effortCoverage === null, 'effort coverage is not applicable without load');
  assert(
    approximatelyEqual(
      pushEvaluation.burden ?? -1,
      0.75 * (pushEvaluation.weightedTargetBurden ?? 0) +
        0.25 * (pushEvaluation.maximumCriticalBurden ?? 0),
    ),
    'scope 75/25 aggregation',
  );

  const withUnitBurdens = (
    burdens: Readonly<Partial<Record<MuscleRecoveryUnitId, number>>>,
  ) => ({
    ...noLoadState,
    units: Object.fromEntries(
      Object.entries(noLoadState.units).map(([unitId, signal]) => {
        const burden = burdens[unitId as MuscleRecoveryUnitId] ?? 0;
        return [unitId, { ...signal, burden, readiness: 100 - burden }];
      }),
    ),
  });
  const criticalForTie = [...pushEvaluation.criticalUnitIds]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 2);
  assert(criticalForTie.length === 2, 'Push fixture exposes two critical units');
  const tinyBurden = Number.EPSILON;
  const tinyEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    withUnitBurdens({ [criticalForTie[1]]: tinyBurden }),
  );
  assert(
    tinyEvaluation.maximumCriticalBurden === tinyBurden &&
      tinyEvaluation.limitingUnitId === criticalForTie[1],
    'any nonzero burden, including a tiny burden, identifies its limiter',
  );
  const tiedEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    withUnitBurdens({
      [criticalForTie[0]]: 3,
      [criticalForTie[1]]: 3,
    }),
  );
  assert(
    tiedEvaluation.maximumCriticalBurden === 3 &&
      tiedEvaluation.limitingUnitId === criticalForTie[0],
    'tied nonzero burden uses deterministic unit-ID ordering',
  );
  assert(
    approximatelyEqual(
      tiedEvaluation.burden ?? -1,
      0.75 * (tiedEvaluation.weightedTargetBurden ?? 0) +
        0.25 * (tiedEvaluation.maximumCriticalBurden ?? 0),
    ),
    'limiter semantics do not change the 75/25 scope formula',
  );

  const unsupportedEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({
      type: 'prescription',
      id: 'plank-only',
      label: 'Plank',
      exercises: [{ exerciseId: 'plank', targetSets: 3, targetReps: 30, targetRpe: null }],
    }),
    noLoadState,
  );
  assert(unsupportedEvaluation.status === 'unavailable', 'qualitative-only scope unavailable');
  assert(unsupportedEvaluation.readiness === null, 'qualitative-only scope has no percentage');
  const mixedEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({
      type: 'prescription',
      id: 'mixed',
      label: 'Mixed',
      exercises: [
        { exerciseId: 'bench-press', targetSets: 3, targetReps: 8, targetRpe: null },
        { exerciseId: 'plank', targetSets: 3, targetReps: 8, targetRpe: null },
      ],
    }),
    noLoadState,
  );
  assert(mixedEvaluation.status === 'limited', 'mixed-support scope limited');
  assert(approximatelyEqual(mixedEvaluation.coverage.mappingCoverage ?? -1, 0.5), 'mixed mapping coverage');

  const mixedHistoryState = calculateRecoveryState(
    [
      session('mixed-history', endedAt, [
        loggedSet('mapped', 'bench-press', { rpe: 8 }),
        loggedSet('qualitative', 'plank', { rpe: 8 }),
      ]),
    ],
    asOf,
  );
  const mixedHistoryEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    mixedHistoryState,
  );
  assert(
    approximatelyEqual(
      mixedHistoryEvaluation.coverage.mappingCoverage ?? -1,
      1,
    ),
    'scope mapping coverage remains planned-dose coverage',
  );
  assert(
    approximatelyEqual(
      mixedHistoryEvaluation.coverage.historicalMappingCoverage ?? -1,
      0.5,
    ),
    'mixed historical mapping is disclosed separately',
  );
  assert(
    mixedHistoryEvaluation.coverage.unsupportedExerciseIds.includes('plank'),
    'history unsupported exercises are surfaced in scope coverage',
  );

  const unsupportedHistoryState = calculateRecoveryState(
    [
      session('unsupported-history', endedAt, [
        loggedSet('plank', 'plank', { rpe: 8 }),
      ]),
    ],
    asOf,
  );
  const unsupportedHistoryEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    unsupportedHistoryState,
  );
  assert(
    unsupportedHistoryEvaluation.status === 'available' &&
      unsupportedHistoryEvaluation.readiness === 100 &&
      unsupportedHistoryEvaluation.burden === 0,
    'qualitative-only known history yields zero mapped load for a supported scope',
  );
  assert(
    unsupportedHistoryEvaluation.coverage.mappingCoverage === 1 &&
      unsupportedHistoryEvaluation.coverage.historicalMappingCoverage === 0 &&
      unsupportedHistoryEvaluation.coverage.effortCoverage === null,
    'qualitative history is disclosed without changing planned mapping coverage',
  );

  const invalidOnlyState = calculateRecoveryState(
    [
      session('invalid-only', endedAt, [
        loggedSet('invalid-reps', 'bench-press', { reps: 0, rpe: 8 }),
      ]),
    ],
    asOf,
  );
  const invalidOnlyEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    invalidOnlyState,
  );
  assert(
    invalidOnlyEvaluation.status === 'unavailable',
    'invalid-only history is unavailable',
  );
  const partlyInvalidState = calculateRecoveryState(
    [
      session('partly-invalid', endedAt, [
        loggedSet('valid-reps', 'bench-press', { reps: 8, rpe: 8 }),
        loggedSet('invalid-reps', 'bench-press', { reps: 0, rpe: 8 }),
      ]),
    ],
    asOf,
  );
  const partlyInvalidEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    partlyInvalidState,
  );
  assert(
    partlyInvalidEvaluation.status === 'limited',
    'partly invalid history is limited',
  );

  const unknownState = calculateRecoveryState([], asOf, {
    historyCompleteness: 'unknown',
  });
  const unknownEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    unknownState,
  );
  assert(unknownEvaluation.status === 'unavailable', 'unknown history unavailable');
  assert(unknownEvaluation.readiness === null, 'unknown history never becomes zero');

  const missingRpeState = calculateRecoveryState(
    [session('missing-rpe', endedAt, [loggedSet('set', 'bench-press')])],
    asOf,
  );
  const missingRpeEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({ type: 'preset', preset: 'push' }),
    missingRpeState,
  );
  assert(missingRpeEvaluation.status === 'limited', 'missing RPE lowers status');
  assert(missingRpeEvaluation.coverage.effortCoverage === 0, 'missing RPE effort coverage');
  assert(missingRpeEvaluation.coverage.fallbacks.some((fallback) => fallback.includes('0.75')), 'missing RPE disclosed');

  const selection = resolveRecoveryScope({
    type: 'exercise_selection',
    exerciseIds: ['bench-press'],
  });
  assert(
    selection.exercises[0].targetSets === 3 &&
      selection.exercises[0].targetReps === 10,
    'exercise selection defaults to 3x10',
  );
  const invalidPlanEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({
      type: 'prescription',
      id: 'invalid-plan',
      label: 'Invalid plan',
      exercises: [
        {
          exerciseId: 'bench-press',
          targetSets: 11,
          targetReps: 8,
          targetRpe: null,
        },
      ],
    }),
    noLoadState,
  );
  assert(
    invalidPlanEvaluation.status === 'unavailable',
    'invalid-only planned prescription is unavailable',
  );
  const partlyInvalidPlanEvaluation = evaluateRecoveryScope(
    resolveRecoveryScope({
      type: 'prescription',
      id: 'partly-invalid-plan',
      label: 'Partly invalid plan',
      exercises: [
        {
          exerciseId: 'bench-press',
          targetSets: 3,
          targetReps: 8,
          targetRpe: null,
        },
        {
          exerciseId: 'bicep-curl',
          targetSets: 3,
          targetReps: 51,
          targetRpe: null,
        },
      ],
    }),
    noLoadState,
  );
  assert(
    partlyInvalidPlanEvaluation.status === 'limited',
    'partly invalid planned prescription cannot be available',
  );
}
