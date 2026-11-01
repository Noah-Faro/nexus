import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Info,
  SlidersHorizontal,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import type { Exercise, WorkoutSession, WorkoutTemplate } from '../../trainingTypes';
import type { StorageLoadStatus } from '../../utils';
import { EXERCISE_LIBRARY } from '../../exerciseLibrary';
import { CANONICAL_TEMPLATE_ID_BY_PRESET } from '../../trainingDefaults';
import {
  RECOVERY_GROUPS,
  RECOVERY_GROUP_BY_ID,
  RECOVERY_UNIT_BY_ID,
  calculateRecoveryState,
  evaluateRecoveryScope,
  resolveRecoveryScope,
  selectScopeRecoveryPresentationGroupSummaries,
  type GroupRecoverySignal,
  type HistoryCompleteness,
  type MuscleRecoveryUnitId,
  type RecoveryGroupId,
  type RecoveryDashboardResult,
  type RecoveryPresentationGroupId,
  type RecoveryScope,
  type ScopeRecoveryPresentationGroupSummary,
  type UnitRecoverySignal,
} from '../../recovery';
import {
  addRecoveryGroupObservation,
  selectRecoveryGroupObservations,
  tryLoadRecoveryObservations,
  type RecoveryGroupObservation,
} from '../../recovery/checkInRepository';
import {
  isRecoveryUnitVisibleInView,
  recoveryUnitDisplayById,
  type AnatomyView,
  type RecoveryUnitId,
} from '../../recovery/anatomy';
import AppAlertModal, { type AppAlertButton } from '../AppAlertModal';
import SheetHeader from '../SheetHeader';
import SegmentedControl from '../SegmentedControl';
import RecoveryAnatomyMap from './RecoveryAnatomyMap';
import {
  CoverageSheet,
  CustomWorkoutSheet,
  ExerciseGuideSheet,
  UnitChooserSheet,
  type CustomPrescriptionItem,
} from './RecoverySheets';
import { useReducedMotion } from './useReducedMotion';

export interface MuscleRecoveryViewProps {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  customExercises?: Exercise[];
  historyCompleteness?: HistoryCompleteness;
  templateLoadStatus?: StorageLoadStatus;
}

type ResolutionMode = 'individual' | 'group';
type ScopeKey = 'all' | 'push' | 'pull' | 'legs' | 'custom' | string;

function presentationGroupForUnit(
  unitId: MuscleRecoveryUnitId | null,
): RecoveryPresentationGroupId | null {
  if (unitId == null) return null;
  const groupId = RECOVERY_UNIT_BY_ID[unitId]?.groupId;
  if (!groupId) return null;
  return (groupId === 'rotator_cuff' ? 'upper_back' : groupId) as RecoveryPresentationGroupId;
}

const bundledExercises = Object.values(EXERCISE_LIBRARY);

function scopeFromKey(
  key: ScopeKey,
  templates: readonly WorkoutTemplate[],
  custom: readonly CustomPrescriptionItem[],
): RecoveryScope {
  if (key === 'all') return { type: 'all' };
  if (key === 'push' || key === 'pull' || key === 'legs') {
    return { type: 'preset', preset: key };
  }
  if (key === 'custom') {
    return {
      type: 'prescription',
      id: 'custom-comparison',
      label: 'Custom workout',
      exercises: custom.map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.sets,
        targetReps: item.reps,
        targetRpe: null,
      })),
    };
  }
  const template = templates.find((item) => item.id === key);
  return template
    ? { type: 'template', templateId: template.id }
    : { type: 'exercise_selection', exerciseIds: [key], label: 'Exercise' };
}

function formatPercent(value: number | null): string {
  if (value == null) return 'Unavailable';
  if (value === 100) return '100%';
  return `${Math.min(99, Math.round(value))}%`;
}

function formatReadiness(value: number | null, burden?: number | null): string {
  if (value == null) return 'Unavailable';
  const displayed = burden === 0 && value === 100
    ? 100
    : Math.min(99, Math.round(value));
  return `${displayed}% ready`;
}

function formatCoverage(value: number | null): string {
  return value == null ? 'N/A' : `${Math.round(value * 100)}%`;
}

function burdenBand(burden: number | null): string {
  if (burden == null) return 'Unavailable';
  if (burden < 25) return 'Low burden';
  if (burden < 50) return 'Moderate burden';
  if (burden < 75) return 'High burden';
  return 'Very high burden';
}

function unitName(unitId: string | null): string {
  if (!unitId) return 'None';
  return (
    recoveryUnitDisplayById.get(unitId as RecoveryUnitId)?.name ?? unitId
  ).replaceAll('\u00c2\u00b7', '\u00b7');
}

function mostRecentGroupObservation(
  observations: readonly RecoveryGroupObservation[],
  groupId: RecoveryPresentationGroupId,
): RecoveryGroupObservation | undefined {
  return observations
    .filter((item) => item.target.presentationGroupId === groupId)
    .sort((left, right) => right.recordedAt - left.recordedAt)[0];
}

