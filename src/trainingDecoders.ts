import type {
  Exercise,
  ExerciseDefaults,
  LoggedSet,
  TemplateExercise,
  WorkoutSession,
  WorkoutTemplate,
} from './trainingTypes';
import type { HistoryCompleteness } from './recovery/types';
import type { StorageLoadStatus } from './structuredStorage';

export const TRAINING_STORAGE_DECODER_VERSION = 1 as const;

export function recoveryHistoryCompletenessForStatus(
  status: StorageLoadStatus,
): HistoryCompleteness {
  return status === 'valid' || status === 'absent' ? 'complete' : 'unknown';
}

export interface TrainingDecodeIssue {
  path: string;
  code: string;
  message: string;
}

export type TrainingDecodeResult<T> =
  | { ok: true; value: T; issues: readonly [] }
  | { ok: false; recoverableValue: T; issues: readonly TrainingDecodeIssue[] };

type UnknownRecord = Record<string, unknown>;

const MUSCLE_GROUPS = new Set(['push', 'pull', 'legs', 'core', 'cardio']);
const EQUIPMENT_TYPES = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']);
const WEIGHT_UNITS = new Set(['kg', 'lbs']);
const TRACKING_TYPES = new Set(['weight_reps', 'time', 'time_distance']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, code: string, message: string): TrainingDecodeIssue {
  return { path, code, message };
}

function requiredNonEmptyString(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: TrainingDecodeIssue[],
): void {
  if (typeof value[key] !== 'string' || value[key].length === 0) {
    issues.push(issue(`${path}.${key}`, 'invalid_string', `${key} must be a non-empty string.`));
  }
}

function optionalString(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: TrainingDecodeIssue[],
): void {
  if (value[key] !== undefined && typeof value[key] !== 'string') {
    issues.push(issue(`${path}.${key}`, 'invalid_string', `${key} must be a string when present.`));
  }
}

function finiteNumber(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: TrainingDecodeIssue[],
  minimum: number,
  optional = false,
): void {
  if (optional && value[key] === undefined) return;
  if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < minimum) {
    issues.push(issue(`${path}.${key}`, 'invalid_number', `${key} must be a finite number of at least ${minimum}.`));
  }
}

function integer(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: TrainingDecodeIssue[],
  minimum: number,
  optional = false,
): void {
  if (optional && value[key] === undefined) return;
  if (!Number.isInteger(value[key]) || (value[key] as number) < minimum) {
    issues.push(issue(`${path}.${key}`, 'invalid_integer', `${key} must be an integer of at least ${minimum}.`));
  }
}

function enumValue(
  value: UnknownRecord,
  key: string,
  allowed: ReadonlySet<string>,
  path: string,
  issues: TrainingDecodeIssue[],
  optional = false,
): void {
  if (optional && value[key] === undefined) return;
  if (typeof value[key] !== 'string' || !allowed.has(value[key])) {
    issues.push(issue(`${path}.${key}`, 'invalid_enum', `${key} has an unsupported value.`));
  }
}

export function decodeTemplateExercise(value: unknown, path: string): TrainingDecodeResult<TemplateExercise> {
  if (!isRecord(value)) {
    return { ok: false, recoverableValue: {} as TemplateExercise, issues: [issue(path, 'invalid_object', 'Template exercise must be an object.')] };
  }
  const issues: TrainingDecodeIssue[] = [];
  requiredNonEmptyString(value, 'exerciseId', path, issues);
  integer(value, 'targetSets', path, issues, 1);
  integer(value, 'targetReps', path, issues, 0);
  optionalString(value, 'notes', path, issues);
  finiteNumber(value, 'targetMinutes', path, issues, 0, true);
  return issues.length
    ? { ok: false, recoverableValue: value as unknown as TemplateExercise, issues }
    : { ok: true, value: value as unknown as TemplateExercise, issues: [] };
}

