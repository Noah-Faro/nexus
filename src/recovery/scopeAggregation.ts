import type { TemplateExercise, WorkoutTemplate } from '../trainingTypes';
import { CANONICAL_TEMPLATE_ID_BY_PRESET } from '../trainingDefaults';
import {
  ACTIVATION_REGISTRY_VERSION,
  getResolvedExerciseProfile,
} from './activationRegistry';
import { createCoverageSummary } from './coverage';
import { RECOVERY_UNITS } from './definitions';
import { RECOVERY_MODEL_VERSION } from './recoveryModel';
import { calculatePlannedSetDose } from './setDose';
import type {
  MuscleRecoveryUnitId,
  PlannedExercise,
  RecoveryScope,
  RecoveryScopeEvaluation,
  RecoveryState,
  ResolvedRecoveryScope,
  ScopeTargetEvaluation,
} from './types';

function templateToExercises(template: {
  readonly exercises: readonly Readonly<TemplateExercise>[];
}): PlannedExercise[] {
  return template.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    targetRpe: null,
  }));
}

function targetFallbacks(exercises: readonly PlannedExercise[]): string[] {
  const fallbacks: string[] = [];
  for (const exercise of exercises) {
    const profile = getResolvedExerciseProfile(exercise.exerciseId);
    const name = profile?.exerciseName ?? exercise.exerciseId;
    if (exercise.targetRpe == null) {
      fallbacks.push(`${name}: target RPE unavailable - neutral 0.75 used.`);
    }
    if (exercise.targetReps == null) {
      fallbacks.push(`${name}: target reps unavailable - neutral rep factor 1.00 used.`);
    }
  }
  return fallbacks;
}

export function resolveRecoveryScope(
  scope: RecoveryScope,
  templates: readonly WorkoutTemplate[] = [],
): ResolvedRecoveryScope {
  if (scope.type === 'all') {
    return {
      id: 'all',
      label: 'All',
      type: 'all',
      exercises: [],
      exerciseSelectionPreview: false,
      issueCodes: [],
      fallbacks: [],
    };
  }

  let id: string;
  let label: string;
  let exercises: PlannedExercise[];
  let sourceTemplateId: string | undefined;
  let exerciseSelectionPreview = false;
  const issueCodes: string[] = [];

  if (scope.type === 'preset') {
    sourceTemplateId = CANONICAL_TEMPLATE_ID_BY_PRESET[scope.preset];
    const template = templates.find(
      (candidate) => candidate.id === sourceTemplateId,
    );
    id = sourceTemplateId;
    label = template?.name ?? 'Unavailable template';
    exercises = template ? templateToExercises(template) : [];
    if (!template) {
      issueCodes.push('template_not_found');
    }
  } else if (scope.type === 'template') {
    sourceTemplateId = scope.templateId;
    const template = templates.find(
      (candidate) => candidate.id === scope.templateId,
    );
    id = scope.templateId;
    label = template?.name ?? 'Unavailable template';
    exercises = template ? templateToExercises(template) : [];
    if (!template) {
      issueCodes.push('template_not_found');
    }
  } else if (scope.type === 'exercise_selection') {
    id = `exercise-selection:${scope.exerciseIds.join(',')}`;
    label = scope.label?.trim() || 'Exercise selection preview';
    exercises = scope.exerciseIds.map((exerciseId) => ({
      exerciseId,
      targetSets: 3,
      targetReps: 10,
      targetRpe: null,
    }));
    exerciseSelectionPreview = true;
  } else {
    id = scope.id;
    label = scope.label;
    exercises = scope.exercises.map((exercise) => ({ ...exercise }));
  }

  return {
    id,
    label,
    type: scope.type,
    exercises: Object.freeze(exercises),
    exerciseSelectionPreview,
    sourceTemplateId,
    issueCodes: Object.freeze(issueCodes),
    fallbacks: Object.freeze(targetFallbacks(exercises)),
  };
}

