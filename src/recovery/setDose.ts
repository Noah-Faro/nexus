import type { SetDoseResult } from './types';

export const NEUTRAL_EFFORT_FACTOR = 0.75;

export function isValidRecordedRpe(rpe: unknown): rpe is number {
  return typeof rpe === 'number' && Number.isFinite(rpe) && rpe >= 5 && rpe <= 10;
}

export function effortFactor(rpe: unknown): number {
  if (!isValidRecordedRpe(rpe)) {
    return NEUTRAL_EFFORT_FACTOR;
  }
  if (rpe >= 10) return 1;
  if (rpe >= 9) return 0.9;
  if (rpe >= 8) return 0.75;
  if (rpe >= 7) return 0.6;
  if (rpe >= 6) return 0.45;
  return 0.35;
}

export function repFactor(reps: unknown): number | null {
  if (typeof reps !== 'number' || !Number.isFinite(reps) || reps <= 0) {
    return null;
  }
  if (reps <= 5) return 0.85;
  if (reps <= 12) return 1;
  if (reps <= 20) return 1.1;
  if (reps <= 30) return 1.2;
  return 1.25;
}

export function calculateSetDose(reps: unknown, rpe: unknown): SetDoseResult | null {
  const repetitions = repFactor(reps);
  if (repetitions == null) {
    return null;
  }
  const recorded = isValidRecordedRpe(rpe);
  return {
    dose: effortFactor(rpe) * repetitions,
    effortFactor: effortFactor(rpe),
    repFactor: repetitions,
    effortProvenance: recorded ? 'observed' : 'neutral_fallback',
    issueCodes: recorded ? [] : ['missing_or_invalid_rpe'],
  };
}

export function calculatePlannedSetDose(
  reps: unknown,
  rpe: unknown,
): SetDoseResult {
  const repetitions = reps == null ? 1 : repFactor(reps);
  const validRepetitions = repetitions ?? 1;
  const recorded = isValidRecordedRpe(rpe);
  const issueCodes: string[] = [];
  if (reps == null) {
    issueCodes.push('missing_target_reps');
  } else if (repetitions == null) {
    issueCodes.push('invalid_target_reps');
  }
  if (!recorded) {
    issueCodes.push('missing_target_rpe');
  }
  return {
    dose: effortFactor(rpe) * validRepetitions,
    effortFactor: effortFactor(rpe),
    repFactor: validRepetitions,
    effortProvenance: recorded ? 'observed' : 'neutral_fallback',
    issueCodes,
  };
}

