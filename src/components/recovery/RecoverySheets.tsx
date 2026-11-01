import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Check, Minus, Plus, Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import SheetHeader from '../SheetHeader';
import {
  EXERCISE_IMPACT_GUIDE,
  type ExerciseImpactDefinition,
  type RecoveryCoverageSummary,
} from '../../recovery';
import {
  recoveryUnitDisplayById,
  type RecoveryUnitId,
} from '../../recovery/anatomy';
import type { Exercise } from '../../trainingTypes';
import { useReducedMotion } from './useReducedMotion';

interface SheetShellProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function SheetShell({ visible, title, onClose, children }: SheetShellProps) {
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
      <View style={[styles.scrim, { paddingHorizontal: gutter }]}>
        <SafeAreaView style={styles.sheet}>
          <SheetHeader title={title} onClose={onClose} leading twoLine />
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export interface CustomPrescriptionItem {
  exerciseId: string;
  sets: number;
  reps: number;
}

interface CustomWorkoutSheetProps {
  visible: boolean;
  exercises: readonly Exercise[];
  value: readonly CustomPrescriptionItem[];
  onClose: () => void;
  onApply: (items: readonly CustomPrescriptionItem[]) => void;
}

export function CustomWorkoutSheet({
  visible,
  exercises,
  value,
  onClose,
  onApply,
}: CustomWorkoutSheetProps) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CustomPrescriptionItem[]>([...value]);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setDraft([...value]);
      setError('');
      setQuery('');
    }
  }, [value, visible]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return exercises.filter(
      (exercise) =>
        !normalized || exercise.name.toLocaleLowerCase().includes(normalized),
    );
  }, [exercises, query]);

  const toggle = (exerciseId: string) => {
    Haptics.selectionAsync();
    setDraft((current) =>
      current.some((item) => item.exerciseId === exerciseId)
        ? current.filter((item) => item.exerciseId !== exerciseId)
        : [...current, { exerciseId, sets: 3, reps: 10 }],
    );
  };

  const adjust = (
    exerciseId: string,
    field: 'sets' | 'reps',
    delta: number,
  ) => {
    const [minimum, maximum] = field === 'sets' ? [1, 10] : [1, 50];
    setDraft((current) =>
      current.map((item) =>
        item.exerciseId === exerciseId
          ? {
              ...item,
              [field]: Math.max(minimum, Math.min(maximum, item[field] + delta)),
            }
          : item,
      ),
    );
  };

  const apply = () => {
    if (!draft.length) {
      setError('Select at least one exercise to compare.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onApply(draft);
  };

  return (
    <SheetShell visible={visible} title="Custom workout" onClose={onClose}>
      <View style={styles.searchRow}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Search exercises"
        />
      </View>
      <Text style={styles.helper}>
        New selections start at 3 × 10. Sets: 1–10. Reps: 1–50.
        Planned RPE is not stored, so neutral effort 0.75 is used.
      </Text>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
        {filtered.map((exercise) => {
          const selected = draft.find((item) => item.exerciseId === exercise.id);
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              <Pressable
                onPress={() => toggle(exercise.id)}
                style={({ pressed }) => [styles.exerciseSelect, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(selected) }}
                accessibilityLabel={exercise.name}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Check size={16} color={theme.colors.background} /> : null}
                </View>
                <View style={styles.exerciseCopy}>
                  <Text style={styles.rowTitle}>{exercise.name}</Text>
                  <Text style={styles.rowMeta}>{exercise.muscleGroup}</Text>
                </View>
              </Pressable>
              {selected ? (
                <View style={styles.prescriptionControls}>
                  <Stepper
                    label="Sets"
                    value={selected.sets}
                    minimum={1}
                    maximum={10}
                    onMinus={() => adjust(exercise.id, 'sets', -1)}
                    onPlus={() => adjust(exercise.id, 'sets', 1)}
                  />
                  <Stepper
                    label="Reps"
                    value={selected.reps}
                    minimum={1}
                    maximum={50}
                    onMinus={() => adjust(exercise.id, 'reps', -1)}
                    onPlus={() => adjust(exercise.id, 'reps', 1)}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={apply}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Apply custom workout</Text>
      </Pressable>
    </SheetShell>
  );
}

function Stepper({
  label,
  value,
  minimum,
  maximum,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        onPress={onMinus}
        disabled={value <= minimum}
        style={[styles.stepperButton, value <= minimum && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: value <= minimum }}
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
      >
        <Minus size={16} color={theme.colors.text} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={onPlus}
        disabled={value >= maximum}
        style={[styles.stepperButton, value >= maximum && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: value >= maximum }}
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
      >
        <Plus size={16} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

interface CoverageSheetProps {
  visible: boolean;
  coverage: RecoveryCoverageSummary;
  asOf: number;
  registryVersion: string;
  modelVersion: string;
  onClose: () => void;
  onOpenGuide: () => void;
}

const percent = (value: number | null) =>
  value == null ? 'N/A' : `${Math.round(value * 100)}%`;

export function CoverageSheet({
  visible,
  coverage,
  asOf,
  registryVersion,
  modelVersion,
  onClose,
  onOpenGuide,
}: CoverageSheetProps) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const { width } = useWindowDimensions();
  const useStackedInfoRows = width < 420;
  const statusCopy = coverage.status === 'available'
    ? 'Your mapped workout and recent training history support this estimate.'
    : coverage.status === 'limited'
      ? 'This estimate is available, with some missing workout or training detail.'
      : 'A numeric readiness estimate is not available for this scope yet.';
  const qualityRows = [
    ['Workout mapping', percent(coverage.mappingCoverage)],
    ['Training history', coverage.historyReason.replaceAll('_', ' ')],
    ['Effort detail', percent(coverage.effortCoverage)],
    ['Warm-ups excluded', String(coverage.excludedWarmupCount)],
    ['Unsupported exercises', coverage.unsupportedExerciseIds.join(', ') || 'None'],
  ];
  const technicalRows = [
    ['Signal coverage', percent(coverage.signalCoverage)],
    ['Parameter source', coverage.parameterSource],
    ['Contributing sessions', String(coverage.contributingSessionCount)],
    ['Active sessions excluded', String(coverage.excludedActiveSessionCount)],
    ['Invalid sets', String(coverage.invalidSetCount)],
    ['Invalid sessions', String(coverage.invalidSessionCount)],
    ['Missing or invalid effort', String(coverage.invalidEffortCount)],
    ['Missing signals', coverage.missingSignalUnitIds.join(', ') || 'None'],
    ['As of', new Date(asOf).toLocaleString()],
    ['Activation registry', registryVersion],
    ['Recovery model', modelVersion],
  ];
  return (
    <SheetShell visible={visible} title="Estimate quality" onClose={onClose}>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
        <Text style={styles.helper}>{statusCopy}</Text>
        {qualityRows.map(([label, value]) => (
          <View key={label} style={[styles.infoRow, useStackedInfoRows && styles.infoRowStacked]}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[styles.infoValue, useStackedInfoRows && styles.infoValueStacked]}>{value}</Text>
          </View>
        ))}
        {coverage.fallbacks.length ? (
          <InfoBlock title="Applied defaults" values={coverage.fallbacks} />
        ) : null}
        <Pressable
          onPress={() => setTechnicalOpen((current) => !current)}
          style={({ pressed }) => [styles.technicalToggle, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: technicalOpen }}
        >
          <Text style={styles.secondaryButtonText}>
            {technicalOpen ? 'Hide technical details' : 'Technical details'}
          </Text>
        </Pressable>
        {technicalOpen ? (
          <>
            {technicalRows.map(([label, value]) => (
              <View key={label} style={[styles.infoRow, useStackedInfoRows && styles.infoRowStacked]}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={[styles.infoValue, useStackedInfoRows && styles.infoValueStacked]}>{value}</Text>
              </View>
            ))}
            {coverage.issueCodes.length ? (
              <InfoBlock title="Issue codes" values={coverage.issueCodes} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <Pressable
        onPress={onOpenGuide}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Open exercise-impact guide</Text>
      </Pressable>
    </SheetShell>
  );
}

function InfoBlock({ title, values }: { title: string; values: readonly string[] }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoBlockTitle}>{title}</Text>
      {values.map((value) => (
        <Text key={value} style={styles.infoBlockText}>• {value}</Text>
      ))}
    </View>
  );
}

interface ExerciseGuideSheetProps {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
}

const namesFor = (ids: readonly string[]) =>
  ids
    .map((id) =>
      (recoveryUnitDisplayById.get(id as RecoveryUnitId)?.name ?? id)
        .replaceAll('\u00c2\u00b7', '\u00b7'),
    )
    .join(', ');

export function ExerciseGuideSheet({
  visible,
  onClose,
  onDismiss,
}: ExerciseGuideSheetProps) {
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const horizontalGutter = width >= 768 ? theme.spacing.xl : theme.spacing.lg;

  useEffect(() => {
    setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return EXERCISE_IMPACT_GUIDE;

    return EXERCISE_IMPACT_GUIDE.filter((item) => {
      const roleNames = [
        ...item.primaryUnitIds,
        ...item.secondaryUnitIds,
        ...item.stabilizerUnitIds,
      ]
        .map((id) => recoveryUnitDisplayById.get(id as RecoveryUnitId)?.name ?? id)
        .join(' ');

      return `${item.name} ${roleNames}`.toLocaleLowerCase().includes(normalized);
    });
  }, [query]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      presentationStyle="fullScreen"
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView
        style={[
          styles.guideSafeArea,
          Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight ?? 0 },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.guideHeader, { paddingHorizontal: horizontalGutter }]}>
          <Text style={styles.guideTitle}>Exercise-impact guide</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.guideCloseButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close exercise-impact guide"
            accessibilityHint="Returns to the Recovery dashboard"
          >
            <X size={20} color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={[styles.guideControls, { paddingHorizontal: horizontalGutter }]}>
          <View style={styles.searchRow}>
            <Search size={18} color={theme.colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search 38 exercises or muscles"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              accessibilityLabel="Search exercise-impact guide"
              accessibilityHint="Searches exercise names and primary, secondary, and stabilizer muscles"
              returnKeyType="search"
            />
          </View>
          <Text style={styles.helper}>
            Roles are qualitative. They are not activation, fatigue, or recovery percentages.
          </Text>
          <Text style={styles.guideResultCount} accessibilityLiveRegion="polite">
            {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
          </Text>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ImpactCard item={item} />}
          style={styles.guideList}
          contentContainerStyle={[styles.guideListContent, { paddingHorizontal: horizontalGutter }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.guideEmptyState}>
              <Text style={styles.rowTitle}>No matching exercises</Text>
              <Text style={styles.helper}>
                Try an exercise name or a primary, secondary, or stabilizer muscle.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

function ImpactCard({ item }: { item: ExerciseImpactDefinition }) {
  return (
    <View style={styles.impactCard}>
      <View style={styles.impactHeader}>
        <Text style={[styles.rowTitle, styles.impactTitle]}>{item.name}</Text>
        <Text style={styles.statusBadge}>
          {item.qualitativeOnly ? 'Qualitative' : 'Mapped'}
        </Text>
      </View>
      <RoleLine label="Primary" value={namesFor(item.primaryUnitIds)} />
      <RoleLine label="Secondary" value={namesFor(item.secondaryUnitIds)} />
      <RoleLine label="Stabilizers" value={namesFor(item.stabilizerUnitIds)} />
      {item.cardioTechniqueNote ? (
        <Text style={styles.helper}>
          Emphasis changes with speed, incline, resistance, and technique.
        </Text>
      ) : null}
    </View>
  );
}

function RoleLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.roleLine}>
      <Text style={styles.roleLabel}>{label}</Text>
      <Text style={styles.roleValue}>{value || 'None listed'}</Text>
    </View>
  );
}

interface UnitChooserSheetProps {
  visible: boolean;
  title: string;
  unitIds: readonly RecoveryUnitId[];
  unavailableReason?: string;
  onClose: () => void;
  onSelect: (unitId: RecoveryUnitId) => void;
}

export function UnitChooserSheet({
  visible,
  title,
  unitIds,
  unavailableReason,
  onClose,
  onSelect,
}: UnitChooserSheetProps) {
  return (
    <SheetShell visible={visible} title={title} onClose={onClose}>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
        {unitIds.length ? (
          <>
            {unitIds.length > 1 ? (
              <Text style={styles.helper}>
                The repository geometry uses a shared parent outline here. Choose
                an individual muscle signal without inventing visual boundaries.
              </Text>
            ) : null}
            {unitIds.map((unitId) => (
              <Pressable
                key={unitId}
                onPress={() => onSelect(unitId)}
                style={({ pressed }) => [styles.chooserRow, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.rowTitle}>
                  {(recoveryUnitDisplayById.get(unitId)?.name ?? unitId)
                    .replaceAll('\u00c2\u00b7', '\u00b7')}
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.helper}>
            {unavailableReason ?? 'No quantitative recovery mapping is available.'}
          </Text>
        )}
      </ScrollView>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    minHeight: '48%',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  guideSafeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  guideHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  guideTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  guideCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceElevated,
  },
  guideControls: {
    paddingBottom: theme.spacing.md,
  },
  guideResultCount: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  guideList: {
    flex: 1,
  },
  guideListContent: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  guideEmptyState: {
    alignItems: 'flex-start',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
  },
  searchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: theme.colors.text,
  },
  helper: {
    marginVertical: theme.spacing.sm,
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
  error: {
    marginVertical: theme.spacing.sm,
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentRed,
  },
  sheetList: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sheetScroll: {
    flex: 1,
    minHeight: 0,
  },
  exerciseRow: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  exerciseSelect: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
  },
  checkboxSelected: {
    backgroundColor: theme.colors.accentCyan,
    borderColor: theme.colors.accentCyan,
  },
  exerciseCopy: { flex: 1 },
  rowTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
  },
  rowMeta: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  prescriptionControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepperLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceCard,
  },
  stepperValue: {
    width: 24,
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text,
  },
  primaryButtonText: {
    fontFamily: theme.typography.bold,
    fontSize: 15,
    color: theme.colors.background,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentCyan,
  },
  secondaryButtonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.accentCyan,
  },
  technicalToggle: {
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  infoRowStacked: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  infoLabel: {
    flex: 1,
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  infoValue: {
    flex: 1,
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'right',
    textTransform: 'capitalize',
    minWidth: 0,
    flexShrink: 1,
  },
  infoValueStacked: { textAlign: 'left' },
  infoBlock: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
  },
  infoBlockTitle: {
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  infoBlockText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
  impactCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  impactTitle: {
    flex: 1,
    minWidth: 0,
  },
  statusBadge: {
    flexShrink: 0,
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.accentCyan,
  },
  roleLine: { gap: theme.spacing.xs },
  roleLabel: {
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  roleValue: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.text,
  },
  chooserRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
  },
});
