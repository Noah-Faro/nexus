import type { WorkoutSession } from '../trainingTypes';
import {
  ACTIVATION_REGISTRY_VERSION,
  getResolvedExerciseProfile,
} from './activationRegistry';
import {
  evaluateRecoveryHistoryCoverage,
  resolveCompletedSessionEnd,
} from './coverage';
import {
  getUnitScale,
  RECOVERY_UNITS,
} from './definitions';
import { aggregateAllRecoveryGroups } from './groupAggregation';
import { calculateSetDose } from './setDose';
import type {
  HistoryCompleteness,
  RecoveryState,
  UnitContributor,
  UnitProjectionPoint,
  UnitRecoverySignal,
} from './types';

export const RECOVERY_MODEL_VERSION = 'phase11-recovery-v1';
export const DEFAULT_HALF_LIFE_HOURS = 24;
export const LATENT_EPSILON = 1e-12;

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function decayFactor(
  elapsedHours: number,
  halfLifeHours = DEFAULT_HALF_LIFE_HOURS,
): number {
  if (!Number.isFinite(elapsedHours) || !Number.isFinite(halfLifeHours) || halfLifeHours <= 0) {
    return 0;
  }
  return 2 ** (-Math.max(0, elapsedHours) / halfLifeHours);
}

export function burdenFromLatent(latentBurden: number, scale: number): number {
  if (!Number.isFinite(latentBurden) || latentBurden <= LATENT_EPSILON) {
    return 0;
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('Recovery burden scale must be positive and finite.');
  }
  return clamp(100 * (1 - Math.exp(-latentBurden / scale)));
}

type MutableContributor = Omit<UnitContributor, 'latentShare'>;

function contributorKey(sessionId: string, exerciseId: string): string {
  return `${sessionId}\u0000${exerciseId}`;
}

function stableContributorSort(
  left: MutableContributor,
  right: MutableContributor,
): number {
  return (
    right.currentDose - left.currentDose ||
    left.sessionId.localeCompare(right.sessionId) ||
    left.exerciseId.localeCompare(right.exerciseId)
  );
}

export function calculateRecoveryState(
  sessions: readonly WorkoutSession[],
  asOf: number,
  options: {
    historyCompleteness?: HistoryCompleteness;
    halfLifeHours?: number;
  } = {},
): RecoveryState {
  if (!Number.isFinite(asOf)) {
    throw new Error('Recovery calculation requires a finite asOf timestamp.');
  }
  const halfLifeHours =
    options.halfLifeHours == null ? DEFAULT_HALF_LIFE_HOURS : options.halfLifeHours;
  if (!Number.isFinite(halfLifeHours) || halfLifeHours <= 0) {
    throw new Error('Recovery half-life must be positive and finite.');
  }
  const historyCoverage = evaluateRecoveryHistoryCoverage(
    sessions,
    asOf,
    options.historyCompleteness ?? 'complete',
  );
  const historyAvailable = historyCoverage.historyCompleteness === 'complete';
  const unitSignals: Record<string, UnitRecoverySignal> = {};

  for (const unit of RECOVERY_UNITS) {
    const scale = getUnitScale(unit.id);
    if (!historyAvailable) {
      unitSignals[unit.id] = {
        unitId: unit.id,
        asOf,
        available: false,
        latentBurden: null,
        burden: null,
        readiness: null,
        scale,
        halfLifeHours,
        contributors: [],
        projection: [],
        lastMaterialLoadAt: null,
        issueCodes: ['history_incomplete'],
      };
      continue;
    }

    const contributorMap = new Map<string, MutableContributor>();
    let lastMaterialLoadAt: number | null = null;
    const issueCodes = new Set<string>();
    for (const session of sessions) {
      const endResolution = resolveCompletedSessionEnd(session.endTime, asOf);
      if (
        endResolution.status === 'active' ||
        endResolution.status === 'invalid' ||
        endResolution.status === 'future_excluded'
      ) {
        continue;
      }
      const sessionEndTime = endResolution.endTime;
      if (sessionEndTime == null) {
        continue;
      }
      const ageHours = Math.max(0, (asOf - sessionEndTime) / 3_600_000);
      const decay = decayFactor(ageHours, halfLifeHours);
      for (const set of session.sets) {
        if (set.isWarmup === true) {
          continue;
        }
        const profile = getResolvedExerciseProfile(set.exerciseId);
        const coefficient = profile?.unitCoefficients[unit.id] ?? 0;
        if (profile?.classification !== 'quantitative' || coefficient <= 0) {
          continue;
        }
        const setDose = calculateSetDose(set.reps, set.rpe);
        if (!setDose) {
          issueCodes.add('invalid_reps');
          continue;
        }
        for (const issueCode of setDose.issueCodes) {
          issueCodes.add(issueCode);
        }
        const originalDose = setDose.dose * coefficient;
        if (originalDose <= LATENT_EPSILON) {
          continue;
        }
        const key = contributorKey(session.id, set.exerciseId);
        const existing = contributorMap.get(key);
        const exerciseName =
          set.exerciseName || profile.exerciseName || set.exerciseId;
        if (existing) {
          existing.originalDose += originalDose;
          existing.currentDose += originalDose * decay;
        } else {
          contributorMap.set(key, {
            sessionId: session.id,
            sessionName: session.templateName || session.id,
            exerciseId: set.exerciseId,
            exerciseName,
            sessionEndTime,
            ageHours,
            originalDose,
            currentDose: originalDose * decay,
          });
        }
        lastMaterialLoadAt =
          lastMaterialLoadAt == null
            ? sessionEndTime
            : Math.max(lastMaterialLoadAt, sessionEndTime);
      }
    }

    const orderedContributors = [...contributorMap.values()].sort(
      stableContributorSort,
    );
    const latentBurden = orderedContributors.reduce(
      (sum, contributor) => sum + contributor.currentDose,
      0,
    );
    const contributors: UnitContributor[] = orderedContributors.map(
      (contributor) => ({
        ...contributor,
        latentShare:
          latentBurden > LATENT_EPSILON
            ? contributor.currentDose / latentBurden
            : 0,
      }),
    );
    const burden = burdenFromLatent(latentBurden, scale);
    const projection = ([0, 6, 12, 24] as const).map(
      (offsetHours): UnitProjectionPoint => {
        const projectedLatent =
          latentBurden * decayFactor(offsetHours, halfLifeHours);
        return {
          offsetHours,
          latentBurden: projectedLatent,
          burden: burdenFromLatent(projectedLatent, scale),
        };
      },
    );
    unitSignals[unit.id] = {
      unitId: unit.id,
      asOf,
      available: true,
      latentBurden,
      burden,
      readiness: 100 - burden,
      scale,
      halfLifeHours,
      contributors: Object.freeze(contributors),
      projection: Object.freeze(projection),
      lastMaterialLoadAt,
      issueCodes: Object.freeze([...issueCodes].sort()),
    };
  }

  const frozenUnits = Object.freeze(unitSignals);
  return {
    asOf,
    activationRegistryVersion: ACTIVATION_REGISTRY_VERSION,
    recoveryModelVersion: RECOVERY_MODEL_VERSION,
    units: frozenUnits,
    groups: aggregateAllRecoveryGroups(frozenUnits, asOf),
    historyCoverage,
  };
}