export default function MuscleRecoveryView({
  sessions,
  templates,
  customExercises = [],
  historyCompleteness = 'complete',
  templateLoadStatus = 'valid',
}: MuscleRecoveryViewProps) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const guideTriggerRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const guideFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTablet = width >= 900;
  const hasTabletGutters = width >= 768;
  const useCompactTargetHeader = width < 420;
  const asOf = useMemo(() => Date.now(), [sessions]);
  const [scopeKey, setScopeKey] = useState<ScopeKey>('all');
  const [customPrescription, setCustomPrescription] = useState<CustomPrescriptionItem[]>([]);
  const [anatomyView, setAnatomyView] = useState<AnatomyView>('front');
  const [resolution, setResolution] = useState<ResolutionMode>('group');
  const [expandedWorkoutKey, setExpandedWorkoutKey] = useState<ScopeKey | null>(null);
  const [muscleListExpanded, setMuscleListExpanded] = useState(false);
  const [selectedUnitId, setSelectedUnitId] =
    useState<MuscleRecoveryUnitId | null>(null);
  const [selectedGroupId, setSelectedGroupId] =
    useState<RecoveryPresentationGroupId | null>(null);
  const [customVisible, setCustomVisible] = useState(false);
  const [coverageVisible, setCoverageVisible] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [groupObservationVisible, setGroupObservationVisible] = useState(false);
  const [chooser, setChooser] = useState<{
    visible: boolean;
    title: string;
    unitIds: readonly RecoveryUnitId[];
    unavailableReason?: string;
    purpose: 'detail';
  }>({ visible: false, title: '', unitIds: [], purpose: 'detail' });
  const [groupObservations, setGroupObservations] = useState<RecoveryGroupObservation[]>([]);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: AppAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  const allExercises = useMemo(() => {
    const seen = new Set(bundledExercises.map((exercise) => exercise.id));
    return [
      ...bundledExercises,
      ...customExercises.filter((exercise) => !seen.has(exercise.id)),
    ];
  }, [customExercises]);

  const scope = useMemo(
    () => scopeFromKey(scopeKey, templates, customPrescription),
    [customPrescription, scopeKey, templates],
  );
  const recoveryState = useMemo(
    () => calculateRecoveryState(sessions, asOf, { historyCompleteness }),
    [asOf, historyCompleteness, sessions],
  );
  const dashboard = useMemo<RecoveryDashboardResult>(
    () => ({
      state: recoveryState,
      scopeEvaluation: evaluateRecoveryScope(
        resolveRecoveryScope(scope, templates),
        recoveryState,
      ),
    }),
    [recoveryState, scope, templates],
  );

  const comparisonResults = useMemo<Array<{
    key: ScopeKey;
    label: string;
    unavailableReason?: string;
    result?: RecoveryDashboardResult;
  }>>(() => {
    const scopes: { key: ScopeKey; label: string; scope?: RecoveryScope; unavailableReason?: string }[] = (
      Object.entries(CANONICAL_TEMPLATE_ID_BY_PRESET) as [keyof typeof CANONICAL_TEMPLATE_ID_BY_PRESET, string][]
    ).map(([preset, templateId]) => {
      const template = templates.find((item) => item.id === templateId);
      const unavailableReason = templateLoadStatus === 'invalid'
        ? `The saved ${preset} template (${templateId}) is not among the valid template records. Malformed saved templates were excluded without changing the original data.`
        : templateLoadStatus === 'unreadable' || templateLoadStatus === 'locked'
          ? `Saved workout templates could not be read, so ${preset} readiness cannot be resolved.`
          : `The saved ${preset} template (${templateId}) is unavailable, so readiness cannot be resolved.`;
      return template
        ? { key: template.id, label: template.name, scope: { type: 'template' as const, templateId: template.id } }
        : {
            key: templateId,
            label: `${preset} template unavailable`,
            unavailableReason,
          };
    });
    if (customPrescription.length) {
      scopes.push({
        key: 'custom',
        label: 'Custom',
        scope: scopeFromKey('custom', templates, customPrescription),
      });
    }
    return scopes.map((item) => {
      if (!item.scope) return item;
      return {
        ...item,
        result: {
          state: recoveryState,
          scopeEvaluation: evaluateRecoveryScope(
            resolveRecoveryScope(item.scope, templates),
            recoveryState,
          ),
        },
      };
    });
  }, [customPrescription, recoveryState, templateLoadStatus, templates]);

  const relevantUnitIds = useMemo(
    () => new Set(dashboard.scopeEvaluation.targets.map((target) => target.unitId)),
    [dashboard.scopeEvaluation.targets],
  );
  const scopedGroups = useMemo(
    () => selectScopeRecoveryPresentationGroupSummaries(dashboard.scopeEvaluation, dashboard.state),
    [dashboard],
  );
  const allPresentationGroups = useMemo(() => {
    const allScope = resolveRecoveryScope({ type: 'all' }, templates);
    return selectScopeRecoveryPresentationGroupSummaries(
      evaluateRecoveryScope(allScope, recoveryState),
      recoveryState,
    );
  }, [recoveryState, templates]);
  const selectedUnit = selectedUnitId
    ? dashboard.state.units[selectedUnitId]
    : undefined;
  const selectedPresentationGroup = selectedGroupId
    ? allPresentationGroups.find((group) => group.presentationGroupId === selectedGroupId)
    : undefined;
  const readyGroupCount = scopedGroups.filter((group) => group.burden != null && group.burden < 25).length;

  useEffect(() => {
    tryLoadRecoveryObservations().then((result) => {
      if (result.ok) {
        setGroupObservations(selectRecoveryGroupObservations(result.value));
      } else {
        setAlertConfig({
          visible: true,
          title: 'Observations unavailable',
          message: result.error.message,
          buttons: [{ text: 'OK' }],
        });
      }
    });
  }, []);

  useEffect(
    () => () => {
      if (guideFocusTimerRef.current != null) {
        clearTimeout(guideFocusTimerRef.current);
      }
    },
    [],
  );

  const restoreGuideTriggerFocus = useCallback(() => {
    if (guideFocusTimerRef.current != null) {
      clearTimeout(guideFocusTimerRef.current);
      guideFocusTimerRef.current = null;
    }
    requestAnimationFrame(() => {
      const reactTag = findNodeHandle(guideTriggerRef.current);
      if (reactTag != null) {
        AccessibilityInfo.setAccessibilityFocus(reactTag);
      }
    });
  }, []);

  const openGuide = useCallback(() => {
    if (guideFocusTimerRef.current != null) {
      clearTimeout(guideFocusTimerRef.current);
      guideFocusTimerRef.current = null;
    }
    setGuideVisible(true);
  }, []);

  const closeGuide = useCallback(() => {
    setGuideVisible(false);
    if (Platform.OS === 'android') {
      guideFocusTimerRef.current = setTimeout(
        restoreGuideTriggerFocus,
        reducedMotion ? 50 : 400,
      );
    }
  }, [reducedMotion, restoreGuideTriggerFocus]);

  const selectUnit = useCallback((unitId: RecoveryUnitId) => {
    Haptics.selectionAsync();
    setSelectedUnitId(unitId as MuscleRecoveryUnitId);
    setDetailVisible(true);
  }, []);

  const openRegion = useCallback(
    (title: string, unitIds: readonly RecoveryUnitId[]) => {
      Haptics.selectionAsync();
      setChooser({
        visible: true,
        title,
        unitIds,
        unavailableReason: unitIds.length
          ? undefined
          : 'No neck-specific exercise mapping exists. Neck remains neutral and unavailable.',
        purpose: 'detail',
      });
    },
    [],
  );

  const chooseUnit = (unitId: RecoveryUnitId) => {
    setChooser((current) => ({ ...current, visible: false }));
    setSelectedUnitId(unitId as MuscleRecoveryUnitId);
    setDetailVisible(true);
  };

  const openGroupObservation = () => {
    if (selectedPresentationGroup) setGroupObservationVisible(true);
  };

  const applyCustom = (items: readonly CustomPrescriptionItem[]) => {
    setCustomPrescription([...items]);
    setCustomVisible(false);
    setScopeKey('custom');
    setExpandedWorkoutKey('custom');
  };

  const chooseComparison = (
    key: ScopeKey,
    limitingUnitId: MuscleRecoveryUnitId | null,
  ) => {
    Haptics.selectionAsync();
    setScopeKey(key);
    setExpandedWorkoutKey((current) => current === key ? null : key);
    setSelectedUnitId(null);
    setSelectedGroupId(presentationGroupForUnit(limitingUnitId));
    setResolution('group');
    setDetailVisible(false);
    if (limitingUnitId) {
      const preferredView = recoveryUnitDisplayById.get(
        limitingUnitId as RecoveryUnitId,
      )?.preferredView;
      if (preferredView) setAnatomyView(preferredView);
    }
  };

  const chooseGroup = (groupId: RecoveryPresentationGroupId) => {
    Haptics.selectionAsync();
    setSelectedGroupId(groupId);
    setSelectedUnitId(null);
    setResolution('group');
    setDetailVisible(false);
  };

  const activateIndividualResolution = () => {
    setResolution('individual');
    setSelectedGroupId(null);
    if (!selectedUnitId) setDetailVisible(false);
  };

  const activateGroupResolution = () => {
    const groupId = selectedUnitId
      ? presentationGroupForUnit(selectedUnitId)
      : selectedGroupId;
    setResolution('group');
    setSelectedGroupId(groupId);
    setSelectedUnitId(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          hasTabletGutters && styles.contentTablet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Activity size={22} color={theme.colors.accentCyan} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Recovery</Text>
            <Text style={styles.subtitle}>
              Estimated readiness from your mapped training history.
            </Text>
          </View>
          <Pressable
            ref={guideTriggerRef}
            onPress={openGuide}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open exercise-impact guide"
          >
            <BookOpen size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionTitle title="WORKOUT READINESS" />
          <Pressable
            onPress={() => {
              setScopeKey('all');
              setExpandedWorkoutKey(null);
              setSelectedUnitId(null);
              setSelectedGroupId(null);
            }}
            style={({ pressed }) => [styles.allMusclesAction, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.allMusclesActionText}>All muscles</Text>
          </Pressable>
        </View>
        <View style={styles.comparisonGrid}>
          {comparisonResults.map((item) => {
            const groups = item.result
              ? selectScopeRecoveryPresentationGroupSummaries(
                  item.result.scopeEvaluation,
                  item.result.state,
                )
              : [];
            return (
              <CompactWorkoutAccordion
                key={item.key}
                label={item.label}
                result={item.result}
                unavailableReason={item.unavailableReason}
                selected={scopeKey === item.key}
                expanded={expandedWorkoutKey === item.key}
                groups={groups}
                exerciseName={(exerciseId) => allExercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId}
                onEditCustom={item.key === 'custom' ? () => setCustomVisible(true) : undefined}
                onPress={() => {
                  if (item.result) {
                    chooseComparison(item.key, item.result.scopeEvaluation.limitingUnitId);
                  }
                }}
              />
            );
          })}
          {!customPrescription.length ? (
            <Pressable
              onPress={() => setCustomVisible(true)}
              style={({ pressed }) => [
                styles.addComparisonCard,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <SlidersHorizontal size={18} color={theme.colors.accentCyan} />
              <View style={styles.customWorkoutCopy}>
                <Text style={styles.addComparisonTitle}>Custom workout</Text>
                <Text style={styles.addComparisonText}>Choose exercises, sets, and reps.</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <SectionTitle title="MAP FOCUS" />
        <View style={styles.controlRow}>
          <View style={styles.segmentControlWrap}>
            <SegmentedControl
              values={['group', 'individual'] as const}
              selectedValue={resolution}
              onChange={(value) => value === 'group' ? activateGroupResolution() : activateIndividualResolution()}
              labels={['Muscle groups', 'Individual']}
            />
          </View>
          <View style={styles.segmentControlWrap}>
            <SegmentedControl
              values={['front', 'back'] as const}
              selectedValue={anatomyView}
              onChange={setAnatomyView}
              labels={['Front', 'Back']}
            />
          </View>
        </View>

        <View style={styles.tileGrid}>
          <MetricTile
            label={`${dashboard.scopeEvaluation.scope.label} readiness`}
            value={formatPercent(dashboard.scopeEvaluation.readiness)}
            detail={burdenBand(dashboard.scopeEvaluation.burden)}
          />
          <MetricTile
            label="Ready groups"
            value={`${readyGroupCount}/${scopedGroups.length}`}
            detail="Low estimated burden"
          />
          <MetricTile
            label="Limiting group"
            value={dashboard.scopeEvaluation.limitingUnitId
              ? RECOVERY_GROUP_BY_ID[presentationGroupForUnit(dashboard.scopeEvaluation.limitingUnitId) ?? '']?.name ?? 'None'
              : 'None'}
            detail={
              dashboard.scopeEvaluation.maximumCriticalBurden == null
                ? 'No supported target'
                : dashboard.scopeEvaluation.maximumCriticalBurden === 0
                  ? 'No current mapped burden'
                : `${Math.round(dashboard.scopeEvaluation.maximumCriticalBurden)}% burden`
            }
          />
          <MetricTile
            label="Estimate quality"
            value={dashboard.scopeEvaluation.status}
            detail={templateLoadStatus === 'invalid'
              ? 'Saved templates partly invalid'
              : templateLoadStatus === 'unreadable' || templateLoadStatus === 'locked'
                ? 'Saved templates unavailable'
                : `${formatCoverage(dashboard.scopeEvaluation.coverage.mappingCoverage)} mapped`}
            interactive
            onPress={() => setCoverageVisible(true)}
          />
        </View>

        <View style={[styles.mapDetailLayout, isTablet && styles.mapDetailTablet]}>
          <View style={styles.mapCard}>
            <RecoveryAnatomyMap
              view={anatomyView}
              state={dashboard.state}
              resolution={resolution}
              selectedUnitId={selectedUnitId}
              selectedGroupId={selectedGroupId}
              presentationGroups={allPresentationGroups}
              relevantUnitIds={relevantUnitIds}
              onSelectUnit={selectUnit}
              onSelectGroup={chooseGroup}
              onOpenRegion={openRegion}
            />
            {selectedUnitId &&
            !isRecoveryUnitVisibleInView(selectedUnitId as RecoveryUnitId, anatomyView) ? (
              <Text style={styles.mapNote}>
                Selected anatomy is on the other view; its detail remains active.
              </Text>
            ) : null}
          </View>
          {isTablet ? (
            <View style={styles.inlineDetail}>
              <DetailContent
                dashboard={dashboard}
                unit={selectedUnit}
                presentationGroup={selectedPresentationGroup}
                groupObservations={groupObservations}
                onRecordGroupFeeling={openGroupObservation}
                onSelectUnit={selectUnit}
              />
            </View>
          ) : null}
        </View>

        {!isTablet && resolution === 'group' && selectedPresentationGroup ? (
          <View style={styles.groupOverviewCard}>
            <DetailContent
              dashboard={dashboard}
              presentationGroup={selectedPresentationGroup}
              groupObservations={groupObservations}
              onRecordGroupFeeling={openGroupObservation}
              onSelectUnit={selectUnit}
            />
          </View>
        ) : null}

        <View style={[styles.targetHeader, useCompactTargetHeader && styles.targetHeaderCompact]}>
          <View style={styles.targetHeaderCopy}>
            <SectionTitle title="MUSCLE-GROUP READINESS" />
            <Text style={styles.sectionHint}>
              {scopedGroups.length} relevant groups · {scopedGroups[0] ? RECOVERY_GROUP_BY_ID[scopedGroups[0].presentationGroupId]?.name : 'No mapped groups'} highest burden
            </Text>
          </View>
          <Pressable
            onPress={() => setMuscleListExpanded((current) => !current)}
            style={({ pressed }) => [styles.disclosureButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: muscleListExpanded }}
          >
            <Text style={styles.disclosureButtonText}>{muscleListExpanded ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {muscleListExpanded ? (
          <View style={styles.targetList}>
            {scopedGroups.map((group) => (
              <GroupSummaryRow
                key={group.presentationGroupId}
                summary={group}
                selected={selectedGroupId === group.presentationGroupId}
                onPress={() => chooseGroup(group.presentationGroupId)}
              />
            ))}
            {!scopedGroups.length ? (
            <View style={styles.emptyState}>
              <Info size={20} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No mapped groups</Text>
              <Text style={styles.emptyText}>
                Select a scope with quantitative muscle targets.
              </Text>
            </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {!isTablet ? (
        <DetailSheet
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          dashboard={dashboard}
          unit={selectedUnit}
          groupObservations={groupObservations}
          onRecordGroupFeeling={openGroupObservation}
          onSelectUnit={selectUnit}
        />
      ) : null}
      <CustomWorkoutSheet
        visible={customVisible}
        exercises={allExercises}
        value={customPrescription}
        onClose={() => setCustomVisible(false)}
        onApply={applyCustom}
      />
      <CoverageSheet
        visible={coverageVisible}
        coverage={dashboard.scopeEvaluation.coverage}
        asOf={dashboard.scopeEvaluation.asOf}
        registryVersion={dashboard.scopeEvaluation.activationRegistryVersion}
        modelVersion={dashboard.scopeEvaluation.recoveryModelVersion}
        onClose={() => setCoverageVisible(false)}
        onOpenGuide={() => {
          setCoverageVisible(false);
          openGuide();
        }}
      />
      <ExerciseGuideSheet
        visible={guideVisible}
        onClose={closeGuide}
        onDismiss={restoreGuideTriggerFocus}
      />
      <UnitChooserSheet
        visible={chooser.visible}
        title={chooser.title}
        unitIds={chooser.unitIds}
        unavailableReason={chooser.unavailableReason}
        onClose={() => setChooser((current) => ({ ...current, visible: false }))}
        onSelect={chooseUnit}
      />
      <GroupObservationSheet
        visible={groupObservationVisible}
        groupId={selectedPresentationGroup?.presentationGroupId ?? null}
        dashboard={dashboard}
        latest={selectedPresentationGroup
          ? mostRecentGroupObservation(groupObservations, selectedPresentationGroup.presentationGroupId)
          : undefined}
        onClose={() => setGroupObservationVisible(false)}
        onSaved={(observation) => {
          setGroupObservations((current) => [...current, observation]);
          setGroupObservationVisible(false);
        }}
        onError={(message) =>
          setAlertConfig({
            visible: true,
            title: 'Could not save observation',
            message,
            buttons: [{ text: 'OK' }],
          })
        }
      />
      <AppAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

function CompactWorkoutAccordion({
  label,
  result,
  unavailableReason,
  selected,
  expanded,
  groups,
  exerciseName,
  onEditCustom,
  onPress,
}: {
  label: string;
  result?: RecoveryDashboardResult;
  unavailableReason?: string;
  selected: boolean;
  expanded: boolean;
  groups: readonly ScopeRecoveryPresentationGroupSummary[];
  exerciseName: (exerciseId: string) => string;
  onEditCustom?: () => void;
  onPress: () => void;
}) {
  if (!result) {
    return (
      <View style={styles.workoutAccordion}>
        <View style={styles.workoutAccordionHeader}>
          <View style={styles.workoutAccordionCopy}>
            <Text style={styles.comparisonTitle}>{label}</Text>
            <Text style={styles.workoutAccordionMeta}>Unavailable</Text>
          </View>
          <Text style={styles.workoutAccordionValue}>—</Text>
        </View>
        <Text style={styles.workoutQuality}>{unavailableReason}</Text>
      </View>
    );
  }
  const evaluation = result.scopeEvaluation;
  const limiting = groups.find((group) => group.containsLimitingUnit);
  const burdenedGroups = groups.filter((group) => (group.burden ?? 0) > 0);
  const hasRecentMappedLoad = evaluation.targets.some(
    (target) => result.state.units[target.unitId]?.lastMaterialLoadAt != null,
  );
  return (
    <View style={[styles.workoutAccordion, selected && styles.selectedBorder]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.workoutAccordionHeader, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded, selected }}
        accessibilityLabel={`${label}, ${formatPercent(evaluation.readiness)} readiness, ${evaluation.status}`}
      >
        <View style={styles.workoutAccordionCopy}>
          <Text style={styles.comparisonTitle}>{label}</Text>
          <Text style={styles.workoutAccordionMeta}>{burdenBand(evaluation.burden)} · {evaluation.status}</Text>
        </View>
        <Text style={styles.workoutAccordionValue}>{formatPercent(evaluation.readiness)}</Text>
        <ChevronDown size={18} color={theme.colors.textMuted} style={expanded ? styles.chevronOpen : undefined} />
      </Pressable>
      {expanded ? (
        <View style={styles.workoutAccordionBody}>
          <Text style={styles.workoutSummaryText}>
            Limiting group: {limiting ? RECOVERY_GROUP_BY_ID[limiting.presentationGroupId]?.name : 'None'}
          </Text>
          <Text style={styles.workoutSummaryText}>
            Highest burden: {burdenedGroups.slice(0, 3).map((group) => RECOVERY_GROUP_BY_ID[group.presentationGroupId]?.name).filter(Boolean).join(' · ') || 'No current mapped burden'}
          </Text>
          {evaluation.scope.exercises.map((exercise) => (
            <Text key={exercise.exerciseId} style={styles.workoutExercise}>
              {exerciseName(exercise.exerciseId)} {exercise.targetSets}×{exercise.targetReps ?? '—'}
            </Text>
          ))}
          <Text style={styles.workoutQuality}>
            {evaluation.status !== 'unavailable' && !hasRecentMappedLoad
              ? 'No recent mapped load for these target muscles.'
              : evaluation.status === 'available'
              ? 'Estimate quality: complete mapped workout and recent history.'
              : evaluation.status === 'limited'
                ? 'Estimate quality: some workout or training detail is missing.'
                : 'Estimate quality: a numeric readiness estimate is not available.'}
          </Text>
          {onEditCustom ? (
            <Pressable
              onPress={onEditCustom}
              style={({ pressed }) => [styles.workoutEditAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.workoutEditActionText}>Edit custom workout</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MetricTile({
  label,
  value,
  detail,
  interactive = false,
  onPress,
}: {
  label: string;
  value: string;
  detail: string;
  interactive?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={2}>{value}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
    </>
  );
  return interactive ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.metricTile, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.metricTile}>{content}</View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function UnitRow({
  name,
  burden,
  readiness,
  relevance,
  selected,
  onPress,
}: {
  name: string;
  burden: number;
  readiness: number;
  relevance: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetRow,
        selected && styles.selectedBorder,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${Math.round(readiness)} percent ready`}
    >
      <View style={styles.targetCopy}>
        <Text style={styles.targetName}>{name}</Text>
        <Text style={styles.targetMeta}>
          {Math.round(relevance * 100)}% workout relevance · {burdenBand(burden)}
        </Text>
      </View>
      <Text style={styles.targetValue}>{Math.round(readiness)}%</Text>
      <ChevronRight size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function GroupRow({
  name,
  signal,
  selected,
  onPress,
}: {
  name: string;
  signal: GroupRecoverySignal;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetRow,
        selected && styles.selectedBorder,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.targetCopy}>
        <Text style={styles.targetName}>{name}</Text>
        <Text style={styles.targetMeta}>
          {signal.childSignals.length} individual muscles · {signal.status}
        </Text>
      </View>
      <Text style={styles.targetValue}>{formatPercent(signal.readiness)}</Text>
      <ChevronRight size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function GroupSummaryRow({
  summary,
  selected,
  onPress,
}: {
  summary: ScopeRecoveryPresentationGroupSummary;
  selected: boolean;
  onPress: () => void;
}) {
  const name = RECOVERY_GROUP_BY_ID[summary.presentationGroupId]?.name ?? summary.presentationGroupId;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.targetRow, selected && styles.selectedBorder, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatReadiness(summary.readiness, summary.burden)}`}
    >
      <View style={styles.targetCopy}>
        <Text style={styles.targetName}>{name}</Text>
        <Text style={styles.targetMeta}>{summary.childUnitIds.length} individual muscles · {summary.status}</Text>
      </View>
      <Text style={styles.targetValue}>{formatPercent(summary.readiness)}</Text>
      <ChevronRight size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function DetailSheet({
  visible,
  onClose,
  ...contentProps
}: {
  visible: boolean;
  onClose: () => void;
  dashboard: RecoveryDashboardResult;
  unit?: UnitRecoverySignal;
  group?: GroupRecoverySignal;
  groupObservations: readonly RecoveryGroupObservation[];
  onRecordGroupFeeling: () => void;
  onSelectUnit: (unitId: RecoveryUnitId) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const gutter = width >= 768 ? theme.spacing.xl : theme.spacing.lg;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.detailScrim, { paddingHorizontal: gutter }]}>
        <SafeAreaView style={styles.detailSheet}>
          <SheetHeader title="Recovery detail" onClose={onClose} leading twoLine />
          <ScrollView contentContainerStyle={styles.detailScroll}>
            <DetailContent {...contentProps} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DetailContent({
  dashboard,
  unit,
  group,
  presentationGroup,
  groupObservations,
  onRecordGroupFeeling,
  onSelectUnit,
}: {
  dashboard: RecoveryDashboardResult;
  unit?: UnitRecoverySignal;
  group?: GroupRecoverySignal;
  presentationGroup?: ScopeRecoveryPresentationGroupSummary;
  groupObservations: readonly RecoveryGroupObservation[];
  onRecordGroupFeeling: () => void;
  onSelectUnit: (unitId: RecoveryUnitId) => void;
}) {
  const detailGroup: GroupRecoverySignal | undefined = presentationGroup
    ? {
        groupId: presentationGroup.presentationGroupId,
        asOf: dashboard.state.asOf,
        available: presentationGroup.status !== 'unavailable',
        burden: presentationGroup.burden,
        readiness: presentationGroup.readiness,
        weightedMean: null,
        maximum: null,
        signalCoverage: 1,
        childSignals: presentationGroup.childUnitIds
          .map((unitId) => dashboard.state.units[unitId])
          .filter((signal): signal is UnitRecoverySignal => signal != null),
        missingUnitIds: presentationGroup.childUnitIds.filter(
          (unitId) => !dashboard.state.units[unitId]?.available,
        ),
        status: presentationGroup.status,
      }
    : group;

  if (detailGroup && !unit) {
    const groupDefinition = RECOVERY_GROUPS.find((item) => item.id === detailGroup.groupId);
    const mostBurdenedChild = detailGroup.childSignals.reduce<UnitRecoverySignal | null>(
      (selected, child) => {
        if (!child.available || child.burden == null) return selected;
        return selected == null || (selected.burden ?? -1) < child.burden
          ? child
          : selected;
      },
      null,
    );
    const lastMappedLoadAt = detailGroup.childSignals.reduce<number | null>(
      (latest, child) =>
        child.lastMaterialLoadAt != null &&
        (latest == null || child.lastMaterialLoadAt > latest)
          ? child.lastMaterialLoadAt
          : latest,
      null,
    );
    return (
      <View style={styles.detailContent}>
        <Text style={styles.detailEyebrow}>MUSCLE GROUP</Text>
        <Text style={styles.detailTitle}>{groupDefinition?.name ?? detailGroup.groupId}</Text>
        <Text style={styles.detailValue}>{formatReadiness(detailGroup.readiness, detailGroup.burden)}</Text>
        <Text style={styles.detailBody}>
          {burdenBand(detailGroup.burden)}. Estimate quality: {detailGroup.status}.
        </Text>
        <Text style={styles.detailBody}>
          Most affected child: {mostBurdenedChild ? unitName(mostBurdenedChild.unitId) : 'None'}.
        </Text>
        <Text style={styles.detailBody}>
          {lastMappedLoadAt == null
            ? 'No recent mapped load.'
            : `Latest mapped load ${Math.round((detailGroup.asOf - lastMappedLoadAt) / 3_600_000)} hours ago.`}
        </Text>
        <Text style={styles.detailEyebrow}>CHILD MUSCLES</Text>
        {detailGroup.childSignals.map((child) => (
          <Pressable
            key={child.unitId}
            onPress={() => onSelectUnit(child.unitId as RecoveryUnitId)}
            style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.detailRowName}>{unitName(child.unitId)}</Text>
            <Text style={styles.detailRowValue}>{formatPercent(child.readiness)}</Text>
          </Pressable>
        ))}
        {presentationGroup ? (
          <GroupObservationSummary
            groupId={presentationGroup.presentationGroupId}
            observations={groupObservations}
            onRecord={onRecordGroupFeeling}
          />
        ) : null}
      </View>
    );
  }

  if (!unit) {
    return (
      <View style={styles.emptyState}>
        <Dumbbell size={24} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>Select anatomy</Text>
        <Text style={styles.emptyText}>
          Choose a muscle or group on the map or target list to inspect the estimate.
        </Text>
      </View>
    );
  }

  const recentContributors = unit.contributors.slice(0, 5);
  return (
    <View style={styles.detailContent}>
      <Text style={styles.detailEyebrow}>INDIVIDUAL MUSCLE</Text>
      <Text style={styles.detailTitle}>{unitName(unit.unitId)}</Text>
      <Text style={styles.detailValue}>{formatReadiness(unit.readiness, unit.burden)}</Text>
      <Text style={styles.detailBody}>{burdenBand(unit.burden)}.</Text>
      <Text style={styles.detailBody}>
        {unit.lastMaterialLoadAt == null
          ? 'No recent mapped load.'
          : `Last mapped load ${Math.round((unit.asOf - unit.lastMaterialLoadAt) / 3_600_000)} hours ago.`}
      </Text>
      <Text style={styles.detailEyebrow}>RECENT MAPPED TRAINING</Text>
      {recentContributors.length ? recentContributors.map((contributor, index) => (
        <View key={`${contributor.sessionId}:${contributor.exerciseId}:${index}`} style={styles.contributor}>
          <Text style={styles.detailRowName}>{contributor.exerciseName}</Text>
          <Text style={styles.targetMeta}>
            {contributor.sessionName} · {Math.round(contributor.ageHours)} hours ago
          </Text>
        </View>
      )) : (
        <Text style={styles.detailBody}>No recent mapped load.</Text>
      )}
      <RecoveryOutlook projection={unit.projection} />
      <Text style={styles.detailFootnote}>
        This is an estimate, not a medical, injury, or safe-to-train assessment.
      </Text>
    </View>
  );
}

function RecoveryOutlook({
  projection,
}: {
  projection: UnitRecoverySignal['projection'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.outlookToggle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.outlookToggleText}>Recovery outlook</Text>
        <Text style={styles.outlookToggleText}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open ? (
        <>
          <Text style={styles.detailBody}>If no new mapped load</Text>
          <View style={styles.projectionRow}>
            {projection.map((point) => (
              <View key={point.offsetHours} style={styles.projectionPoint}>
                <Text style={styles.projectionTime}>{point.offsetHours}h</Text>
                <Text style={styles.projectionValue}>{Math.round(100 - point.burden)}%</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  );
}

function GroupObservationSummary({
  groupId,
  observations,
  onRecord,
}: {
  groupId: RecoveryPresentationGroupId;
  observations: readonly RecoveryGroupObservation[];
  onRecord: () => void;
}) {
  const latest = mostRecentGroupObservation(observations, groupId);
  return (
    <View style={styles.observationBox}>
      <Text style={styles.observationTitle}>
        {latest ? `Latest group feeling: ${latest.readiness}/10` : 'No group feeling recorded'}
      </Text>
      <Text style={styles.detailBody}>
        Observations are saved separately and never change the calculated readiness.
      </Text>
      <SecondaryAction label="Record group feeling" onPress={onRecord} />
    </View>
  );
}

function GroupObservationSheet({
  visible,
  groupId,
  dashboard,
  latest,
  onClose,
  onSaved,
  onError,
}: {
  visible: boolean;
  groupId: RecoveryPresentationGroupId | null;
  dashboard: RecoveryDashboardResult;
  latest?: RecoveryGroupObservation;
  onClose: () => void;
  onSaved: (observation: RecoveryGroupObservation) => void;
  onError: (message: string) => void;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const gutter = width >= 768 ? theme.spacing.xl : theme.spacing.lg;

  useEffect(() => {
    if (visible) setValue(null);
  }, [visible]);

  const save = async () => {
    if (groupId == null || value == null) return;
    setSaving(true);
    try {
      const observation = await addRecoveryGroupObservation({
        presentationGroupId: groupId,
        readiness: value,
        source: 'manual',
        modelVersion: dashboard.scopeEvaluation.recoveryModelVersion,
        registryVersion: dashboard.scopeEvaluation.activationRegistryVersion,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(observation);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown storage error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.detailScrim, { paddingHorizontal: gutter }]}>
        <SafeAreaView style={styles.checkInSheet}>
          <SheetHeader title="Group feeling" onClose={onClose} leading twoLine />
          <ScrollView
            style={styles.checkInScroll}
            contentContainerStyle={styles.checkInScrollContent}
            showsVerticalScrollIndicator={false}
          >
          <Text style={styles.detailTitle}>
            How ready does your {RECOVERY_GROUP_BY_ID[groupId ?? '']?.name ?? 'muscle group'} feel?
          </Text>
          <Text style={styles.detailBody}>
            Select 0–10. Soreness and pain are separate and are not part of this score.
          </Text>
          <View style={styles.scale}>
            {Array.from({ length: 11 }, (_, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  Haptics.selectionAsync();
                  setValue(index);
                }}
                style={[
                  styles.scaleButton,
                  value === index && styles.scaleButtonSelected,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: value === index }}
                accessibilityLabel={`${index} out of 10`}
              >
                <Text style={[
                  styles.scaleText,
                  value === index && styles.scaleTextSelected,
                ]}>
                  {index}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.anchorRow}>
            <Text style={styles.anchorText}>0 · Not ready</Text>
            <Text style={styles.anchorText}>5 · Mixed</Text>
            <Text style={styles.anchorText}>10 · Fully ready</Text>
          </View>
          {latest ? (
            <Text style={styles.detailBody}>Latest saved response: {latest.readiness}/10</Text>
          ) : null}
          <Pressable
            onPress={save}
            disabled={value == null || saving}
            style={[
              styles.primaryAction,
              (value == null || saving) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: value == null || saving }}
          >
            <Text style={styles.primaryActionText}>
              {saving ? 'Saving…' : 'Save observation'}
            </Text>
          </Pressable>
          <Text style={styles.detailFootnote}>
            This observation is stored locally and never changes calculated burden, readiness, or calibration.
          </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 80,
    gap: theme.spacing.md,
  },
  contentTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1240,
    paddingHorizontal: theme.spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  allMusclesAction: {
    minHeight: 44,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  allMusclesActionText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentCyan,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  heroIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accentCyanFade,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: theme.typography.bold,
    fontSize: 24,
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
  },
  sectionTitle: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    letterSpacing: 1.4,
    color: theme.colors.textMuted,
  },
  sectionHint: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  workoutAccordion: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  workoutAccordionHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  workoutAccordionCopy: { flex: 1, minWidth: 0 },
  workoutAccordionMeta: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  workoutAccordionValue: {
    fontFamily: theme.typography.bold,
    fontSize: 20,
    color: theme.colors.text,
  },
  workoutAccordionBody: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  workoutSummaryText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
  },
  workoutExercise: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  workoutQuality: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
  workoutEditAction: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accentCyanFade,
  },
  workoutEditActionText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentCyan,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  comparisonCard: {
    minWidth: 250,
    flexGrow: 1,
    flexBasis: 250,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedBorder: { borderColor: theme.colors.accentCyan },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  comparisonTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
  },
  comparisonStatus: {
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  comparisonReadiness: {
    fontFamily: theme.typography.bold,
    fontSize: 32,
    color: theme.colors.text,
  },
  comparisonBand: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentAmber,
  },
  comparisonLimit: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
  },
  comparisonTargets: {
    minHeight: 38,
    fontFamily: theme.typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
  coverageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  coverageText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  fallbackText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  viewMapButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  viewMapText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.accentCyan,
  },
  addComparisonCard: {
    minWidth: 0,
    minHeight: 60,
    flexGrow: 1,
    flexBasis: 250,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  addComparisonTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
  },
  addComparisonText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  customWorkoutCopy: { flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillCompact: { minHeight: 44, paddingHorizontal: 12 },
  pillSelected: {
    backgroundColor: theme.colors.accentCyanFade,
    borderColor: theme.colors.accentCyan,
  },
  pillText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  pillTextSelected: { color: theme.colors.accentCyan },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  metricTile: {
    minWidth: 155,
    minHeight: 104,
    flexGrow: 1,
    flexBasis: 155,
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tileLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  tileValue: {
    fontFamily: theme.typography.bold,
    fontSize: 22,
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  tileDetail: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  controlRow: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  segmentControlWrap: { width: '100%', minHeight: 44 },
  segment: { flexDirection: 'row', gap: theme.spacing.sm },
  mapDetailLayout: { gap: theme.spacing.md },
  mapDetailTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  mapCard: {
    flex: 1,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapNote: {
    padding: theme.spacing.sm,
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.accentAmber,
    textAlign: 'center',
  },
  groupOverviewCard: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inlineDetail: {
    flex: 0.72,
    minWidth: 320,
    maxWidth: 420,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  targetHeaderCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  targetHeaderCopy: { flex: 1, minWidth: 0 },
  disclosureButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  disclosureButtonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentCyan,
  },
  checkInButton: {
    minWidth: 96,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text,
  },
  checkInButtonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.background,
  },
  targetList: { gap: theme.spacing.sm },
  targetRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  targetCopy: { flex: 1, minWidth: 0 },
  targetName: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  targetMeta: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.sans,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  targetValue: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
  },
  emptyTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
  },
  emptyText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  detailScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  detailSheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    minHeight: '58%',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  detailScroll: { paddingBottom: theme.spacing.lg },
  detailContent: { gap: theme.spacing.md },
  detailEyebrow: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: theme.colors.textMuted,
  },
  detailTitle: {
    fontFamily: theme.typography.bold,
    fontSize: 22,
    color: theme.colors.text,
  },
  detailValue: {
    fontFamily: theme.typography.bold,
    fontSize: 32,
    color: theme.colors.accentCyan,
  },
  detailBody: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  detailRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
  },
  detailRowName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  detailRowValue: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentCyan,
  },
  observationBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentCyanFade,
    borderRadius: theme.borderRadius.md,
  },
  observationTitle: {
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.accentCyan,
  },
  contributor: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
  },
  contributorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  projectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  projectionPoint: {
    flexGrow: 1,
    flexBasis: 120,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
  },
  projectionTime: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  projectionValue: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.bold,
    fontSize: 17,
    color: theme.colors.text,
  },
  outlookToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceCard,
  },
  outlookToggleText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentCyan,
  },
  secondaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentCyan,
  },
  secondaryActionText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.accentCyan,
  },
  detailFootnote: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.textMuted,
  },
  checkInSheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  checkInScroll: { flexShrink: 1 },
  checkInScrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.lg },
  scale: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  scaleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scaleButtonSelected: {
    backgroundColor: theme.colors.accentCyan,
    borderColor: theme.colors.accentCyan,
  },
  scaleText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  scaleTextSelected: { color: theme.colors.background },
  anchorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'space-between' },
  anchorText: {
    fontFamily: theme.typography.sans,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  primaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text,
  },
  primaryActionText: {
    fontFamily: theme.typography.bold,
    fontSize: 15,
    color: theme.colors.background,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
