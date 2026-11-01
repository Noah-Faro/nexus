import { RECOVERY_GROUPS, RECOVERY_UNIT_BY_ID } from './definitions';
import type {
  EstimateAvailability,
  GroupRecoverySignal,
  RecoveryGroupId,
  UnitRecoverySignal,
} from './types';

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function aggregateRecoveryGroup(
  groupId: RecoveryGroupId,
  unitSignals: Readonly<Record<string, UnitRecoverySignal>>,
  asOf: number,
): GroupRecoverySignal {
  const definition = RECOVERY_GROUPS.find((candidate) => candidate.id === groupId);
  if (!definition) {
    throw new Error(`Unknown recovery group: ${groupId}`);
  }
  const childSignals = definition.unitIds
    .map((unitId) => unitSignals[unitId])
    .filter((signal): signal is UnitRecoverySignal => Boolean(signal));
  const availableSignals = childSignals.filter(
    (signal) => signal.available && signal.burden != null,
  );
  const availableWeight = availableSignals.reduce(
    (sum, signal) => sum + RECOVERY_UNIT_BY_ID[signal.unitId].aggregationWeight,
    0,
  );
  const totalWeight = definition.unitIds.reduce(
    (sum, unitId) => sum + RECOVERY_UNIT_BY_ID[unitId].aggregationWeight,
    0,
  );
  const signalCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  const missingUnitIds = definition.unitIds.filter(
    (unitId) => !unitSignals[unitId]?.available,
  );

  if (availableSignals.length === 0 || availableWeight <= 0) {
    return {
      groupId,
      asOf,
      available: false,
      burden: null,
      readiness: null,
      weightedMean: null,
      maximum: null,
      signalCoverage,
      childSignals,
      missingUnitIds,
      status: 'unavailable',
    };
  }

  const weightedMean =
    availableSignals.reduce(
      (sum, signal) =>
        sum +
        (signal.burden ?? 0) *
          RECOVERY_UNIT_BY_ID[signal.unitId].aggregationWeight,
      0,
    ) / availableWeight;
  const maximum = Math.max(
    ...availableSignals.map((signal) => signal.burden ?? 0),
  );
  const burden = clamp(0.75 * weightedMean + 0.25 * maximum);
  const status: EstimateAvailability =
    signalCoverage >= 0.7 ? 'available' : 'limited';
  return {
    groupId,
    asOf,
    available: true,
    burden,
    readiness: 100 - burden,
    weightedMean,
    maximum,
    signalCoverage,
    childSignals,
    missingUnitIds,
    status,
  };
}

export function aggregateAllRecoveryGroups(
  unitSignals: Readonly<Record<string, UnitRecoverySignal>>,
  asOf: number,
): Readonly<Record<string, GroupRecoverySignal>> {
  return Object.freeze(
    Object.fromEntries(
      RECOVERY_GROUPS.map((definition) => [
        definition.id,
        aggregateRecoveryGroup(definition.id, unitSignals, asOf),
      ]),
    ),
  );
}