export function decodeLoggedSet(value: unknown, path: string): TrainingDecodeResult<LoggedSet> {
  if (!isRecord(value)) {
    return { ok: false, recoverableValue: {} as LoggedSet, issues: [issue(path, 'invalid_object', 'Logged set must be an object.')] };
  }
  const issues: TrainingDecodeIssue[] = [];
  requiredNonEmptyString(value, 'id', path, issues);
  requiredNonEmptyString(value, 'exerciseId', path, issues);
  requiredNonEmptyString(value, 'exerciseName', path, issues);
  integer(value, 'setNumber', path, issues, 0);
  finiteNumber(value, 'weight', path, issues, 0);
  enumValue(value, 'weightUnit', WEIGHT_UNITS, path, issues, true);
  finiteNumber(value, 'reps', path, issues, 0);
  finiteNumber(value, 'timeMinutes', path, issues, 0, true);
  integer(value, 'rpe', path, issues, 1, true);
  if (typeof value.rpe === 'number' && value.rpe > 10) {
    issues.push(issue(`${path}.rpe`, 'invalid_rpe', 'rpe must not exceed 10.'));
  }
  if (value.isWarmup !== undefined && typeof value.isWarmup !== 'boolean') {
    issues.push(issue(`${path}.isWarmup`, 'invalid_boolean', 'isWarmup must be a boolean when present.'));
  }
  integer(value, 'timestamp', path, issues, 0);
  finiteNumber(value, 'estimated1RM', path, issues, 0);
  const normalized = { ...value, weightUnit: value.weightUnit ?? 'kg' } as unknown as LoggedSet;
  return issues.length
    ? { ok: false, recoverableValue: normalized, issues }
    : { ok: true, value: normalized, issues: [] };
}

export function decodeWorkoutSession(value: unknown, path: string): TrainingDecodeResult<WorkoutSession> {
  if (!isRecord(value)) {
    return { ok: false, recoverableValue: {} as WorkoutSession, issues: [issue(path, 'invalid_object', 'Workout session must be an object.')] };
  }
  const issues: TrainingDecodeIssue[] = [];
  requiredNonEmptyString(value, 'id', path, issues);
  requiredNonEmptyString(value, 'templateId', path, issues);
  requiredNonEmptyString(value, 'templateName', path, issues);
  integer(value, 'startTime', path, issues, 0);
  integer(value, 'endTime', path, issues, 0, true);
  finiteNumber(value, 'durationMinutes', path, issues, 0, true);
  finiteNumber(value, 'totalVolume', path, issues, 0);
  integer(value, 'sessionNumber', path, issues, 1);

  const decodedSets: LoggedSet[] = [];
  if (!Array.isArray(value.sets)) {
    issues.push(issue(`${path}.sets`, 'invalid_array', 'sets must be an array.'));
  } else {
    value.sets.forEach((set, index) => {
      const decoded = decodeLoggedSet(set, `${path}.sets[${index}]`);
      if (!decoded.ok) issues.push(...decoded.issues);
      else decodedSets.push(decoded.value);
    });
  }

  const decodedExercises: TemplateExercise[] = [];
  if (value.exercises !== undefined) {
    if (!Array.isArray(value.exercises)) {
      issues.push(issue(`${path}.exercises`, 'invalid_array', 'exercises must be an array when present.'));
    } else {
      value.exercises.forEach((exercise, index) => {
        const decoded = decodeTemplateExercise(exercise, `${path}.exercises[${index}]`);
        if (!decoded.ok) issues.push(...decoded.issues);
        else decodedExercises.push(decoded.value);
      });
    }
  }

  const normalized = {
    ...value,
    sets: decodedSets,
    ...(value.exercises !== undefined ? { exercises: decodedExercises } : {}),
  } as unknown as WorkoutSession;
  return issues.length
    ? { ok: false, recoverableValue: normalized, issues }
    : { ok: true, value: normalized, issues: [] };
}

function decodeWorkoutTemplate(value: unknown, path: string): TrainingDecodeResult<WorkoutTemplate> {
  if (!isRecord(value)) {
    return { ok: false, recoverableValue: {} as WorkoutTemplate, issues: [issue(path, 'invalid_object', 'Workout template must be an object.')] };
  }
  const issues: TrainingDecodeIssue[] = [];
  requiredNonEmptyString(value, 'id', path, issues);
  requiredNonEmptyString(value, 'name', path, issues);
  optionalString(value, 'color', path, issues);
  if (!Array.isArray(value.exercises)) {
    issues.push(issue(`${path}.exercises`, 'invalid_array', 'exercises must be an array.'));
  } else {
    value.exercises.forEach((exercise, index) => {
      const decoded = decodeTemplateExercise(exercise, `${path}.exercises[${index}]`);
      if (!decoded.ok) issues.push(...decoded.issues);
    });
  }
  return issues.length
    ? { ok: false, recoverableValue: value as unknown as WorkoutTemplate, issues }
    : { ok: true, value: value as unknown as WorkoutTemplate, issues: [] };
}

