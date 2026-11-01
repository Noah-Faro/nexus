import { calculateRecoveryState } from './recoveryModel';
import {
  RECOVERY_GROUP_BY_ID,
  RECOVERY_GROUPS,
  RECOVERY_UNIT_BY_ID,
} from './definitions';
import {
  evaluateRecoveryScope,
  resolveRecoveryScope,
} from './scopeAggregation';
import type {
  RecoveryDashboardInput,
  RecoveryGroupId,
  RecoveryPresentationGroupId,
  RecoveryScopeEvaluation,
  RecoveryState,
  ScopeRecoveryGroupSummary,
  ScopeRecoveryPresentationGroupSummary,
} from './types';

const PRESENTATION_GROUP_SOURCES = Object.freeze(
  RECOVERY_GROUPS
    .filter((group) => group.id !== 'rotator_cuff')
    .map((group) => ({
      presentationGroupId: group.id as RecoveryPresentationGroupId,
      sourceGroupIds: Object.freeze(
        group.id === 'upper_back'
          ? ['upper_back', 'rotator_cuff'] as const
          : [group.id] as const,
      ),
    })),
);

export interface RecoveryDashboardResult {
  state: RecoveryState;
  scopeEvaluation: RecoveryScopeEvaluation;
}

export function normalizeAsOf(asOf: number | Date | undefined): number {
  const value =
    asOf instanceof Date ? asOf.getTime() : asOf ?? Date.now();
  if (!Number.isFinite(value)) {
    throw new Error('Recovery dashboard requires a valid asOf time.');
  }
  return value;
}

export function selectRecoveryDashboard(
  input: RecoveryDashboardInput,
): RecoveryDashboardResult {
  const asOf = normalizeAsOf(input.asOf);
  const state = calculateRecoveryState(input.sessions, asOf, input.options);
  const resolvedScope = resolveRecoveryScope(input.scope, input.templates);
  return {
    state,
    scopeEvaluation: evaluateRecoveryScope(resolvedScope, state),
  };
}

export function selectHighestBurdenCriticalUnit(
  evaluation: RecoveryScopeEvaluation,
): string | null {
  if (evaluation.status === 'unavailable') {
    return null;
  }
  const critical = evaluation.targets.filter((target) => target.isCritical);
  const pool = critical.length ? critical : evaluation.targets;
  return (
    [...pool].sort(
      (left, right) =>
        right.burden - left.burden ||
        left.unitId.localeCompare(right.unitId),
    )[0]?.unitId ?? null
  );
}

export function selectTopBurdenTargets(
  evaluation: RecoveryScopeEvaluation,
  limit = 3,
): readonly RecoveryScopeEvaluation['targets'][number][] {
  const boundedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 0;
  return Object.freeze(
    [...evaluation.targets]
      .sort(
        (left, right) =>
          right.burden - left.burden ||
          right.relevance - left.relevance ||
          left.unitId.localeCompare(right.unitId),
      )
      .slice(0, boundedLimit),
  );
}

