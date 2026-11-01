import type { WorkoutSession, WorkoutTemplate } from '../trainingTypes';

export type RecoveryView = 'front' | 'back';
export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'cardio';
export type ActivationRole = 'primary' | 'secondary' | 'stabilizer';
export type EstimateAvailability = 'available' | 'limited' | 'unavailable';
export type HistoryCompleteness = 'complete' | 'unknown';

export const MUSCLE_RECOVERY_UNIT_IDS = [
  'upper_chest',
  'lower_chest',
  'anterior_deltoid',
  'lateral_deltoid',
  'posterior_deltoid',
  'biceps_long_head',
  'biceps_short_head',
  'brachialis',
  'triceps_long_head',
  'triceps_lateral_head',
  'triceps_medial_head',
  'upper_trapezius',
  'middle_trapezius',
  'lower_trapezius',
  'latissimus_dorsi',
  'rhomboid',
  'teres_major',
  'serratus_anterior',
  'supraspinatus',
  'infraspinatus',
  'teres_minor',
  'subscapularis',
  'upper_abs',
  'lower_abs',
  'upper_oblique',
  'lower_oblique',
  'rectus_femoris',
  'vastus_lateralis',
  'vastus_medialis',
  'vastus_intermedius',
  'biceps_femoris_long_head',
  'biceps_femoris_short_head',
  'semitendinosus',
  'semimembranosus',
  'gluteus_maximus',
  'gluteus_medius',
  'gluteus_minimus',
  'adductor_longus',
  'adductor_magnus',
  'gracilis',
  'gastrocnemius_medial_head',
  'gastrocnemius_lateral_head',
  'soleus',
  'tibialis_anterior',
  'psoas_major',
  'iliacus',
  'brachioradialis',
  'forearm_flexors',
  'forearm_extensors',
  'upper_erector_spinae',
  'lower_erector_spinae',
] as const;

export type MuscleRecoveryUnitId = (typeof MUSCLE_RECOVERY_UNIT_IDS)[number];

export const RECOVERY_GROUP_IDS = [
  'chest',
  'deltoids',
  'biceps',
  'triceps',
  'trapezius',
  'upper_back',
  'rotator_cuff',
  'core',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'tibialis',
  'hip_flexors',
  'forearms',
  'spinal_erectors',
] as const;

export type RecoveryGroupId = (typeof RECOVERY_GROUP_IDS)[number];

export const RECOVERY_PRESENTATION_GROUP_IDS = [
  'chest',
  'deltoids',
  'biceps',
  'triceps',
  'trapezius',
  'upper_back',
  'core',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'tibialis',
  'hip_flexors',
  'forearms',
  'spinal_erectors',
] as const satisfies readonly Exclude<RecoveryGroupId, 'rotator_cuff'>[];

export type RecoveryPresentationGroupId =
  (typeof RECOVERY_PRESENTATION_GROUP_IDS)[number];

const MUSCLE_RECOVERY_UNIT_ID_SET: ReadonlySet<string> = new Set(
  MUSCLE_RECOVERY_UNIT_IDS,
);
const RECOVERY_GROUP_ID_SET: ReadonlySet<string> = new Set(RECOVERY_GROUP_IDS);
const RECOVERY_PRESENTATION_GROUP_ID_SET: ReadonlySet<string> = new Set(
  RECOVERY_PRESENTATION_GROUP_IDS,
);

export function isMuscleRecoveryUnitId(
  value: unknown,
): value is MuscleRecoveryUnitId {
  return typeof value === 'string' && MUSCLE_RECOVERY_UNIT_ID_SET.has(value);
}

export function assertMuscleRecoveryUnitId(
  value: unknown,
): asserts value is MuscleRecoveryUnitId {
  if (!isMuscleRecoveryUnitId(value)) {
    throw new Error(`Unknown muscle recovery unit ID: ${String(value)}`);
  }
}

export function isRecoveryGroupId(value: unknown): value is RecoveryGroupId {
  return typeof value === 'string' && RECOVERY_GROUP_ID_SET.has(value);
}

export function assertRecoveryGroupId(
  value: unknown,
): asserts value is RecoveryGroupId {
  if (!isRecoveryGroupId(value)) {
    throw new Error(`Unknown recovery group ID: ${String(value)}`);
  }
}

