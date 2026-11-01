import type { WorkoutSession } from '../trainingTypes';
import { getResolvedExerciseProfile } from './activationRegistry';
import { repFactor, isValidRecordedRpe } from './setDose';
import type {
  EstimateAvailability,
  HistoryCompleteness,
  MuscleRecoveryUnitId,
  RecoveryCoverageSummary,
  RecoveryHistoryCoverage,
} from './types';

export const FUTURE_SESSION_TOLERANCE_MS = 5 * 60 * 1000;

export type CompletedSessionEndResolution =
  | { status: 'active' | 'invalid' | 'future_excluded'; endTime: null }
  | { status: 'valid' | 'future_clamped'; endTime: number };

export function resolveCompletedSessionEnd(
  endTime: number | undefined,
  asOf: number,
): CompletedSessionEndResolution {
  if (endTime == null) {
    return { status: 'active', endTime: null };
  }
  if (!Number.isFinite(endTime)) {
    return { status: 'invalid', endTime: null };
  }
  const futureOffset = endTime - asOf;
  if (futureOffset > FUTURE_SESSION_TOLERANCE_MS) {
    return { status: 'future_excluded', endTime: null };
  }
  if (futureOffset > 0) {
    return { status: 'future_clamped', endTime: asOf };
  }
  return { status: 'valid', endTime };
}

export function evaluateRecoveryHistoryCoverage(
  sessions: readonly WorkoutSession[],
  asOf: number,
  historyCompleteness: HistoryCompleteness = 'complete',
): RecoveryHistoryCoverage {
  if (historyCompleteness === 'unknown') {
    return {
      historyCompleteness: 'unknown',
      historyReason: 'history_incomplete',
      effortCoverage: null,
      mappedHistoryCoverage: null,
      eligibleWorkingSetDose: 0,
      mappedWorkingSetDose: 0,
      observedEffortDose: 0,
      contributingSessionCount: 0,
      excludedWarmupCount: 0,
      excludedActiveSessionCount: sessions.filter(
        (session) => !Number.isFinite(session.endTime),
      ).length,
      invalidSetCount: 0,
      invalidSessionCount: 0,
      invalidEffortCount: 0,
      unsupportedExerciseIds: [],
      issueCodes: ['history_incomplete'],
      fallbacks: ['Recent workout history is incomplete.'],
    };
  }

  let eligibleWorkingSetDose = 0;
  let mappedWorkingSetDose = 0;
  let observedEffortDose = 0;
  let excludedWarmupCount = 0;
  let excludedActiveSessionCount = 0;
  let invalidSetCount = 0;
  let invalidSessionCount = 0;
  let invalidEffortCount = 0;
  let contributingSessionCount = 0;
  const unsupportedExerciseIds = new Set<string>();
  const issueCodes = new Set<string>();

  for (const session of sessions) {
    const endResolution = resolveCompletedSessionEnd(session.endTime, asOf);
    if (endResolution.status === 'active') {
      excludedActiveSessionCount += 1;
      continue;
    }
    if (
      endResolution.status === 'invalid' ||
      endResolution.status === 'future_excluded'
    ) {
      invalidSessionCount += 1;
      issueCodes.add(
        endResolution.status === 'future_excluded'
          ? 'future_session_excluded'
          : 'invalid_session_end',
      );
      continue;
    }
    if (endResolution.status === 'future_clamped') {
      issueCodes.add('future_session_end_clamped');
    }
    let sessionContributed = false;
    for (const set of session.sets) {
      if (set.isWarmup === true) {
        excludedWarmupCount += 1;
        continue;
      }
      const baseDose = repFactor(set.reps);
      if (baseDose == null) {
        invalidSetCount += 1;
        issueCodes.add('invalid_reps');
        continue;
      }
      eligibleWorkingSetDose += baseDose;
      const profile = getResolvedExerciseProfile(set.exerciseId);
      if (profile?.classification === 'quantitative') {
        mappedWorkingSetDose += baseDose;
        sessionContributed = true;
        if (isValidRecordedRpe(set.rpe)) {
          observedEffortDose += baseDose;
        } else {
          invalidEffortCount += 1;
          issueCodes.add('missing_or_invalid_rpe');
        }
      } else {
        unsupportedExerciseIds.add(set.exerciseId);
        issueCodes.add('unsupported_exercise_history');
      }
    }
    if (sessionContributed) {
      contributingSessionCount += 1;
    }
  }

  const effortCoverage =
    mappedWorkingSetDose > 0
      ? observedEffortDose / mappedWorkingSetDose
      : null;
  const mappedHistoryCoverage =
    eligibleWorkingSetDose > 0
      ? mappedWorkingSetDose / eligibleWorkingSetDose
      : null;
  let historyReason: RecoveryHistoryCoverage['historyReason'] = 'complete';
  if (eligibleWorkingSetDose === 0) {
    historyReason =
      invalidSessionCount > 0 || invalidSetCount > 0
        ? 'invalid_only'
        : 'complete_no_load';
  } else if (mappedWorkingSetDose === 0) {
    historyReason = 'unsupported_only';
  } else if (mappedWorkingSetDose < eligibleWorkingSetDose) {
    historyReason = 'mixed';
  } else if (invalidEffortCount > 0) {
    historyReason = 'missing_rpe';
  }
  const fallbacks =
    invalidEffortCount > 0
      ? [
          `${invalidEffortCount} working ${
            invalidEffortCount === 1 ? 'set uses' : 'sets use'
          } the neutral 0.75 missing/invalid-RPE fallback.`,
        ]
      : [];

  return {
    historyCompleteness: 'complete',
    historyReason,
    effortCoverage,
    mappedHistoryCoverage,
    eligibleWorkingSetDose,
    mappedWorkingSetDose,
    observedEffortDose,
    contributingSessionCount,
    excludedWarmupCount,
    excludedActiveSessionCount,
    invalidSetCount,
    invalidSessionCount,
    invalidEffortCount,
    unsupportedExerciseIds: Object.freeze([...unsupportedExerciseIds].sort()),
    issueCodes: Object.freeze([...issueCodes].sort()),
    fallbacks: Object.freeze(fallbacks),
  };
}