export function selectScopeRecoveryGroupSummaries(
  evaluation: RecoveryScopeEvaluation,
  state: RecoveryState,
): readonly ScopeRecoveryGroupSummary[] {
  const relevanceByGroup = new Map<RecoveryGroupId, number>();
  for (const target of evaluation.targets) {
    const groupId = RECOVERY_UNIT_BY_ID[target.unitId]?.groupId;
    if (!groupId) {
      continue;
    }
    relevanceByGroup.set(
      groupId,
      (relevanceByGroup.get(groupId) ?? 0) + target.relevance,
    );
  }

  const groupOrder = new Map(
    RECOVERY_GROUPS.map((group, index) => [group.id, index]),
  );
  const includeAllGroups = evaluation.scope.type === 'all';
  const summaries = RECOVERY_GROUPS.flatMap((definition) => {
    const scopeRelevance = relevanceByGroup.get(definition.id) ?? 0;
    if (!includeAllGroups && scopeRelevance <= 0) {
      return [];
    }

    const signal = state.groups[definition.id];
    if (!signal) {
      return [];
    }
    const childSignals = signal.childSignals;
    const mostBurdenedUnitId = childSignals.reduce<
      ScopeRecoveryGroupSummary['mostBurdenedUnitId']
    >((selectedUnitId, child) => {
      if (!child.available || child.burden == null) {
        return selectedUnitId;
      }
      if (selectedUnitId == null) {
        return child.unitId;
      }
      const selectedBurden = state.units[selectedUnitId]?.burden;
      return selectedBurden == null || child.burden > selectedBurden
        ? child.unitId
        : selectedUnitId;
    }, null);
    const lastMaterialLoadAt = childSignals.reduce<number | null>(
      (latest, child) =>
        child.lastMaterialLoadAt != null &&
        (latest == null || child.lastMaterialLoadAt > latest)
          ? child.lastMaterialLoadAt
          : latest,
      null,
    );

    return [{
      groupId: definition.id,
      scopeRelevance,
      burden: signal.burden,
      readiness: signal.readiness,
      status: signal.status,
      childUnitIds: Object.freeze(childSignals.map((child) => child.unitId)),
      mostBurdenedUnitId,
      lastMaterialLoadAt,
      containsLimitingUnit:
        evaluation.limitingUnitId != null &&
        childSignals.some(
          (child) => child.unitId === evaluation.limitingUnitId,
        ),
    } satisfies ScopeRecoveryGroupSummary];
  });

  summaries.sort((left, right) => {
    if (left.burden == null || right.burden == null) {
      if (left.burden == null && right.burden != null) return 1;
      if (left.burden != null && right.burden == null) return -1;
    } else if (right.burden !== left.burden) {
      return right.burden - left.burden;
    }
    return (
      (groupOrder.get(left.groupId) ?? Number.MAX_SAFE_INTEGER) -
      (groupOrder.get(right.groupId) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  return Object.freeze(summaries);
}

export function selectScopeRecoveryPresentationGroupSummaries(
  evaluation: RecoveryScopeEvaluation,
  state: RecoveryState,
): readonly ScopeRecoveryPresentationGroupSummary[] {
  const relevanceByGroup = new Map<RecoveryGroupId, number>();
  for (const target of evaluation.targets) {
    const groupId = RECOVERY_UNIT_BY_ID[target.unitId]?.groupId;
    if (groupId) {
      relevanceByGroup.set(
        groupId,
        (relevanceByGroup.get(groupId) ?? 0) + target.relevance,
      );
    }
  }

  const presentationOrder = new Map(
    PRESENTATION_GROUP_SOURCES.map((definition, index) => [
      definition.presentationGroupId,
      index,
    ]),
  );
  const includeAllGroups = evaluation.scope.type === 'all';
  const summaries = PRESENTATION_GROUP_SOURCES.flatMap((definition) => {
    const scopeRelevance = definition.sourceGroupIds.reduce(
      (total, groupId) => total + (relevanceByGroup.get(groupId) ?? 0),
      0,
    );
    if (!includeAllGroups && scopeRelevance <= 0) {
      return [];
    }

    const childUnitIds = definition.sourceGroupIds.flatMap(
      (groupId) => RECOVERY_GROUP_BY_ID[groupId]?.unitIds ?? [],
    );
    const childSignals = childUnitIds
      .map((unitId) => state.units[unitId])
      .filter((signal) => Boolean(signal));
    const availableSignals = childSignals.filter(
      (signal) => signal.available && signal.burden != null,
    );
    const totalWeight = childUnitIds.reduce(
      (total, unitId) =>
        total + RECOVERY_UNIT_BY_ID[unitId].aggregationWeight,
      0,
    );
    const availableWeight = availableSignals.reduce(
      (total, signal) =>
        total + RECOVERY_UNIT_BY_ID[signal.unitId].aggregationWeight,
      0,
    );
    const signalCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
    const weightedMean = availableWeight > 0
      ? availableSignals.reduce(
          (total, signal) =>
            total +
            (signal.burden ?? 0) *
              RECOVERY_UNIT_BY_ID[signal.unitId].aggregationWeight,
          0,
        ) / availableWeight
      : null;
    const maximum = availableSignals.length
      ? Math.max(...availableSignals.map((signal) => signal.burden ?? 0))
      : null;
    const burden = weightedMean == null || maximum == null
      ? null
      : Math.max(0, Math.min(100, 0.75 * weightedMean + 0.25 * maximum));
    const status = burden == null
      ? 'unavailable' as const
      : signalCoverage >= 0.7
        ? 'available' as const
        : 'limited' as const;
    const mostBurdenedUnitId = availableSignals.reduce<
      ScopeRecoveryPresentationGroupSummary['mostBurdenedUnitId']
    >((selectedUnitId, child) => {
      if (selectedUnitId == null) {
        return child.unitId;
      }
      const selectedBurden = state.units[selectedUnitId]?.burden;
      return selectedBurden == null || (child.burden ?? 0) > selectedBurden
        ? child.unitId
        : selectedUnitId;
    }, null);
    const lastMaterialLoadAt = childSignals.reduce<number | null>(
      (latest, child) =>
        child.lastMaterialLoadAt != null &&
        (latest == null || child.lastMaterialLoadAt > latest)
          ? child.lastMaterialLoadAt
          : latest,
      null,
    );

    return [{
      presentationGroupId: definition.presentationGroupId,
      sourceGroupIds: definition.sourceGroupIds,
      scopeRelevance,
      burden,
      readiness: burden == null ? null : 100 - burden,
      status,
      childUnitIds: Object.freeze(childUnitIds),
      mostBurdenedUnitId,
      lastMaterialLoadAt,
      containsLimitingUnit:
        evaluation.limitingUnitId != null &&
        childSignals.some(
          (child) => child.unitId === evaluation.limitingUnitId,
        ),
    } satisfies ScopeRecoveryPresentationGroupSummary];
  });

  summaries.sort((left, right) => {
    if (left.burden == null || right.burden == null) {
      if (left.burden == null && right.burden != null) return 1;
      if (left.burden != null && right.burden == null) return -1;
    } else if (right.burden !== left.burden) {
      return right.burden - left.burden;
    }
    return (
      (presentationOrder.get(left.presentationGroupId) ?? Number.MAX_SAFE_INTEGER) -
      (presentationOrder.get(right.presentationGroupId) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  return Object.freeze(summaries);
}