export function isRecoveryPresentationGroupId(
  value: unknown,
): value is RecoveryPresentationGroupId {
  return (
    typeof value === 'string' &&
    RECOVERY_PRESENTATION_GROUP_ID_SET.has(value)
  );
}

export function assertRecoveryPresentationGroupId(
  value: unknown,
): asserts value is RecoveryPresentationGroupId {
  if (!isRecoveryPresentationGroupId(value)) {
    throw new Error(
      `Unknown recovery presentation group ID: ${String(value)}`,
    );
  }
}

export type ActivationBudgetId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'lats'
  | 'upper_back'
  | 'rotator_cuff'
  | 'traps'
  | 'spinal_erectors'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'hip_flexors'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves';

export interface RecoveryUnitDefinition {
  id: MuscleRecoveryUnitId;
  name: string;
  groupId: RecoveryGroupId;
  groupName: string;
  activationBudgetId: ActivationBudgetId;
  view: RecoveryView;
  aggregationWeight: number;
  sharedGeometry: boolean;
  mapSelectable: boolean;
  mapParent: string;
  note?: string;
}

export interface RecoveryGroupDefinition {
  id: RecoveryGroupId;
  name: string;
  unitIds: readonly MuscleRecoveryUnitId[];
  groupScale: number;
}

export interface ExerciseImpactDefinition {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryUnitIds: readonly MuscleRecoveryUnitId[];
  secondaryUnitIds: readonly MuscleRecoveryUnitId[];
  stabilizerUnitIds: readonly MuscleRecoveryUnitId[];
  qualitativeOnly: boolean;
  qualitativeReason?: string;
  cardioTechniqueNote?: boolean;
}

export interface ResolvedExerciseProfile {
  exerciseId: string;
  exerciseName: string;
  classification: 'quantitative' | 'qualitative';
  activationBudgets: Readonly<Partial<Record<ActivationBudgetId, number>>>;
  unitCoefficients: Readonly<Partial<Record<MuscleRecoveryUnitId, number>>>;
  primaryUnitIds: readonly MuscleRecoveryUnitId[];
  unsupportedReason?: string;
  registryVersion: string;
}

export interface SetDoseResult {
  dose: number;
  effortFactor: number;
  repFactor: number;
  effortProvenance: 'observed' | 'neutral_fallback';
  issueCodes: readonly string[];
}

export interface UnitContributor {
  sessionId: string;
  sessionName: string;
  exerciseId: string;
  exerciseName: string;
  sessionEndTime: number;
  ageHours: number;
  originalDose: number;
  currentDose: number;
  latentShare: number;
}

export interface UnitProjectionPoint {
  offsetHours: 0 | 6 | 12 | 24;
  latentBurden: number;
  burden: number;
}

export interface UnitRecoverySignal {
  unitId: MuscleRecoveryUnitId;
  asOf: number;
  available: boolean;
  latentBurden: number | null;
  burden: number | null;
  readiness: number | null;
  scale: number;
  halfLifeHours: number;
  contributors: readonly UnitContributor[];
  projection: readonly UnitProjectionPoint[];
  lastMaterialLoadAt: number | null;
  issueCodes: readonly string[];
}

export interface GroupRecoverySignal {
  groupId: RecoveryGroupId;
  asOf: number;
  available: boolean;
  burden: number | null;
  readiness: number | null;
  weightedMean: number | null;
  maximum: number | null;
  signalCoverage: number;
  childSignals: readonly UnitRecoverySignal[];
  missingUnitIds: readonly MuscleRecoveryUnitId[];
  status: EstimateAvailability;
}

export interface RecoveryHistoryCoverage {
  historyCompleteness: HistoryCompleteness;
  historyReason:
    | 'complete'
    | 'complete_no_load'
    | 'mixed'
    | 'unsupported_only'
    | 'invalid_only'
    | 'missing_rpe'
    | 'history_incomplete';
  effortCoverage: number | null;
  mappedHistoryCoverage: number | null;
  eligibleWorkingSetDose: number;
  mappedWorkingSetDose: number;
  observedEffortDose: number;
  contributingSessionCount: number;
  excludedWarmupCount: number;
  excludedActiveSessionCount: number;
  invalidSetCount: number;
  invalidSessionCount: number;
  invalidEffortCount: number;
  unsupportedExerciseIds: readonly string[];
  issueCodes: readonly string[];
  fallbacks: readonly string[];
}