function decodeExercise(value: unknown, path: string): TrainingDecodeResult<Exercise> {
  if (!isRecord(value)) {
    return { ok: false, recoverableValue: {} as Exercise, issues: [issue(path, 'invalid_object', 'Custom exercise must be an object.')] };
  }
  const issues: TrainingDecodeIssue[] = [];
  requiredNonEmptyString(value, 'id', path, issues);
  requiredNonEmptyString(value, 'name', path, issues);
  enumValue(value, 'muscleGroup', MUSCLE_GROUPS, path, issues);
  optionalString(value, 'primaryMuscle', path, issues);
  enumValue(value, 'equipment', EQUIPMENT_TYPES, path, issues);
  finiteNumber(value, 'incrementStep', path, issues, 0);
  if (typeof value.isCustom !== 'boolean') {
    issues.push(issue(`${path}.isCustom`, 'invalid_boolean', 'isCustom must be a boolean.'));
  }
  enumValue(value, 'weightUnit', WEIGHT_UNITS, path, issues, true);
  enumValue(value, 'trackingType', TRACKING_TYPES, path, issues, true);
  const normalized = { ...value, weightUnit: value.weightUnit ?? 'kg' } as unknown as Exercise;
  return issues.length
    ? { ok: false, recoverableValue: normalized, issues }
    : { ok: true, value: normalized, issues: [] };
}

function decodeCollection<T>(
  value: unknown,
  rootPath: string,
  decodeItem: (item: unknown, path: string) => TrainingDecodeResult<T>,
  idOf: (item: T) => string,
): TrainingDecodeResult<T[]> {
  if (!Array.isArray(value)) {
    return { ok: false, recoverableValue: [], issues: [issue(rootPath, 'invalid_array', 'Stored value must be an array.')] };
  }
  const recovered: T[] = [];
  const issues: TrainingDecodeIssue[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `${rootPath}[${index}]`;
    const decoded = decodeItem(item, path);
    if (!decoded.ok) {
      issues.push(...decoded.issues);
      return;
    }
    const id = idOf(decoded.value);
    if (ids.has(id)) {
      issues.push(issue(`${path}.id`, 'duplicate_id', `Duplicate persisted identifier: ${id}.`));
      return;
    }
    ids.add(id);
    recovered.push(decoded.value);
  });
  return issues.length
    ? { ok: false, recoverableValue: recovered, issues }
    : { ok: true, value: recovered, issues: [] };
}

export function decodeWorkoutSessions(value: unknown): TrainingDecodeResult<WorkoutSession[]> {
  return decodeCollection(value, 'sessions', decodeWorkoutSession, session => session.id);
}

export function decodeWorkoutTemplates(value: unknown): TrainingDecodeResult<WorkoutTemplate[]> {
  return decodeCollection(value, 'templates', decodeWorkoutTemplate, template => template.id);
}

export function decodeCustomExercises(value: unknown): TrainingDecodeResult<Exercise[]> {
  return decodeCollection(value, 'customExercises', decodeExercise, exercise => exercise.id);
}

export function decodeExerciseDefaults(
  value: unknown,
): TrainingDecodeResult<Record<string, ExerciseDefaults>> {
  if (!isRecord(value)) {
    return {
      ok: false,
      recoverableValue: Object.create(null) as Record<string, ExerciseDefaults>,
      issues: [issue('exerciseDefaults', 'invalid_object', 'Exercise defaults must be an object.')],
    };
  }
  const recovered = Object.create(null) as Record<string, ExerciseDefaults>;
  const issues: TrainingDecodeIssue[] = [];
  Object.entries(value).forEach(([exerciseId, defaults]) => {
    const path = `exerciseDefaults.${exerciseId}`;
    if (exerciseId === '__proto__' || exerciseId === 'prototype' || exerciseId === 'constructor') {
      issues.push(issue(path, 'dangerous_key', 'Exercise defaults contain a forbidden object key.'));
      return;
    }
    if (!exerciseId || !isRecord(defaults)) {
      issues.push(issue(path, 'invalid_object', 'Each exercise default must be an object under a non-empty exercise ID.'));
      return;
    }
    const entryIssues: TrainingDecodeIssue[] = [];
    finiteNumber(defaults, 'defaultWeight', path, entryIssues, 0);
    integer(defaults, 'defaultReps', path, entryIssues, 0);
    enumValue(defaults, 'weightUnit', WEIGHT_UNITS, path, entryIssues, true);
    if (entryIssues.length) {
      issues.push(...entryIssues);
      return;
    }
    recovered[exerciseId] = defaults as unknown as ExerciseDefaults;
  });
  return issues.length
    ? { ok: false, recoverableValue: recovered, issues }
    : { ok: true, value: recovered, issues: [] };
}

export function decodeActiveSession(value: unknown): TrainingDecodeResult<WorkoutSession | null> {
  if (value === null) return { ok: true, value: null, issues: [] };
  const decoded = decodeWorkoutSession(value, 'activeSession');
  return decoded.ok
    ? decoded
    : { ok: false, recoverableValue: null, issues: decoded.issues };
}