export function deriveEstimateStatus(input: {
  historyCompleteness: HistoryCompleteness;
  hasSupportedTargets: boolean;
  mappingCoverage: number | null;
  signalCoverage: number | null;
  effortCoverage: number | null;
  effortNotApplicable: boolean;
  historyReason: RecoveryHistoryCoverage['historyReason'];
  invalidSessionCount: number;
  invalidSetCount: number;
  mappedWorkingSetDose: number;
}): EstimateAvailability {
  if (
    input.historyCompleteness === 'unknown' ||
    !input.hasSupportedTargets ||
    input.signalCoverage == null ||
    input.signalCoverage <= 0 ||
    input.historyReason === 'invalid_only'
  ) {
    return 'unavailable';
  }
  if (
    (input.invalidSessionCount > 0 || input.invalidSetCount > 0) &&
    input.mappedWorkingSetDose <= 0
  ) {
    return 'unavailable';
  }
  const effortPass =
    input.effortNotApplicable ||
    (input.effortCoverage != null && input.effortCoverage >= 0.7);
  const thresholdPass = (input.mappingCoverage ?? 0) >= 0.9 &&
    input.signalCoverage >= 1 - 1e-10 &&
    effortPass;
  const invalidData =
    input.invalidSessionCount > 0 || input.invalidSetCount > 0;
  return thresholdPass && !invalidData ? 'available' : 'limited';
}

export function createCoverageSummary(input: {
  history: RecoveryHistoryCoverage;
  mappingCoverage: number | null;
  signalCoverage: number | null;
  unsupportedExerciseIds: readonly string[];
  missingSignalUnitIds: readonly MuscleRecoveryUnitId[];
  scopeFallbacks: readonly string[];
  scopeIssueCodes: readonly string[];
  hasSupportedTargets: boolean;
}): RecoveryCoverageSummary {
  const effortNotApplicable = input.history.mappedWorkingSetDose === 0;
  let status = deriveEstimateStatus({
    historyCompleteness: input.history.historyCompleteness,
    hasSupportedTargets: input.hasSupportedTargets,
    mappingCoverage: input.mappingCoverage,
    signalCoverage: input.signalCoverage,
    effortCoverage: input.history.effortCoverage,
    effortNotApplicable,
    historyReason: input.history.historyReason,
    invalidSessionCount: input.history.invalidSessionCount,
    invalidSetCount: input.history.invalidSetCount,
    mappedWorkingSetDose: input.history.mappedWorkingSetDose,
  });
  if (
    status === 'available' &&
    input.scopeIssueCodes.some(
      (issueCode) =>
        issueCode.startsWith('invalid_target_sets:') ||
        issueCode.startsWith('invalid_target_reps:'),
    )
  ) {
    status = 'limited';
  }
  return {
    status,
    historyCompleteness: input.history.historyCompleteness,
    historyReason: input.history.historyReason,
    mappingCoverage: input.mappingCoverage,
    historicalMappingCoverage: input.history.mappedHistoryCoverage,
    signalCoverage: input.signalCoverage,
    effortCoverage: input.history.effortCoverage,
    parameterSource: 'default',
    unsupportedExerciseIds: Object.freeze(
      [
        ...new Set([
          ...input.history.unsupportedExerciseIds,
          ...input.unsupportedExerciseIds,
        ]),
      ].sort(),
    ),
    missingSignalUnitIds: Object.freeze(
      [...new Set([...input.missingSignalUnitIds])].sort(),
    ),
    excludedWarmupCount: input.history.excludedWarmupCount,
    excludedActiveSessionCount: input.history.excludedActiveSessionCount,
    invalidSetCount: input.history.invalidSetCount,
    invalidSessionCount: input.history.invalidSessionCount,
    invalidEffortCount: input.history.invalidEffortCount,
    contributingSessionCount: input.history.contributingSessionCount,
    issueCodes: Object.freeze(
      [
        ...new Set([
          ...input.history.issueCodes,
          ...input.scopeIssueCodes,
          ...(input.missingSignalUnitIds.length ? ['missing_unit_signal'] : []),
        ]),
      ].sort(),
    ),
    fallbacks: Object.freeze(
      [...new Set([...input.history.fallbacks, ...input.scopeFallbacks])],
    ),
  };
}