export interface PlannedExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number | null;
  targetRpe: number | null;
}

export type RecoveryScope =
  | { type: 'all' }
  | { type: 'preset'; preset: 'push' | 'pull' | 'legs' }
  | { type: 'template'; templateId: string }
  | {
      type: 'exercise_selection';
      exerciseIds: readonly string[];
      label?: string;
    }
  | {
      type: 'prescription';
      id: string;
      label: string;
      exercises: readonly PlannedExercise[];
    };

export interface ResolvedRecoveryScope {
  id: string;
  label: string;
  type: RecoveryScope['type'];
  exercises: readonly PlannedExercise[];
  exerciseSelectionPreview: boolean;
  sourceTemplateId?: string;
  issueCodes: readonly string[];
  fallbacks: readonly string[];
}

export interface RecoveryCoverageSummary {
  status: EstimateAvailability;
  historyCompleteness: HistoryCompleteness;
  historyReason: RecoveryHistoryCoverage['historyReason'];
  mappingCoverage: number | null;
  historicalMappingCoverage: number | null;
  signalCoverage: number | null;
  effortCoverage: number | null;
  parameterSource: 'default';
  unsupportedExerciseIds: readonly string[];
  missingSignalUnitIds: readonly MuscleRecoveryUnitId[];
  excludedWarmupCount: number;
  excludedActiveSessionCount: number;
  invalidSetCount: number;
  invalidSessionCount: number;
  invalidEffortCount: number;
  contributingSessionCount: number;
  issueCodes: readonly string[];
  fallbacks: readonly string[];
}

export interface ScopeTargetEvaluation {
  unitId: MuscleRecoveryUnitId;
  relevance: number;
  isPrimary: boolean;
  isCritical: boolean;
  burden: number;
  readiness: number;
}

export interface RecoveryScopeEvaluation {
  scope: ResolvedRecoveryScope;
  asOf: number;
  activationRegistryVersion: string;
  recoveryModelVersion: string;
  status: EstimateAvailability;
  burden: number | null;
  readiness: number | null;
  weightedTargetBurden: number | null;
  maximumCriticalBurden: number | null;
  limitingUnitId: MuscleRecoveryUnitId | null;
  targets: readonly ScopeTargetEvaluation[];
  criticalUnitIds: readonly MuscleRecoveryUnitId[];
  coverage: RecoveryCoverageSummary;
}

export interface ScopeRecoveryGroupSummary {
  groupId: RecoveryGroupId;
  scopeRelevance: number;
  burden: number | null;
  readiness: number | null;
  status: EstimateAvailability;
  childUnitIds: readonly MuscleRecoveryUnitId[];
  mostBurdenedUnitId: MuscleRecoveryUnitId | null;
  lastMaterialLoadAt: number | null;
  containsLimitingUnit: boolean;
}

export interface ScopeRecoveryPresentationGroupSummary {
  presentationGroupId: RecoveryPresentationGroupId;
  sourceGroupIds: readonly RecoveryGroupId[];
  scopeRelevance: number;
  burden: number | null;
  readiness: number | null;
  status: EstimateAvailability;
  childUnitIds: readonly MuscleRecoveryUnitId[];
  mostBurdenedUnitId: MuscleRecoveryUnitId | null;
  lastMaterialLoadAt: number | null;
  containsLimitingUnit: boolean;
}

export interface RecoveryState {
  asOf: number;
  activationRegistryVersion: string;
  recoveryModelVersion: string;
  units: Readonly<Record<string, UnitRecoverySignal>>;
  groups: Readonly<Record<string, GroupRecoverySignal>>;
  historyCoverage: RecoveryHistoryCoverage;
}

export interface RecoveryCalculationOptions {
  historyCompleteness?: HistoryCompleteness;
  halfLifeHours?: number;
}

export interface RecoveryDashboardInput {
  sessions: readonly WorkoutSession[];
  scope: RecoveryScope;
  asOf?: number | Date;
  templates?: readonly WorkoutTemplate[];
  options?: RecoveryCalculationOptions;
}
