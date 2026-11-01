import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { theme } from '../../theme';
import {
  anatomyRegionDisplayByKey,
  backPaths,
  frontPaths,
  FRONT_ANATOMY_VIEW_BOX,
  recoveryUnitDisplayById,
  resolveDirectPathUnitId,
  type AnatomySide,
  type AnatomyView,
  type RecoveryUnitId,
} from '../../recovery/anatomy';
import { RECOVERY_GROUP_BY_ID, RECOVERY_UNIT_BY_ID } from '../../recovery';
import type {
  MuscleRecoveryUnitId,
  RecoveryPresentationGroupId,
  RecoveryGroupId,
  RecoveryState,
  ScopeRecoveryPresentationGroupSummary,
} from '../../recovery';

type ResolutionMode = 'individual' | 'group';

interface RecoveryAnatomyMapProps {
  view: AnatomyView;
  state: RecoveryState;
  resolution: ResolutionMode;
  selectedUnitId: string | null;
  selectedGroupId: RecoveryPresentationGroupId | null;
  presentationGroups: readonly ScopeRecoveryPresentationGroupSummary[];
  relevantUnitIds: ReadonlySet<string>;
  onSelectUnit: (unitId: RecoveryUnitId) => void;
  onSelectGroup: (groupId: RecoveryPresentationGroupId) => void;
  onOpenRegion: (title: string, unitIds: readonly RecoveryUnitId[]) => void;
}

const NEUTRAL_FILL = theme.colors.surfaceSecondary;

function burdenColor(burden: number | null | undefined, relevant: boolean): string {
  if (burden == null) return NEUTRAL_FILL;
  if (!relevant) return theme.colors.surfaceMuted;
  if (burden < 25) return theme.colors.accentCyan;
  if (burden < 50) return theme.colors.accentGreen;
  if (burden < 75) return theme.colors.accentAmber;
  return theme.colors.accentRed;
}

