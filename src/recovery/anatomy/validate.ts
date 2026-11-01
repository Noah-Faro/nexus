import { backPaths } from './backPaths';
import {
  anatomyRegionDisplayByKey,
  anatomyRegionDisplayRegistry,
  listOnlyRecoveryUnitIds,
  mapSelectableRecoveryUnitIds,
  recoveryUnitDisplayRegistry,
  resolveDirectPathUnitId,
} from './displayRegistry';
import { frontPaths } from './frontPaths';
import type { AnatomyPathGroup, AnatomySide } from './types';

const pathCount = (groups: readonly AnatomyPathGroup[]): number =>
  groups.reduce(
    (total, group) =>
      total +
      Object.values(group.path).reduce(
        (groupTotal, paths) => groupTotal + (paths?.length ?? 0),
        0,
      ),
    0,
  );

const validatePathCoverage = (
  view: 'front' | 'back',
  groups: readonly AnatomyPathGroup[],
): void => {
  for (const group of groups) {
    const display = anatomyRegionDisplayByKey.get(`${view}:${group.slug}`);
    if (!display) {
      throw new Error(`Missing display metadata for ${view}:${group.slug}`);
    }

    if (display.treatment !== 'direct') {
      continue;
    }

    for (const [side, paths] of Object.entries(group.path)) {
      const pathSide = side as AnatomySide;
      paths?.forEach((_, index) => {
        if (!resolveDirectPathUnitId(view, group.slug, pathSide, index)) {
          throw new Error(
            `Missing direct unit mapping for ${view}:${group.slug}:${side}:${index}`,
          );
        }
      });
    }
  }
};

export interface AnatomyValidationSummary {
  readonly frontGroups: number;
  readonly frontPathCount: number;
  readonly backGroups: number;
  readonly backPathCount: number;
  readonly recoveryUnitCount: number;
  readonly mapSelectableUnitCount: number;
  readonly listOnlyUnitCount: number;
}

export const validateAnatomyRegistry = (): AnatomyValidationSummary => {
  const summary: AnatomyValidationSummary = {
    frontGroups: frontPaths.length,
    frontPathCount: pathCount(frontPaths),
    backGroups: backPaths.length,
    backPathCount: pathCount(backPaths),
    recoveryUnitCount: recoveryUnitDisplayRegistry.length,
    mapSelectableUnitCount: mapSelectableRecoveryUnitIds.length,
    listOnlyUnitCount: listOnlyRecoveryUnitIds.length,
  };

  const expected = {
    frontGroups: 19,
    frontPathCount: 89,
    backGroups: 16,
    backPathCount: 70,
    recoveryUnitCount: 51,
    mapSelectableUnitCount: 47,
    listOnlyUnitCount: 4,
  } satisfies AnatomyValidationSummary;

  for (const [key, value] of Object.entries(expected)) {
    const actual = summary[key as keyof AnatomyValidationSummary];
    if (actual !== value) {
      throw new Error(`Anatomy ${key} expected ${value}, received ${actual}`);
    }
  }

  if (anatomyRegionDisplayRegistry.length !== 35) {
    throw new Error('Anatomy display registry must cover all 35 source groups.');
  }

  const unitIds = recoveryUnitDisplayRegistry.map((entry) => entry.id);
  if (new Set(unitIds).size !== unitIds.length) {
    throw new Error('Recovery unit display IDs must be unique.');
  }

  const reachableUnitIds = new Set(
    anatomyRegionDisplayRegistry.flatMap((entry) => [
      ...(entry.unitIds ?? []),
      ...Object.values(entry.pathUnitIds ?? {}).flatMap((ids) => ids ?? []),
    ]),
  );
  const unreachableMapUnits = mapSelectableRecoveryUnitIds.filter(
    (unitId) => !reachableUnitIds.has(unitId),
  );
  if (unreachableMapUnits.length > 0) {
    throw new Error(
      `Map-selectable recovery units lack direct/shared access: ${unreachableMapUnits.join(', ')}`,
    );
  }
  const unexpectedlyReachableListOnlyUnits = listOnlyRecoveryUnitIds.filter(
    (unitId) => reachableUnitIds.has(unitId),
  );
  if (unexpectedlyReachableListOnlyUnits.length > 0) {
    throw new Error(
      `List-only recovery units must not claim map geometry: ${unexpectedlyReachableListOnlyUnits.join(', ')}`,
    );
  }

  const listOnly = [...listOnlyRecoveryUnitIds].sort().join(',');
  if (listOnly !== ['iliacus', 'psoas_major', 'subscapularis', 'vastus_intermedius'].sort().join(',')) {
    throw new Error(`Unexpected list-only recovery units: ${listOnly}`);
  }

  const neckEntries = anatomyRegionDisplayRegistry.filter(
    (entry) => entry.slug === 'neck',
  );
  if (
    neckEntries.length !== 2 ||
    neckEntries.some(
      (entry) =>
        entry.treatment !== 'unavailable' || !entry.unavailableReason,
    )
  ) {
    throw new Error('Neck must stay visible and explicitly unavailable.');
  }

  const frontAbsLeft = [0, 1, 2, 3].map((index) =>
    resolveDirectPathUnitId('front', 'abs', 'left', index),
  );
  const frontAbsRight = [0, 1, 2, 3].map((index) =>
    resolveDirectPathUnitId('front', 'abs', 'right', index),
  );
  const backErectorLeft = [0, 1].map((index) =>
    resolveDirectPathUnitId('back', 'lower-back', 'left', index),
  );
  const backErectorRight = [0, 1].map((index) =>
    resolveDirectPathUnitId('back', 'lower-back', 'right', index),
  );

  if (
    frontAbsLeft.join(',') !==
      ['upper_abs', 'lower_abs', 'upper_abs', 'lower_abs'].join(',') ||
    frontAbsRight.join(',') !==
      ['upper_abs', 'upper_abs', 'lower_abs', 'lower_abs'].join(',')
  ) {
    throw new Error('Side-aware upper/lower abdominal path order changed.');
  }

  if (
    backErectorLeft.join(',') !==
      ['lower_erector_spinae', 'upper_erector_spinae'].join(',') ||
    backErectorRight.join(',') !==
      ['upper_erector_spinae', 'lower_erector_spinae'].join(',')
  ) {
    throw new Error('Side-aware upper/lower erector path order changed.');
  }

  validatePathCoverage('front', frontPaths);
  validatePathCoverage('back', backPaths);

  return summary;
};