export function evaluateRecoveryScope(
  resolvedScope: ResolvedRecoveryScope,
  state: RecoveryState,
): RecoveryScopeEvaluation {
  if (
    state.activationRegistryVersion !== ACTIVATION_REGISTRY_VERSION ||
    state.recoveryModelVersion !== RECOVERY_MODEL_VERSION
  ) {
    throw new Error('Recovery state versions do not match the active evaluator.');
  }

  const rawRelevance: Partial<Record<MuscleRecoveryUnitId, number>> = {};
  const primaryUnitIds = new Set<MuscleRecoveryUnitId>();
  const unsupportedExerciseIds = new Set<string>();
  const scopeIssueCodes = new Set(resolvedScope.issueCodes);
  const scopeFallbacks = new Set(resolvedScope.fallbacks);
  let totalPlannedBaseDose = 0;
  let mappedPlannedBaseDose = 0;

  if (resolvedScope.type === 'all') {
    for (const unit of RECOVERY_UNITS) {
      rawRelevance[unit.id] = 1;
      primaryUnitIds.add(unit.id);
    }
    totalPlannedBaseDose = RECOVERY_UNITS.length;
    mappedPlannedBaseDose = RECOVERY_UNITS.length;
  } else {
    for (const exercise of resolvedScope.exercises) {
      if (
        !Number.isInteger(exercise.targetSets) ||
        exercise.targetSets < 1 ||
        exercise.targetSets > 10
      ) {
        scopeIssueCodes.add(`invalid_target_sets:${exercise.exerciseId}`);
        continue;
      }
      if (
        !Number.isInteger(exercise.targetReps) ||
        (exercise.targetReps ?? 0) < 1 ||
        (exercise.targetReps ?? 0) > 50
      ) {
        scopeIssueCodes.add(`invalid_target_reps:${exercise.exerciseId}`);
        continue;
      }
      const setDose = calculatePlannedSetDose(
        exercise.targetReps,
        exercise.targetRpe,
      );
      for (const issueCode of setDose.issueCodes) {
        scopeIssueCodes.add(`${issueCode}:${exercise.exerciseId}`);
      }
      const plannedBaseDose = exercise.targetSets * setDose.dose;
      totalPlannedBaseDose += plannedBaseDose;
      const profile = getResolvedExerciseProfile(exercise.exerciseId);
      if (profile?.classification !== 'quantitative') {
        unsupportedExerciseIds.add(exercise.exerciseId);
        continue;
      }
      mappedPlannedBaseDose += plannedBaseDose;
      for (const [rawUnitId, coefficient] of Object.entries(
        profile.unitCoefficients,
      )) {
        const unitId = rawUnitId as MuscleRecoveryUnitId;
        rawRelevance[unitId] =
          (rawRelevance[unitId] ?? 0) + plannedBaseDose * coefficient;
      }
      for (const unitId of profile.primaryUnitIds) {
        if ((profile.unitCoefficients[unitId] ?? 0) > 0) {
          primaryUnitIds.add(unitId);
        }
      }
    }
  }

  const relevanceEntries = Object.entries(rawRelevance) as [
    MuscleRecoveryUnitId,
    number,
  ][];
  const mappedRelevanceTotal = relevanceEntries.reduce(
    (sum, [, value]) => sum + value,
    0,
  );
  const availableRelevanceTotal = relevanceEntries.reduce(
    (sum, [unitId, value]) =>
      state.units[unitId]?.available ? sum + value : sum,
    0,
  );
  const mappingCoverage =
    totalPlannedBaseDose > 0
      ? mappedPlannedBaseDose / totalPlannedBaseDose
      : 0;
  const signalCoverage =
    mappedRelevanceTotal > 0
      ? availableRelevanceTotal / mappedRelevanceTotal
      : null;
  const missingSignalUnitIds = relevanceEntries
    .map(([unitId]) => unitId)
    .filter(
    (unitId) => !state.units[unitId]?.available,
  );
  const targets: ScopeTargetEvaluation[] = [];

  if (availableRelevanceTotal > 0) {
    for (const [unitId, rawValue] of relevanceEntries) {
      const signal = state.units[unitId];
      if (!signal?.available || signal.burden == null || signal.readiness == null) {
        continue;
      }
      const relevance = rawValue / availableRelevanceTotal;
      const isPrimary = primaryUnitIds.has(unitId);
      targets.push({
        unitId,
        relevance,
        isPrimary,
        isCritical: relevance >= 0.1 || isPrimary,
        burden: signal.burden,
        readiness: signal.readiness,
      });
    }
  }
  targets.sort(
    (left, right) =>
      right.relevance - left.relevance || left.unitId.localeCompare(right.unitId),
  );

  const coverage = createCoverageSummary({
    history: state.historyCoverage,
    mappingCoverage,
    signalCoverage,
    unsupportedExerciseIds: [...unsupportedExerciseIds],
    missingSignalUnitIds,
    scopeFallbacks: [...scopeFallbacks],
    scopeIssueCodes: [...scopeIssueCodes],
    hasSupportedTargets: mappedRelevanceTotal > 0,
  });
  if (coverage.status === 'unavailable' || targets.length === 0) {
    return {
      scope: resolvedScope,
      asOf: state.asOf,
      activationRegistryVersion: state.activationRegistryVersion,
      recoveryModelVersion: state.recoveryModelVersion,
      status: 'unavailable',
      burden: null,
      readiness: null,
      weightedTargetBurden: null,
      maximumCriticalBurden: null,
      limitingUnitId: null,
      targets: Object.freeze(targets),
      criticalUnitIds: [],
      coverage: { ...coverage, status: 'unavailable' },
    };
  }

  const weightedTargetBurden = targets.reduce(
    (sum, target) => sum + target.relevance * target.burden,
    0,
  );
  const criticalTargets = targets.filter((target) => target.isCritical);
  const limitingPool = criticalTargets.length ? criticalTargets : targets;
  const maximumCriticalBurden = limitingPool.reduce(
    (maximum, target) => Math.max(maximum, target.burden),
    0,
  );
  const limitingUnitId =
    maximumCriticalBurden > 0
      ? [...limitingPool].sort(
          (left, right) =>
            right.burden - left.burden ||
            left.unitId.localeCompare(right.unitId),
        )[0].unitId
      : null;
  const burden = Math.max(
    0,
    Math.min(
      100,
      0.75 * weightedTargetBurden + 0.25 * maximumCriticalBurden,
    ),
  );
  return {
    scope: resolvedScope,
    asOf: state.asOf,
    activationRegistryVersion: state.activationRegistryVersion,
    recoveryModelVersion: state.recoveryModelVersion,
    status: coverage.status,
    burden,
    readiness: 100 - burden,
    weightedTargetBurden,
    maximumCriticalBurden,
    limitingUnitId,
    targets: Object.freeze(targets),
    criticalUnitIds: Object.freeze(criticalTargets.map((target) => target.unitId)),
    coverage,
  };
}