export default function RecoveryAnatomyMap({
  view,
  state,
  resolution,
  selectedUnitId,
  selectedGroupId,
  presentationGroups,
  relevantUnitIds,
  onSelectUnit,
  onSelectGroup,
  onOpenRegion,
}: RecoveryAnatomyMapProps) {
  const paths = view === 'front' ? frontPaths : backPaths;
  // The source back paths occupy x=724..1448 while the front paths already
  // occupy x=0..724. Render both against the same physical canvas so
  // xMidYMid consistently centers either view without altering source geometry.
  const viewBox = FRONT_ANATOMY_VIEW_BOX;
  const sourceTransform = view === 'back' ? 'translate(-724 0)' : undefined;
  const selectedDisplay = selectedUnitId
    ? recoveryUnitDisplayById.get(selectedUnitId as RecoveryUnitId)
    : undefined;

  const selectedRegionSlug = selectedDisplay?.regionSlug;
  const presentationGroupsById = useMemo(
    () => new Map(presentationGroups.map((group) => [group.presentationGroupId, group])),
    [presentationGroups],
  );
  const rendered = useMemo(
    () =>
      paths.flatMap((group) => {
        const region = anatomyRegionDisplayByKey.get(`${view}:${group.slug}`);
        return (['common', 'left', 'right'] as const).flatMap((side) => {
          const sidePaths = group.path[side] ?? [];
          return sidePaths.map((pathData, pathIndex) => {
            const directUnitId = resolveDirectPathUnitId(
              view,
              group.slug,
              side as AnatomySide,
              pathIndex,
            );
            const sharedIds =
              region?.treatment === 'shared' ? region.unitIds ?? [] : [];
            const candidateIds = directUnitId ? [directUnitId] : sharedIds;
            const candidateGroupIds = [...new Set(
              candidateIds.map(
                (unitId) => RECOVERY_UNIT_BY_ID[unitId]?.groupId,
              ).filter((groupId): groupId is RecoveryGroupId => Boolean(groupId)),
            )];
            const candidatePresentationGroupIds = [...new Set(
              candidateGroupIds.map((groupId) =>
                groupId === 'rotator_cuff' ? 'upper_back' : groupId,
              ),
            )] as RecoveryPresentationGroupId[];
            const burdens = resolution === 'group'
              ? candidatePresentationGroupIds
                  .map((groupId) => presentationGroupsById.get(groupId)?.burden)
                  .filter((value): value is number => value != null)
              : candidateIds
                  .map(
                    (unitId) =>
                      state.units[unitId as MuscleRecoveryUnitId]?.burden,
                  )
                  .filter((value): value is number => value != null);
            const selectedCandidateBurden =
              resolution === 'group' && selectedGroupId && candidatePresentationGroupIds.includes(selectedGroupId)
                ? presentationGroupsById.get(selectedGroupId)?.burden
                : resolution === 'individual' &&
                    selectedUnitId &&
                    candidateIds.includes(selectedUnitId as RecoveryUnitId)
                  ? state.units[selectedUnitId as MuscleRecoveryUnitId]?.burden
                : null;
            const burden =
              selectedCandidateBurden ??
              (burdens.length
                ? burdens.reduce((sum, value) => sum + value, 0) / burdens.length
                : null);
            const relevant = candidateIds.some((unitId) => relevantUnitIds.has(unitId));
            const selected = resolution === 'group'
              ? Boolean(selectedGroupId && candidatePresentationGroupIds.includes(selectedGroupId))
              : directUnitId === selectedUnitId ||
                (selectedRegionSlug === group.slug &&
                  candidateIds.includes(selectedUnitId as RecoveryUnitId));
            const interactive =
              resolution === 'group'
                ? candidatePresentationGroupIds.length > 0
                : Boolean(directUnitId) ||
                  (region?.treatment === 'shared' && sharedIds.length > 0) ||
                  region?.treatment === 'unavailable';
            const label =
              resolution === 'group'
                ? candidatePresentationGroupIds
                    .map((groupId) => RECOVERY_GROUP_BY_ID[groupId]?.name ?? groupId)
                    .join(' or ')
                : directUnitId
                  ? recoveryUnitDisplayById.get(directUnitId)?.name ?? directUnitId
                  : region?.parentLabel ?? group.slug;
            const firstLogicalPath =
              region?.treatment === 'shared'
                ? pathIndex === 0
                : directUnitId
                  ? sidePaths.findIndex((_, candidateIndex) =>
                      resolveDirectPathUnitId(
                        view,
                        group.slug,
                        side as AnatomySide,
                        candidateIndex,
                      ) === directUnitId,
                    ) === pathIndex
                  : pathIndex === 0;

            const onPress = () => {
              if (resolution === 'group' && candidatePresentationGroupIds.length) {
                onSelectGroup(candidatePresentationGroupIds[0]);
              } else if (directUnitId) {
                onSelectUnit(directUnitId);
              } else if (region?.treatment === 'shared' && sharedIds.length) {
                onOpenRegion(region.parentLabel, sharedIds);
              } else if (region?.treatment === 'unavailable') {
                onOpenRegion(region.parentLabel, []);
              }
            };

            return (
              <Path
                key={`${group.slug}:${side}:${pathIndex}`}
                d={pathData}
                fill={
                  region?.treatment === 'structural' ||
                  region?.treatment === 'unavailable'
                    ? group.color
                    : burdenColor(burden, relevant)
                }
                stroke={selected ? theme.colors.text : theme.colors.background}
                strokeWidth={selected ? 5 : 1.5}
                opacity={interactive ? 1 : 0.72}
                onPress={interactive ? onPress : undefined}
                accessible={interactive && firstLogicalPath}
                accessibilityLabel={
                  interactive
                    ? `${label}, ${side === 'common' ? 'center' : side} side`
                    : undefined
                }
              />
            );
          });
        });
      }),
    [
      onOpenRegion,
      onSelectGroup,
      onSelectUnit,
      paths,
      relevantUnitIds,
      resolution,
      selectedGroupId,
      selectedRegionSlug,
      selectedUnitId,
      state.units,
      view,
      presentationGroupsById,
    ],
  );

  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        accessibilityLabel={`${view} anatomy recovery map`}
      >
        <G transform={sourceTransform}>{rendered}</G>
      </Svg>
      <Text style={styles.attribution}>
        Anatomy geometry: react-native-body-highlighter, MIT.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 0.64,
    maxHeight: 680,
    minHeight: 480,
    alignItems: 'center',
  },
  attribution: {
    position: 'absolute',
    bottom: 0,
    fontFamily: theme.typography.sans,
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
